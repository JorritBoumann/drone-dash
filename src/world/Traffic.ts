import * as THREE from 'three';
import { createSeededRandom, pick, range, type Rng } from '../core/random';
import { CAR_PAINTS, MOOD_LIGHTS, TAXI_PAINT, VAN_PAINTS, VDIM, VT, buildVehicleGeometry, vehicleMaterial } from './StreetKit';

/**
 * Round 22: street traffic. Cars, taxis, vans and box trucks drive the street grid on the right-hand lane (2.9 m off the
 * centre line, matching the stop lines), go straight or turn at junctions on smooth arcs, slow for corners, keep a gap
 * to the car ahead and stop at the stop line until their junction lets them through. A junction admits cars from one
 * axis at a time (signal phases plus an occupancy check) and only when the exit lane has room, so paths never cross.
 * Cars never leave the road and are not colliders (unchanged).
 *
 * The rush-hour hover-vans (round 18 and 19) keep their lanes, height and the draft rule; they now keep a gap to the van
 * ahead and take turns at the one point where the two rush lanes cross. All vehicles are one InstancedMesh.
 */

const LANE = 2.9;
const BOX = 6; // half road width: the junction box is 12 x 12 m
const STOP = 2.6; // stop line distance from the box edge
const CYCLE = 18;
const ACCEL = 2.6;
const BRAKE = 7;

type Mode = 'lane' | 'turn';
type Car = {
  active: boolean;
  type: number; len: number; wid: number; hgt: number;
  axis: 0 | 1; line: number; dir: 1 | -1; pos: number; next: number;
  plan: 'S' | 'N' | 'F'; committed: number; // node id the car may cross (-1: none)
  speed: number; cruise: number; brake: number;
  mode: Mode;
  // turn arc
  ox: number; oz: number; r: number; a0: number; sweep: number; arcS: number; arcLen: number;
  toAxis: 0 | 1; toDir: 1 | -1; inAxis: 0 | 1;
  // world pose
  x: number; z: number; fx: number; fz: number;
  occupy: number; // node id this car is inside (-1)
  color: THREE.Color;
};
type Van = { axis: 0 | 1; line: number; dir: 1 | -1; pos: number; speed: number; cruise: number; lane: number; bob: number; delay: number; hold: boolean; res: boolean; started: boolean; color: THREE.Color };

export type VehicleInfo = { kind: 'car' | 'van'; type: number; x: number; y: number; z: number; fx: number; fz: number; len: number; wid: number; y0: number; y1: number; mode: string; lat: number; axis: number };

export class Traffic {
  readonly mesh: THREE.InstancedMesh;
  private readonly cars: Car[] = [];
  readonly vans: Van[] = [];
  private readonly rc: number[];
  private readonly n: number;
  private readonly half: number;
  private readonly rng: Rng;
  private readonly offsets: number[] = [];
  private readonly occupants = new Map<number, Car[]>();
  private readonly iinfo: THREE.InstancedBufferAttribute;
  private readonly lights = { value: 0.5 };
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s1 = new THREE.Vector3(1, 1, 1);
  private readonly up = new THREE.Vector3(0, 1, 0);
  private clock = 0;
  private spawnT = 0;
  target = 40;
  rushTarget = 0;
  rushClock = 0;
  private readonly baseDelay: number[] = [];
  private turn = -1; // rush lanes crossing: axis whose waiting van goes next
  private readonly rushLines: Array<{ axis: 0 | 1; line: number }>;
  readonly capacity: number;
  private readonly baseCount: number;
  private readonly rushCount: number;

  constructor(roadCenters: number[], half: number, seed: number, mood: number, rushLanes: Array<{ axis: 0 | 1; index: number }>, mobile = false) {
    this.rc = roadCenters;
    this.n = roadCenters.length;
    this.half = half;
    this.rng = createSeededRandom(seed * 131 + 17);
    this.lights.value = MOOD_LIGHTS[mood] ?? 0.5;
    this.baseCount = mobile ? 34 : 40;
    this.rushCount = mobile ? 52 : 62;
    this.target = this.baseCount;
    const carCap = this.rushCount;
    const vanCap = rushLanes.length ? 18 : 0;
    this.capacity = carCap + vanCap;
    this.rushLines = rushLanes.map((l) => ({ axis: l.axis, line: roadCenters[l.index] }));
    for (let i = 0; i < this.n * this.n; i++) this.offsets.push(this.rng() * CYCLE);

    const { material, depth } = vehicleMaterial(this.lights);
    const geo = buildVehicleGeometry();
    this.iinfo = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 2), 2);
    this.iinfo.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iinfo', this.iinfo);
    this.mesh = new THREE.InstancedMesh(geo, material, this.capacity);
    this.mesh.customDepthMaterial = depth;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color());
    this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'traffic';

    const paints = CAR_PAINTS[mood] ?? CAR_PAINTS[0];
    for (let i = 0; i < carCap; i++) {
      const roll = this.rng();
      const type = roll < 0.3 ? VT.compact : roll < 0.55 ? VT.sedan : roll < 0.7 ? VT.taxi : roll < 0.87 ? VT.van : VT.truck;
      const d = VDIM[type];
      const color = new THREE.Color(type === VT.taxi ? TAXI_PAINT : type === VT.van ? pick(this.rng, VAN_PAINTS) : pick(this.rng, paints));
      this.cars.push({
        active: false, type, len: d.len, wid: d.wid, hgt: d.hgt, axis: 0, line: 0, dir: 1, pos: 0, next: 0, plan: 'S', committed: -1,
        speed: 0, cruise: type === VT.truck ? range(this.rng, 7, 8.5) : range(this.rng, 8.5, 11), brake: 0, mode: 'lane',
        ox: 0, oz: 0, r: 0, a0: 0, sweep: 0, arcS: 0, arcLen: 0, toAxis: 0, toDir: 1, inAxis: 0, x: 0, z: 0, fx: 0, fz: 1, occupy: -1, color,
      });
    }
    // initial cars, spread over the grid
    for (let k = 0, tries = 0; k < this.target && tries < 2000; tries++) if (this.spawn(this.cars[k], null)) k++;

    if (vanCap) {
      const vr = createSeededRandom(rushLanes[0].index * 977 + rushLanes[1].index * 31 + 5); // same stream as round 18
      for (let i = 0; i < vanCap; i++) {
        const lane = rushLanes[i % rushLanes.length];
        const dir = (i >> 1) % 2 === 0 ? 1 : -1;
        const sp = range(vr, 15, 20);
        this.baseDelay.push(0);
        this.vans.push({ axis: lane.axis, line: roadCenters[lane.index], dir, pos: -dir * (half + 4), speed: sp, cruise: sp, lane: dir * 2.9, bob: vr() * 6.28, delay: Math.floor(i / 4) * 2.2 + vr() * 1.5, hold: false, res: false, started: false, color: new THREE.Color(VAN_PAINTS[i % VAN_PAINTS.length]) });
      }
    }
    this.vans.forEach((v, i) => { this.baseDelay[i] = v.delay; });
    this.write();
  }

  // ----------------------------------------------------------------------------------------------------------------
  // ground traffic
  // ----------------------------------------------------------------------------------------------------------------

  private nodeId(xi: number, zi: number): number { return xi * this.n + zi; }
  /** node of the car's next junction (x index, z index) */
  private nodeOf(c: Car): number { return c.axis === 0 ? this.nodeId(c.next, c.line) : this.nodeId(c.line, c.next); }

  private place(c: Car): void {
    if (c.axis === 0) { c.x = c.pos; c.z = this.rc[c.line] + c.dir * LANE; c.fx = c.dir; c.fz = 0; }
    else { c.x = this.rc[c.line] - c.dir * LANE; c.z = c.pos; c.fx = 0; c.fz = c.dir; }
  }

  /** Plans what the car does at its next junction: straight, near (right) turn, far (left) turn only where nothing comes the other way. */
  private choosePlan(c: Car): void {
    const i = c.next, d = c.dir;
    const straight = i + d >= 0 && i + d < this.n;
    const opts: Array<'S' | 'N' | 'F'> = [];
    // near turn: axis 0 dir d turns to +z * d; axis 1 dir d turns to -x * d
    const nearDir = c.axis === 0 ? d : -d;
    const farDir = -nearDir;
    const nearOk = c.line + nearDir >= 0 && c.line + nearDir < this.n;
    const farOk = !straight && c.line + farDir >= 0 && c.line + farDir < this.n;
    if (straight) opts.push('S', 'S', 'S');
    if (nearOk) opts.push('N', 'N');
    if (farOk) opts.push('F', 'F');
    c.plan = opts.length ? pick(this.rng, opts) : 'S';
    if (!straight && !nearOk && !farOk) c.plan = 'S';
  }

  private signalAllows(node: number, axis: 0 | 1): boolean {
    const t = (this.clock + this.offsets[node]) % CYCLE;
    return axis === 0 ? t < 6.6 : t >= 9 && t < 15.6;
  }

  /** Room for the whole car past the exit of the junction on its planned lane. */
  private exitClear(c: Car): boolean {
    const C = this.junction(c);
    const { ex, ez, efx, efz } = this.exitPose(c, C.x, C.z);
    for (const o of this.cars) {
      if (!o.active || o === c) continue;
      const dx = o.x - ex, dz = o.z - ez;
      const along = dx * efx + dz * efz;
      const lat = Math.abs(dx * efz - dz * efx);
      if (lat > 1.8 || o.fx * efx + o.fz * efz < 0.3) continue;
      if (along > -6 && along - o.len / 2 < c.len + 2.5) return false;
    }
    return true;
  }

  private junction(c: Car): { x: number; z: number } {
    return c.axis === 0 ? { x: this.rc[c.next], z: this.rc[c.line] } : { x: this.rc[c.line], z: this.rc[c.next] };
  }

  /** Where the car leaves the junction box and its heading then. */
  private exitPose(c: Car, cx: number, cz: number): { ex: number; ez: number; efx: number; efz: number } {
    const fx = c.axis === 0 ? c.dir : 0, fz = c.axis === 0 ? 0 : c.dir;
    const rx = -fz, rz = fx; // right of travel
    if (c.plan === 'S') return { ex: cx + fx * BOX + rx * LANE, ez: cz + fz * BOX + rz * LANE, efx: fx, efz: fz };
    if (c.plan === 'N') return { ex: cx - fx * LANE + rx * BOX, ez: cz - fz * LANE + rz * BOX, efx: rx, efz: rz };
    return { ex: cx + fx * LANE - rx * BOX, ez: cz + fz * LANE - rz * BOX, efx: -rx, efz: -rz };
  }

  private canCommit(c: Car): boolean {
    const node = this.nodeOf(c);
    if (!this.signalAllows(node, c.axis)) return false;
    const occ = this.occupants.get(node);
    if (occ && occ.some((o) => o.occupy === node && o.inAxis !== c.axis)) return false;
    return this.exitClear(c);
  }

  private startTurn(c: Car): void {
    const C = this.junction(c);
    const fx = c.axis === 0 ? c.dir : 0, fz = c.axis === 0 ? 0 : c.dir;
    const rx = -fz, rz = fx;
    const near = c.plan === 'N';
    const sgn = near ? 1 : -1;
    c.ox = C.x + sgn * rx * BOX - fx * BOX;
    c.oz = C.z + sgn * rz * BOX - fz * BOX;
    c.r = near ? BOX - LANE : BOX + LANE;
    const ex = C.x + rx * LANE - fx * BOX, ez = C.z + rz * LANE - fz * BOX;
    c.a0 = Math.atan2(ez - c.oz, ex - c.ox);
    const xx = this.exitPose(c, C.x, C.z);
    const a1 = Math.atan2(xx.ez - c.oz, xx.ex - c.ox);
    let sw = a1 - c.a0;
    while (sw > Math.PI) sw -= 2 * Math.PI;
    while (sw < -Math.PI) sw += 2 * Math.PI;
    c.sweep = sw;
    c.arcLen = Math.abs(sw) * c.r;
    c.arcS = 0;
    // new lane after the turn
    const nfx = xx.efx, nfz = xx.efz;
    c.toAxis = nfx !== 0 ? 0 : 1;
    c.toDir = (nfx + nfz > 0 ? 1 : -1) as 1 | -1;
    c.mode = 'turn';
  }

  private finishTurn(c: Car): void {
    const prevAxis = c.axis;
    const nodeX = prevAxis === 0 ? c.next : c.line;
    const nodeZ = prevAxis === 0 ? c.line : c.next;
    c.axis = c.toAxis;
    c.dir = c.toDir;
    if (c.axis === 0) { c.line = nodeZ; c.next = nodeX + c.dir; c.pos = this.rc[nodeX] + c.dir * BOX; }
    else { c.line = nodeX; c.next = nodeZ + c.dir; c.pos = this.rc[nodeZ] + c.dir * BOX; }
    c.mode = 'lane';
    c.committed = -1;
    this.choosePlan(c);
  }

  private release(c: Car): void {
    if (c.occupy < 0) return;
    const occ = this.occupants.get(c.occupy);
    if (occ) { const k = occ.indexOf(c); if (k >= 0) occ.splice(k, 1); }
    c.occupy = -1;
  }

  /** Places a car on a free stretch of lane (far from the camera when `cam` is given). */
  private spawn(c: Car, cam: THREE.Vector3 | null): boolean {
    const axis = (this.rng() < 0.5 ? 0 : 1) as 0 | 1;
    const line = Math.floor(this.rng() * this.n);
    const dir = (this.rng() < 0.5 ? 1 : -1) as 1 | -1;
    const seg = Math.floor(this.rng() * (this.n - 1)); // between node seg and seg + 1
    const from = dir > 0 ? seg : seg + 1;
    const next = from + dir;
    const a = this.rc[from] + dir * (BOX + c.len / 2 + 1);
    const b = this.rc[next] - dir * (BOX + STOP + c.len / 2 + 0.5);
    const pos = a + (b - a) * this.rng();
    c.axis = axis; c.line = line; c.dir = dir; c.pos = pos; c.next = next; c.mode = 'lane'; c.committed = -1; c.occupy = -1;
    this.place(c);
    if (cam && Math.hypot(c.x - cam.x, c.z - cam.z) < 70) return false;
    for (const o of this.cars) {
      if (!o.active || o === c) continue;
      if (Math.hypot(o.x - c.x, o.z - c.z) < (o.len + c.len) / 2 + 4) return false;
    }
    c.active = true;
    c.speed = c.cruise * 0.6;
    this.choosePlan(c);
    return true;
  }

  private updateCars(dt: number, cam: THREE.Vector3): void {
    // spawn / retire to follow the target count (rush hour is busier)
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.35;
      const active = this.cars.filter((c) => c.active);
      if (active.length < this.target) {
        const c = this.cars.find((k) => !k.active);
        if (c) this.spawn(c, cam);
      } else if (active.length > this.target) {
        const c = active.find((k) => k.mode === 'lane' && k.committed < 0 && k.occupy < 0 && Math.hypot(k.x - cam.x, k.z - cam.z) > 80);
        if (c) c.active = false;
      }
    }
    for (const c of this.cars) {
      if (!c.active) continue;
      // speed limits: car ahead, stop line, corner
      let vmax = c.cruise;
      let gapMin = 99;
      for (const o of this.cars) {
        if (!o.active || o === c) continue;
        const dx = o.x - c.x, dz = o.z - c.z;
        const along = dx * c.fx + dz * c.fz;
        if (along > -o.len && along < 30) {
          const lat = Math.abs(dx * c.fz - dz * c.fx);
          if (along > 0 && lat <= 1.7 && o.fx * c.fx + o.fz * c.fz >= 0.3) {
            const gap = along - (o.len + c.len) / 2;
            if (gap < gapMin) gapMin = gap;
          }
          // a turning car's tail can still hang in this lane while its nose points away
          if (o.mode === 'turn') {
            const tx = dx - o.fx * o.len / 2, tz = dz - o.fz * o.len / 2;
            const ta = tx * c.fx + tz * c.fz, tl = Math.abs(tx * c.fz - tz * c.fx);
            if (ta > 0 && tl <= 1.9) { const gap = ta - c.len / 2; if (gap < gapMin) gapMin = gap; }
          }
        }
      }
      if (gapMin < 99) vmax = Math.min(vmax, Math.sqrt(2 * 4 * Math.max(0, gapMin - 2.2)));
      if (c.mode === 'lane') {
        const node = this.nodeOf(c);
        const nodeC = this.rc[c.next];
        const stopPos = nodeC - c.dir * (BOX + STOP + c.len / 2 + 0.2);
        const toStop = (stopPos - c.pos) * c.dir;
        if (c.committed !== node && c.occupy < 0 && toStop < 32) {
          if (this.canCommit(c)) {
            c.committed = node;
            c.occupy = node;
            c.inAxis = c.axis;
            let occ = this.occupants.get(node);
            if (!occ) { occ = []; this.occupants.set(node, occ); }
            occ.push(c);
          }
        }
        if (c.committed !== node) vmax = Math.min(vmax, Math.sqrt(2 * 5 * Math.max(0, toStop)));
        else if (c.plan !== 'S') {
          const toArc = (nodeC - c.dir * BOX - c.pos) * c.dir;
          const vt = c.plan === 'N' ? 4.6 : 6.4;
          vmax = Math.min(vmax, Math.sqrt(vt * vt + 2 * 3 * Math.max(0, toArc)));
        }
        const prev = c.speed;
        c.speed = c.speed < vmax ? Math.min(vmax, c.speed + ACCEL * dt) : Math.max(vmax, c.speed - BRAKE * dt);
        c.brake = c.speed < prev - 0.01 || c.speed < 0.3 ? 1 : Math.max(0, c.brake - dt * 3);
        let step = c.speed * dt;
        if (c.committed !== node && step > toStop) { step = Math.max(0, toStop); c.speed = 0; }
        c.pos += c.dir * step;
        // turn starts at the box edge
        if (c.committed === node && c.plan !== 'S' && (c.pos - (nodeC - c.dir * BOX)) * c.dir >= 0) {
          const over = (c.pos - (nodeC - c.dir * BOX)) * c.dir;
          this.startTurn(c);
          c.arcS = over;
        } else if (c.committed === node && c.plan === 'S' && (c.pos - nodeC) * c.dir >= 0) {
          // through the centre: the next junction comes up
          c.next += c.dir;
          c.committed = -1;
          if (c.next < 0 || c.next >= this.n) { c.next -= c.dir; c.dir = (-c.dir) as 1 | -1; } // safety (never planned)
          this.choosePlan(c);
        }
        // leave the box: release it once the rear is out
        if (c.occupy >= 0 && c.mode === 'lane' && c.committed !== c.occupy) {
          const ox = Math.floor(c.occupy / this.n), oz = c.occupy % this.n;
          const centre = c.axis === 0 ? this.rc[ox] : this.rc[oz];
          if ((c.pos - centre) * c.dir - c.len / 2 > BOX) this.release(c);
        }
        if (c.mode === 'lane') this.place(c);
      }
      if (c.mode === 'turn') {
        const vt = c.r < BOX ? 4.6 : 6.4;
        vmax = Math.min(vmax, vt);
        const prev = c.speed;
        c.speed = c.speed < vmax ? Math.min(vmax, c.speed + ACCEL * dt) : Math.max(vmax, c.speed - BRAKE * dt);
        c.brake = c.speed < prev - 0.01 || c.speed < 0.3 ? 1 : Math.max(0, c.brake - dt * 3);
        c.arcS += c.speed * dt;
        if (c.arcS >= c.arcLen) {
          const over = c.arcS - c.arcLen;
          this.finishTurn(c);
          c.pos += c.dir * over;
          this.place(c);
        } else {
          const a = c.a0 + c.sweep * (c.arcS / c.arcLen);
          c.x = c.ox + Math.cos(a) * c.r;
          c.z = c.oz + Math.sin(a) * c.r;
          const s = Math.sign(c.sweep);
          c.fx = -Math.sin(a) * s;
          c.fz = Math.cos(a) * s;
        }
      }
    }
  }

  // ----------------------------------------------------------------------------------------------------------------
  // hover-vans
  // ----------------------------------------------------------------------------------------------------------------

  private updateVans(dt: number): void {
    const half = this.half;
    this.rushClock += dt;
    const cross = this.rushLines.length === 2 ? { x: this.rushLines.find((l) => l.axis === 1)!.line, z: this.rushLines.find((l) => l.axis === 0)!.line } : null;
    const EDGE = 6.4; // centre distance at which a van touches the shared crossing box
    const counts = [0, 0];
    for (const v of this.vans) if (v.res) counts[v.axis]++;
    for (const v of this.vans) {
      let live = this.rushTarget > 0 && this.rushClock > v.delay;
      if (live && !v.started) {
        // enter only when the lane mouth is clear of the van that went before
        if (this.vans.some((o) => o !== v && o.started && o.axis === v.axis && o.dir === v.dir && o.line === v.line && Math.abs(o.pos - v.pos) < 9)) { v.delay = this.rushClock + 0.25; live = false; }
        else v.started = true;
      }
      if (!live) { v.pos = -v.dir * (half + 4); v.res = false; v.hold = false; v.speed = v.cruise; continue; }
      let vmax = v.cruise;
      // the van ahead in the same lane
      for (const o of this.vans) {
        if (o === v || o.axis !== v.axis || o.dir !== v.dir || o.line !== v.line || !o.started) continue;
        const gap = (o.pos - v.pos) * v.dir - 4.7;
        if (gap > 0 && gap < 40) vmax = Math.min(vmax, Math.max(0, Math.sqrt(2 * 6 * Math.max(0, gap - 3)), gap > 3 ? o.speed : 0));
        else if (gap > -4.7 && gap <= 0 && (o.pos - v.pos) * v.dir > 0) vmax = 0;
      }
      if (cross) {
        const c = v.axis === 0 ? cross.x : cross.z;
        const d = (c - v.pos) * v.dir; // + before the crossing centre
        const inBox = Math.abs(d) < EDGE;
        if (v.res && d < -EDGE) { v.res = false; counts[v.axis]--; }
        if (!v.res && d > -EDGE && d < EDGE + 14) {
          const other = 1 - v.axis;
          if (inBox || (counts[other] === 0 && (this.turn < 0 || this.turn === v.axis))) {
            v.res = true; counts[v.axis]++; v.hold = false;
            if (this.turn === v.axis) this.turn = -1;
          } else {
            v.hold = true;
            if (this.turn < 0) this.turn = v.axis;
            vmax = Math.min(vmax, Math.sqrt(2 * 9 * Math.max(0, d - EDGE - 0.4)));
          }
        }
      }
      v.speed = v.speed < vmax ? Math.min(vmax, v.speed + 5 * dt) : Math.max(vmax, v.speed - 12 * dt);
      if (v.hold && cross) {
        const c = v.axis === 0 ? cross.x : cross.z;
        const d = (c - v.pos) * v.dir;
        const step = Math.min(v.speed * dt, Math.max(0, d - EDGE - 0.3));
        v.pos += v.dir * step;
        if (step < v.speed * dt) v.speed = 0;
      } else v.pos += v.dir * v.speed * dt;
      if (v.pos > half + 6 || v.pos < -half - 6) {
        v.pos -= Math.sign(v.pos) * (half * 2 + 12);
        if (v.res) { v.res = false; counts[v.axis]--; }
        // re-enter behind the last van still near the entry
        for (const o of this.vans) if (o !== v && o.started && o.axis === v.axis && o.dir === v.dir && o.line === v.line && Math.abs(o.pos - v.pos) < 9) v.pos = o.pos - v.dir * 9;
      }
      v.bob += dt * 2.2;
    }
  }

  setRush(on: boolean): void {
    this.rushTarget = on ? 1 : 0;
    this.rushClock = 0;
    this.turn = -1;
    this.target = on ? this.rushCount : this.baseCount;
    this.vans.forEach((v, i) => { v.pos = -v.dir * (this.half + 4); v.res = false; v.hold = false; v.started = false; v.speed = v.cruise; v.delay = this.baseDelay[i]; });
    this.write();
  }

  vanLive(v: Van): boolean { return this.rushTarget > 0 && this.rushClock > v.delay && v.started; }

  /**
   * Round 19 rule, unchanged: rush-hour vans give a draft. True when the drone is 2 to 10 m behind a live van, in line with
   * it (within 2.2 m sideways, 1.2 to 5.5 m up) and flying its way at 8 m/s or more. Vans never collide.
   */
  vanDraft(p: THREE.Vector3, vx: number, vz: number): boolean {
    if (this.rushTarget <= 0) return false;
    for (const v of this.vans) {
      if (!this.vanLive(v)) continue;
      const along = v.axis === 0 ? (p.x - v.pos) * v.dir : (p.z - v.pos) * v.dir; // + ahead of the van
      const side = v.axis === 0 ? p.z - (v.line + v.lane) : p.x - (v.line - v.lane);
      const vel = (v.axis === 0 ? vx : vz) * v.dir;
      if (along < -10 || along > -2 || Math.abs(side) > 2.2 || p.y < 1.2 || p.y > 5.5 || vel < 8) continue;
      return true;
    }
    return false;
  }

  vanPositions(): Array<{ x: number; y: number; z: number; dx: number; dz: number }> {
    if (this.rushTarget <= 0) return [];
    return this.vans.filter((v) => this.vanLive(v)).map((v) => v.axis === 0
      ? { x: v.pos, y: 3.1, z: v.line + v.lane, dx: v.dir, dz: 0 }
      : { x: v.line - v.lane, y: 3.1, z: v.pos, dx: 0, dz: v.dir });
  }

  // ----------------------------------------------------------------------------------------------------------------

  update(dt: number, cam: THREE.Vector3): void {
    if (dt <= 0) return;
    this.clock += dt;
    this.updateCars(Math.min(dt, 0.1), cam);
    if (this.vans.length && (this.rushTarget > 0 || this.rushClock === 0)) this.updateVans(Math.min(dt, 0.1));
    this.write();
  }

  /** Writes the live vehicles into the instance buffers (compacted, so empty slots cost nothing). */
  private write(): void {
    let k = 0;
    const info = this.iinfo.array as Float32Array;
    for (const c of this.cars) {
      if (!c.active) continue;
      this.q.setFromAxisAngle(this.up, Math.atan2(c.fx, c.fz));
      this.m.compose(this.v.set(c.x, 0, c.z), this.q, this.s1);
      this.mesh.setMatrixAt(k, this.m);
      this.mesh.setColorAt(k, c.color);
      info[k * 2] = c.type; info[k * 2 + 1] = c.brake;
      k++;
    }
    for (const v of this.vans) {
      if (!this.vanLive(v)) continue;
      const y = 3.1 + Math.sin(v.bob) * 0.15;
      if (v.axis === 0) { this.v.set(v.pos, y, v.line + v.lane); this.q.setFromAxisAngle(this.up, v.dir > 0 ? Math.PI / 2 : -Math.PI / 2); }
      else { this.v.set(v.line - v.lane, y, v.pos); this.q.setFromAxisAngle(this.up, v.dir > 0 ? 0 : Math.PI); }
      this.m.compose(this.v, this.q, this.s1);
      this.mesh.setMatrixAt(k, this.m);
      this.mesh.setColorAt(k, v.color);
      info[k * 2] = VT.hover; info[k * 2 + 1] = v.hold || v.speed < v.cruise - 2 ? 1 : 0;
      k++;
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
    this.iinfo.needsUpdate = true;
  }

  /** Test hook: every live vehicle as an oriented box. */
  snapshot(): VehicleInfo[] {
    const out: VehicleInfo[] = [];
    for (const c of this.cars) {
      if (!c.active) continue;
      // distance from the lane centre (lane mode) or from the arc (turn): both 0 by construction, measured anyway
      let lat = 0;
      if (c.mode === 'lane') lat = c.axis === 0 ? Math.abs(c.z - (this.rc[c.line] + c.dir * LANE)) : Math.abs(c.x - (this.rc[c.line] - c.dir * LANE));
      else lat = Math.abs(Math.hypot(c.x - c.ox, c.z - c.oz) - c.r);
      out.push({ kind: 'car', type: c.type, x: c.x, y: 0, z: c.z, fx: c.fx, fz: c.fz, len: c.len, wid: c.wid, y0: 0, y1: c.hgt, mode: c.mode, lat, axis: c.axis });
    }
    for (const v of this.vans) {
      if (!this.vanLive(v)) continue;
      const y = 3.1 + Math.sin(v.bob) * 0.15;
      const p = v.axis === 0 ? { x: v.pos, z: v.line + v.lane, fx: v.dir, fz: 0 } : { x: v.line - v.lane, z: v.pos, fx: 0, fz: v.dir };
      out.push({ kind: 'van', type: VT.hover, x: p.x, y, z: p.z, fx: p.fx, fz: p.fz, len: 4.7, wid: 2.12, y0: y - 0.74, y1: y + 0.87, mode: v.hold ? 'hold' : 'lane', lat: 0, axis: v.axis });
    }
    return out;
  }

  stats(): { cars: number; target: number; vans: number; held: number; braking: number; turning: number } {
    let cars = 0, braking = 0, turning = 0;
    for (const c of this.cars) if (c.active) { cars++; if (c.speed < 0.5) braking++; if (c.mode === 'turn') turning++; }
    return { cars, target: this.target, vans: this.vans.filter((v) => this.vanLive(v)).length, held: this.vans.filter((v) => v.hold).length, braking, turning };
  }

}
