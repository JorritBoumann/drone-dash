import * as THREE from 'three';
import { CAMERA, FLIGHT } from '../game/config';
import type { Drone } from '../entities/Drone';
import type { CollisionWorld } from './CollisionWorld';
import type { ViewIntent } from '../core/InputController';

const ZOOM_KEY = 'drone-dash-cam-zoom';
/** Round 21: player orbit and zoom limits. */
const ORBIT = {
  minElev: 0.06, // rad: lowest camera elevation over the drone (just above level, never under it)
  maxElev: 1.2, // rad: highest (steep look down, never over the top)
  zoomMin: -0.45, // log of the chase distance factor: x0.64 (about 4 m behind)
  zoomMax: 0.55, // x1.73 (about 11 m behind)
  follow: 16, // 1/s: offsets chase the input this fast (smooths discrete mouse / wheel steps)
  hold: 0.4, // s: after the player lets go, the view stays put this long...
  ease: 7.5, // 1/s: ...then eases back behind the drone (within 2 degrees about 1.2 s after release)
};

/**
 * Round 23: a straight alley or tunnel the camera knows the bounds of. Walls run along `axis` from `a0` to `a1`, the
 * corridor's centre line sits at `c` across it, `hw` is half its clear width. Tunnels have a bridge whose underside is at
 * `roofY` (Infinity for an open alley).
 */
export type CamCorridor = { axis: 'x' | 'z'; c: number; hw: number; a0: number; a1: number; roofY: number };
/** Round 23: tunnel and alley framing. */
const CORRIDOR = {
  reach: 9, // m past each mouth along the axis where the framing already (or still) applies
  dist: 5.2, // m behind the drone (times the zoom factor, clamped below)
  minDist: 4.2,
  maxDist: 6.6,
  minAlong: 3.6, // m: the camera never comes closer than this along the corridor
  height: 1.6, // m above the drone
  wallMargin: 1.15, // m kept from each wall
  roofMargin: 1.0, // m kept under the bridge
  yawRange: 0.42, // rad of player orbit allowed inside (the rest waits until the drone is out)
  blendIn: 3.2, // 1/s
  blendOut: 1.8,
};
/**
 * Round 23: clearance the camera's line of sight keeps from walls (was 0.5). A thinner probe lets the camera stay behind
 * the drone in narrow gaps between buildings instead of collapsing onto it; the push-out (0.3) still keeps the near plane
 * out of walls.
 */
const CAM_PAD = 0.34;
/** Round 23: sideways (m) and upward (m) nudges tried when the line of sight to the ideal is blocked near the drone. */
const CAND: Array<[number, number]> = [[0.3, 0], [-0.3, 0], [0.6, 0], [-0.6, 0], [1.0, 0], [-1.0, 0], [0, 1.5], [0, 3]];
/** Round 23: orbit angles (rad) swept out from straight behind the drone to find how far the view can swing clear. */
const YAW_STEPS = [0.12, 0.25, 0.4, 0.6, 0.85, 1.15, 1.5, 2.0, 2.6, 3.2];
/**
 * Round 25: open-street swing. When the view straight behind a slow drone is blocked within `need` m (a pad beside a
 * wall, the drone turned to face away from a facade), the camera swings round the drone (at most `maxYaw`) to the nearest
 * angle with clear room instead of being pulled in until the drone fills the screen. Not in alleys or tunnels (their own
 * framing) and not above `maxSpeed` (the view stays behind the heading). CameraRig.keepRoom is the hard floor.
 */
const SWING = { need: 3.2, keep: 2.6, rate: 3.2, hold: 0.9, back: 1.4, minDist: 2.4, slowDist: 4.2, maxYaw: 0.6, maxSpeed: 6 };
/** Round 23: the camera never moves more than this relative to the drone in one frame (no pull-in snaps). */
const MAX_REL_STEP = 1.7;
/** Round 26: the drone's centre is kept inside these normalised screen bounds (y up; -1 is the bottom edge). */
const FRAME = { bottom: -0.45, top: 0.6, side: 0.8 };

/** Chase camera with positional lag, yaw lag, FOV kick on boost, collision pull-in and impact shake. */
export class CameraRig {
  private yaw = 0;
  private readonly ideal = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly lookSmoothed = new THREE.Vector3();
  private readonly anchor = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private shake = 0;
  private time = 0;
  private fov: number = CAMERA.fov;
  private orbit = 0;
  private approach = 0; // 0..1, smoothed: how much the final-approach framing applies
  private lift = 0; // extra height when the view is blocked, so the camera rises over walls instead of crowding the drone
  // round 21: player orbit (offsets from the chase view) and zoom
  private viewYaw = 0;
  private viewPitch = 0;
  private wantYaw = 0;
  private wantPitch = 0;
  private zoom = 0;
  private wantZoom = 0;
  private viewIdle = 99; // s since the last orbit input or drag
  private free = 0; // 0..1: how much the player is steering the view (blends out the auto approach framing)
  private zoomDirty = false;
  private zoomIdle = 0;
  // round 23: corridor framing
  private corridors: CamCorridor[] = [];
  private cor: CamCorridor | null = null;
  private corW = 0; // 0..1 smoothed weight of the corridor framing
  private corSign = 1; // which way along the corridor the camera sits (hysteresis when the view swings across)
  private readonly lastRel = new THREE.Vector3();
  private relValid = false;
  private readonly idealDir = new THREE.Vector3();
  private yawUse = 0;
  private yawHeld = 0; // round 23: the orbit yaw actually used (the player's, held back where it would swing into a wall)
  private swing = 0; // round 25: automatic swing (rad) away from a wall right behind the drone in an open street
  private swingWant = 0;
  private swingIdle = 99; // s since the swing was last needed
  private swingSearch = 0; // s until the blocked view may search for a new swing angle again (the sweep is not per frame)

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    try {
      const z = Number(localStorage.getItem(ZOOM_KEY));
      if (Number.isFinite(z)) this.zoom = this.wantZoom = THREE.MathUtils.clamp(z, ORBIT.zoomMin, ORBIT.zoomMax);
    } catch {
      /* storage blocked */
    }
  }

  /** Round 21: orbit state for diagnostics and probes. */
  get view(): { yaw: number; pitch: number; zoom: number; free: number; idle: number; distance: number } {
    return { yaw: this.viewYaw, pitch: this.viewPitch, zoom: this.zoom, free: this.free, idle: this.viewIdle, distance: Math.exp(this.zoom) * CAMERA.distance };
  }

  /** Round 23: the city's straight alleys and tunnels (bounds known in advance, no per-frame probing needed). */
  setCorridors(list: CamCorridor[]): void {
    this.corridors = list;
    this.cor = null;
    this.corW = 0;
  }

  /** Round 23: corridor framing weight (diagnostics). */
  get corridor(): { w: number; axis: string; roof: boolean } {
    return { w: this.corW, axis: this.cor ? this.cor.axis : '', roof: !!this.cor && Number.isFinite(this.cor.roofY) };
  }

  /** The corridor the drone is in, or about to enter / just left along its axis. */
  private findCorridor(drone: Drone): CamCorridor | null {
    const p = drone.group.position;
    const hx = -Math.sin(drone.yaw), hz = -Math.cos(drone.yaw);
    for (const C of this.corridors) {
      const along = C.axis === 'x' ? p.x : p.z, lat = C.axis === 'x' ? p.z : p.x;
      if (Math.abs(lat - C.c) > C.hw + 0.4) continue;
      if (p.y > (Number.isFinite(C.roofY) ? C.roofY - 0.3 : 11)) continue;
      if (along > C.a0 && along < C.a1) return C;
      // outside a mouth: only while flying along the corridor (not when crossing past the mouth on the street)
      if (along > C.a0 - CORRIDOR.reach && along < C.a1 + CORRIDOR.reach && Math.abs(C.axis === 'x' ? hx : hz) > 0.7) return C;
    }
    return null;
  }

  /** Drop any orbit offset (new run). The zoom stays. */
  resetView(): void {
    this.viewYaw = this.viewPitch = this.wantYaw = this.wantPitch = 0;
    this.yawUse = this.yawHeld = 0;
    this.viewIdle = 99;
    this.free = 0;
    this.swing = this.swingWant = 0;
    this.swingIdle = 99;
  }

  private applyView(v: ViewIntent | null, dt: number): void {
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    if (v) {
      if (v.yaw !== 0 || v.pitch !== 0 || v.held) this.viewIdle = 0;
      this.wantYaw = wrap(this.wantYaw + v.yaw);
      this.wantPitch += v.pitch;
      if (v.zoom !== 0) {
        this.wantZoom = THREE.MathUtils.clamp(this.wantZoom + v.zoom, ORBIT.zoomMin, ORBIT.zoomMax);
        this.zoomDirty = true;
        this.zoomIdle = 0;
      }
    }
    this.viewIdle += dt;
    const held = !!v?.held;
    if (!held && this.viewIdle > ORBIT.hold) {
      // ease back behind the drone (rate ramps in so the return starts gently)
      const rate = ORBIT.ease * THREE.MathUtils.smoothstep(this.viewIdle, ORBIT.hold, ORBIT.hold + 0.3);
      const f = Math.exp(-rate * dt);
      this.wantYaw *= f;
      this.wantPitch *= f;
    }
    const k = 1 - Math.exp(-ORBIT.follow * dt);
    this.viewYaw = wrap(this.viewYaw + wrap(this.wantYaw - this.viewYaw) * k);
    this.viewPitch += (this.wantPitch - this.viewPitch) * k;
    if (Math.abs(this.viewYaw) + Math.abs(this.wantYaw) < 2e-4) this.viewYaw = this.wantYaw = 0;
    if (Math.abs(this.viewPitch) + Math.abs(this.wantPitch) < 2e-4) this.viewPitch = this.wantPitch = 0;
    this.zoom += (this.wantZoom - this.zoom) * (1 - Math.exp(-10 * dt));
    this.free = Math.min(1, Math.max(held ? 1 : 0, Math.abs(this.viewYaw) / 0.35, Math.abs(this.viewPitch) / 0.2));
    if (this.zoomDirty && (this.zoomIdle += dt) > 0.6) {
      this.zoomDirty = false;
      try {
        localStorage.setItem(ZOOM_KEY, this.wantZoom.toFixed(3));
      } catch {
        /* storage blocked */
      }
    }
  }

  snapTo(drone: Drone): void {
    this.yaw = drone.yaw;
    this.approach = 0;
    this.resetView();
    this.zoom = this.wantZoom;
    this.yawUse = this.yawHeld = 0;
    this.computeIdeal(drone, 0);
    this.camera.position.copy(this.ideal);
    this.lookSmoothed.copy(this.look);
    this.camera.lookAt(this.lookSmoothed);
    this.relValid = false;
  }

  addShake(amount: number): void {
    this.shake = Math.min(1, this.shake + amount);
  }

  private computeIdeal(drone: Drone, speedFactor: number, alt = 0, target: THREE.Vector3 | null = null): void {
    // round 21: the player's orbit turns the chase view around the drone; heading still follows the drone
    const yaw = this.yaw + this.yawUse;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const p = drone.group.position;
    // the automatic final-approach framing gives way while the player steers the view
    const ap = target ? this.approach * (1 - this.free) : 0;
    // never further than CAMERA.maxDistance so the drone stays readable at speed;
    // on the final approach the camera pulls in a little and rises to look down over roof edges
    const z = Math.exp(this.zoom);
    let dist = Math.min(CAMERA.maxDistance, CAMERA.distance + speedFactor * 1.0 + (drone.boosting ? 0.8 : 0)) * (1 - CAMERA.approachPullIn * ap) * z;
    const vy = THREE.MathUtils.clamp(drone.velocity.y / FLIGHT.climbSpeed, -1, 1);
    // higher up -> camera rises and pitches down so the city stays in frame
    let height = (Math.min(CAMERA.maxHeight, CAMERA.height + CAMERA.heightPerAlt * alt) + CAMERA.approachRise * ap) * z;
    if (this.viewPitch !== 0 || this.wantPitch !== 0) {
      // orbit pitch: swing the camera up or down around the drone at the same range, clamped so it never goes
      // under the drone's level or over the top
      const e0 = Math.atan2(height, dist);
      this.wantPitch = THREE.MathUtils.clamp(this.wantPitch, ORBIT.minElev - e0, ORBIT.maxElev - e0);
      const e = THREE.MathUtils.clamp(e0 + this.viewPitch, ORBIT.minElev, ORBIT.maxElev);
      const r = Math.hypot(height, dist);
      dist = r * Math.cos(e);
      height = r * Math.sin(e);
    }
    this.ideal.set(p.x - fx * dist, p.y + height - vy * 0.9 + this.lift, p.z - fz * dist);
    if (this.cor && this.corW > 0.001) this.blendCorridor(this.cor, this.corW, p, z, vy);
    let lookY = p.y + 0.7 + vy * 0.8 - Math.min(5, alt * 0.06);
    if (target) {
      const below = p.y - target.y;
      const hd = Math.hypot(target.x - p.x, target.z - p.z);
      if (below > 4 && hd > 20) lookY -= Math.min(6, below * 0.12);
    }
    const lookH = dist + CAMERA.lookAhead;
    if (target && ap > 0.001) {
      // Pitch down until the pad sits in the lower part of the frame, but never so far that the drone
      // leaves the top of it. Only pitch changes; the heading still follows the drone.
      const c = this.ideal;
      const half = THREE.MathUtils.degToRad(this.fov) / 2;
      const basePitch = Math.atan2(c.y - lookY, lookH);
      const pitchT = Math.atan2(c.y - (target.y + 1.2), Math.max(0.5, Math.hypot(target.x - c.x, target.z - c.z)));
      const pitchD = Math.atan2(c.y - p.y, dist);
      let want = Math.max(basePitch, pitchT - half * 0.3);
      want = Math.min(want, pitchD + half * 0.72, 1.4);
      const pitch = basePitch + Math.max(0, want - basePitch) * ap;
      lookY = c.y - Math.tan(pitch) * lookH;
    }
    this.look.set(p.x + fx * CAMERA.lookAhead, lookY, p.z + fz * CAMERA.lookAhead);
  }

  /**
   * Round 23: inside (or at the mouth of) an alley or tunnel the camera sits low and a little behind the drone on the
   * corridor's own axis, kept off the walls and under the bridge by the corridor's known bounds. The player's orbit
   * still works but over a narrower range, so the view never swings into a wall and has to snap back in.
   */
  private blendCorridor(C: CamCorridor, w: number, p: THREE.Vector3, zf: number, vy: number): void {
    const X = C.axis === 'x';
    const yawC = this.yaw + THREE.MathUtils.clamp(this.yawUse, -CORRIDOR.yawRange, CORRIDOR.yawRange);
    const bx = Math.sin(yawC), bz = Math.cos(yawC); // from the drone back to the camera
    const d = THREE.MathUtils.clamp(CORRIDOR.dist * zf, CORRIDOR.minDist, CORRIDOR.maxDist);
    let a = (X ? bx : bz) * d;
    const l = (X ? bz : bx) * d;
    // which end of the corridor the camera sits at: flips only once the view has clearly swung round
    if (a > 1.2) this.corSign = 1;
    else if (a < -1.2) this.corSign = -1;
    if (Math.abs(a) < CORRIDOR.minAlong || Math.sign(a) !== this.corSign) a = this.corSign * Math.max(CORRIDOR.minAlong, Math.abs(a));
    const pa = X ? p.x : p.z, pl = X ? p.z : p.x;
    const room = Math.max(0, C.hw - CORRIDOR.wallMargin);
    const lat = THREE.MathUtils.clamp(pl + l, C.c - room, C.c + room);
    const pitch = THREE.MathUtils.clamp(this.viewPitch, -0.25, 0.6);
    let y = p.y + THREE.MathUtils.clamp(CORRIDOR.height * Math.min(1.3, zf) + pitch * 3, 0.5, 3.4) - vy * 0.5;
    if (Number.isFinite(C.roofY)) y = Math.min(y, C.roofY - CORRIDOR.roofMargin);
    y = Math.max(y, 0.9);
    const cx = X ? pa + a : lat, cz = X ? lat : pa + a;
    this.ideal.x += (cx - this.ideal.x) * w;
    this.ideal.y += (y - this.ideal.y) * w;
    this.ideal.z += (cz - this.ideal.z) * w;
  }

  private readonly cand = new THREE.Vector3();
  private readonly best = new THREE.Vector3();
  private readonly frameV = new THREE.Vector3();
  /** Round 26: seconds left of the wide camera floor after a pickup or drop (Game calls holdRoom). */
  private roomHold = 0;
  /** Round 28: scale of the slow-drone room floor (1 on desktop, more on touch screens; Game sets it). */
  touchRoom = 1;
  holdRoom(seconds: number): void {
    this.roomHold = Math.max(this.roomHold, seconds);
  }
  private readonly frameLook = new THREE.Vector3();
  /**
   * Round 23: pull the ideal in to where the line of sight from the drone is clear. When that line is blocked close to
   * the drone (a narrow gap between buildings, a corner), small sideways and upward nudges of the ideal are tried too and
   * the one with the most clear room wins, so the camera finds the gap instead of collapsing onto the drone.
   */
  private clipIdeal(world: CollisionWorld): number {
    return this.findClear(world, this.ideal, this.ideal);
  }

  /** Room (m) of clear line of sight from the drone toward `to` (or a nudge of it); `out` gets the pulled-in point. */
  private findClear(world: CollisionWorld, to: THREE.Vector3, out: THREE.Vector3): number {
    const A = this.anchor;
    this.idealDir.copy(to).sub(A);
    const len = this.idealDir.length();
    if (len < 1e-4) { out.copy(to); return 0; }
    const f0 = world.segmentFraction(A, to, CAM_PAD, false);
    if (f0 >= 1) { out.copy(to); return len; }
    let bestRoom = f0 * len, bestScore = bestRoom;
    this.best.copy(to);
    if (bestRoom < len * 0.75) {
      // right vector across the line of sight (horizontal)
      const rx = -this.idealDir.z, rz = this.idealDir.x, rl = Math.hypot(rx, rz) || 1;
      for (const pad of [CAM_PAD, 0.2]) {
        for (const [sd, u] of CAND) {
          this.cand.set(to.x + (rx / rl) * sd, to.y + u, to.z + (rz / rl) * sd);
          const L = this.cand.distanceTo(A);
          const room = world.segmentFraction(A, this.cand, pad, false) * L;
          const score = room - 0.5 * Math.abs(sd) - 0.25 * u;
          if (score > bestScore + 0.05) { bestScore = score; bestRoom = room; this.best.copy(this.cand); }
        }
        if (bestRoom > 2.6) break;
      }
    }
    this.idealDir.copy(this.best).sub(A);
    const L = this.idealDir.length();
    const keep = Math.min(L, Math.max(0.9, bestRoom - 0.15));
    out.copy(A).addScaledVector(this.idealDir, keep / L);
    return bestRoom;
  }

  /**
   * Round 25: swing the chase view round the drone when a wall sits right behind it in an open street. The plain view
   * (no swing) is tested first; while it has room the swing eases back to 0 after a short hold. Otherwise the nearest
   * yaw (either side, smallest first) with `SWING.need` m of clear room becomes the target, and the swing chases it.
   */
  private updateSwing(dt: number, drone: Drone, world: CollisionWorld, speedFactor: number, alt: number, target: THREE.Vector3 | null): void {
    if (this.corW > 0.05 || this.free > 0.3 || drone.speed > SWING.maxSpeed) {
      // corridor framing, the player's own orbit, or flying on at speed (the view stays behind the heading; the
      // distance floor in keepRoom handles a wall there): no automatic swing (it fades out)
      this.swingWant = 0;
      this.swingIdle = 99;
    } else {
      const base = this.yawUse;
      const len0 = this.ideal.distanceTo(this.anchor);
      const need = Math.min(SWING.need, len0 * 0.9);
      const room0 = this.findClear(world, this.ideal, this.cand);
      if (room0 >= (this.swing !== 0 ? need : SWING.keep)) {
        this.swingIdle += dt;
        if (this.swingIdle > SWING.hold) this.swingWant = 0;
      } else if ((this.swingSearch -= dt) <= 0) {
        this.swingSearch = 0.1;
        this.swingIdle = 0;
        // keep the current side while it still works, else the nearest clear angle on either side
        // the nearest angle with the full chase room wins; failing that, the nearest with `need` m of room
        let found = 0, fallback = 0;
        const pref = Math.sign(this.swing || this.swingWant) || 1;
        outer: for (const step of YAW_STEPS) {
          if (step > SWING.maxYaw) break;
          for (const sg of [pref, -pref]) {
            this.yawUse = base + sg * step;
            this.computeIdeal(drone, speedFactor, alt, target);
            const L = this.ideal.distanceTo(this.anchor);
            const room = this.findClear(world, this.ideal, this.cand);
            if (room >= L * 0.85) { found = sg * step; break outer; }
            if (fallback === 0 && room >= Math.min(need, L * 0.9)) fallback = sg * step;
          }
        }
        if (found !== 0 || fallback !== 0) this.swingWant = found || fallback;
      } else this.swingIdle = 0;
      this.yawUse = base;
    }
    const k = 1 - Math.exp(-(this.swingWant === 0 ? SWING.back : SWING.rate) * dt);
    this.swing += (this.swingWant - this.swing) * k;
    if (Math.abs(this.swing) < 1e-3 && this.swingWant === 0) this.swing = 0;
    // the ideal at the swung angle (or back at the plain one after the search loop moved it)
    const base = this.yawUse;
    this.yawUse = base + this.swing;
    this.computeIdeal(drone, speedFactor, alt, target);
    this.yawUse = base;
  }

  private keepRoom(world: CollisionWorld, drone: Drone): void {
    const cam = this.camera.position, dp = drone.group.position;
    const rel = this.tmp.copy(cam).sub(dp);
    const L = rel.length();
    // round 26: a slow drone (at a pad, right after a pickup or drop) gets more room: at 2.4 m beside a wall it filled
    // half a phone screen. Full `slowDist` at or below 4 m/s, the plain floor from 9 m/s.
    // Round 26b: and for `roomHold` s after a pickup or a drop, whatever the speed (the drone accelerates away from the pad).
    // Round 28: on a phone (narrower view) the slow floor is wider still: 4.2 m from close above filled up to 74% of
    // the screen height after a pickup beside a wall.
    const slow = SWING.slowDist * this.touchRoom;
    const want = this.roomHold > 0 ? slow : THREE.MathUtils.lerp(slow, SWING.minDist, THREE.MathUtils.smoothstep(drone.speed, 4, 9));
    if (L >= want) return;
    if (L > 0.05) {
      this.cand.copy(dp).addScaledVector(rel, want / L);
      if (world.segmentFraction(dp, this.cand, 0.2, false) >= 1 && !world.pushOutPoint(this.best.copy(this.cand), 0.3)) { cam.copy(this.cand); return; }
    }
    // rise: mostly up, a little back along the current horizontal direction (or behind the drone's heading)
    let hx = rel.x, hz = rel.z;
    const hl = Math.hypot(hx, hz);
    if (hl < 0.05) { hx = Math.sin(drone.yaw); hz = Math.cos(drone.yaw); } else { hx /= hl; hz /= hl; }
    for (const [back, up] of [[0.9, want * 0.95], [0.4, want * 1.1], [0, want * 1.2]]) {
      this.cand.set(dp.x + hx * back, dp.y + up, dp.z + hz * back);
      if (world.segmentFraction(dp, this.cand, 0.2, false) >= 1 && !world.pushOutPoint(this.best.copy(this.cand), 0.3)) {
        // blend toward it so a rise is a quick glide, not a cut (the floor below still holds next frame)
        cam.lerp(this.cand, 0.5);
        if (cam.distanceTo(dp) < want * 0.9) cam.copy(this.cand);
        return;
      }
    }
  }

  /**
   * Round 26: the drone stays in frame. When the camera has risen over the drone (its floor beside a wall, a pad
   * approach), the look point ahead could leave the drone at or under the bottom edge. Then the look point blends toward
   * the drone, just enough to keep it inside FRAME (normalised screen units).
   */
  private keepInFrame(dp: THREE.Vector3): void {
    const cam = this.camera;
    const inside = (): boolean => {
      cam.updateMatrixWorld();
      const v = this.frameV.copy(dp).project(cam);
      return v.z < 1 && v.y > FRAME.bottom && v.y < FRAME.top && Math.abs(v.x) < FRAME.side;
    };
    if (inside()) return;
    let lo = 0, hi = 1;
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2;
      cam.lookAt(this.frameLook.copy(this.lookSmoothed).lerp(dp, mid));
      if (inside()) hi = mid;
      else lo = mid;
    }
    cam.lookAt(this.frameLook.copy(this.lookSmoothed).lerp(dp, hi));
    cam.updateMatrixWorld();
  }

  /** 0..1 weight of the final-approach framing: the target is close and below the drone. */
  private approachWeight(drone: Drone, target: THREE.Vector3 | null): number {
    if (!target) return 0;
    const p = drone.group.position;
    const hd = Math.hypot(target.x - p.x, target.z - p.z);
    const below = p.y - target.y;
    const near = THREE.MathUtils.smoothstep(CAMERA.approachStart - hd, 0, CAMERA.approachStart - CAMERA.approachFull);
    const low = THREE.MathUtils.smoothstep(below, 2, 6);
    return near * low;
  }

  update(dt: number, drone: Drone, world: CollisionWorld, alt = 0, target: THREE.Vector3 | null = null, view: ViewIntent | null = null): void {
    this.time += dt;
    this.roomHold = Math.max(0, this.roomHold - dt);
    this.applyView(view, dt);
    // yaw follows the drone heading with lag; shortest-arc
    let dy = drone.yaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * (1 - Math.exp(-CAMERA.yawLag * dt));

    const speedFactor = Math.min(1, drone.speed / FLIGHT.maxSpeed);
    const wantApproach = this.approachWeight(drone, target);
    this.approach += (wantApproach - this.approach) * (1 - Math.exp(-(wantApproach > this.approach ? 2.5 : 1.5) * dt));
    // round 23: alley / tunnel framing blends in and out smoothly
    const inCor = this.findCorridor(drone);
    if (inCor && inCor !== this.cor) {
      // the next alley or tunnel on the same line takes over at once; any other waits until the old framing has faded
      const sameLine = !!this.cor && this.cor.axis === inCor.axis && Math.abs(this.cor.c - inCor.c) < 0.5;
      if (sameLine || this.corW < 0.05) this.cor = inCor;
    }
    const wantCor = inCor && inCor === this.cor ? 1 : 0;
    this.corW += (wantCor - this.corW) * (1 - Math.exp(-(wantCor > this.corW ? CORRIDOR.blendIn : CORRIDOR.blendOut) * dt));
    if (this.corW < 0.01 && !inCor) { this.corW = 0; this.cor = null; }
    // round 23: an orbit that would swing the view into a wall is held back to the widest angle with a clear view
    this.anchor.copy(drone.group.position).y += 0.4;
    let yawWant = this.viewYaw;
    if (Math.abs(this.viewYaw) > 0.04) {
      // sweep out from straight behind toward the player's angle and stop at the first blocked step, so the view can
      // only reach angles it can get to without passing through a wall
      const sgn = Math.sign(this.viewYaw), full = Math.abs(this.viewYaw);
      let reach = 0;
      for (const step of YAW_STEPS) {
        const a = Math.min(step, full);
        this.yawUse = sgn * a;
        this.computeIdeal(drone, speedFactor, alt, target);
        const len = this.ideal.distanceTo(this.anchor);
        if (this.findClear(world, this.ideal, this.cand) < Math.min(len * 0.85, 3.4)) break;
        reach = a;
        if (a >= full) break;
      }
      const pick = full > 0 ? reach / full : 1;
      yawWant = this.viewYaw * pick;
    }
    const wrapA = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
    if (Math.abs(yawWant - this.viewYaw) < 1e-6 && Math.abs(wrapA(this.yawHeld - this.viewYaw)) < 0.02) this.yawHeld = this.viewYaw;
    else this.yawHeld = wrapA(this.yawHeld + wrapA(yawWant - this.yawHeld) * (1 - Math.exp(-(Math.abs(yawWant) < Math.abs(this.yawHeld) ? 14 : 5) * dt)));
    this.yawUse = this.yawHeld;
    this.computeIdeal(drone, speedFactor, alt, target);
    this.updateSwing(dt, drone, world, speedFactor, alt, target);
    const cam = this.camera;
    // round 23: aim the follow at a view the walls allow (the ideal pulled in by a spherecast), so the camera glides
    // in instead of being snapped in after it has swung behind a wall
    this.clipIdeal(world);
    // tighter follow while the player orbits, so the camera swings around the drone instead of cutting across it
    const k = 1 - Math.exp(-(CAMERA.followLag + 10 * this.free) * dt);
    cam.position.lerp(this.ideal, k);
    // never go below street level
    cam.position.y = Math.max(cam.position.y, 0.8);

    // pull in when a building blocks the view of the drone
    // spherecast (r=0.5) against solid geometry only; trees/lamps are hidden instead of pushing the camera
    const frac = world.segmentFraction(this.anchor, cam.position, 0.2, false);
    // (round 23: not in an alley or tunnel, where rising only drives the camera into the bridge and back in at the drone)
    const targetLift = frac < 0.85 ? (1 - frac) * 5 * (1 - this.corW) : 0;
    this.lift += (targetLift - this.lift) * (1 - Math.exp(-(targetLift > this.lift ? 3 : 1.2) * dt));
    if (frac < 1) {
      this.tmp.copy(cam.position).sub(this.anchor);
      const len = this.tmp.length();
      // round 25: in an open street the swing has found a clear angle: do not collapse onto the drone on the way there
      const floor = this.corW < 0.05 && this.swing !== 0 ? Math.min(SWING.minDist, len) : 0.9;
      const keep = Math.max(floor, frac * len - 0.1);
      if (len > 1e-4) cam.position.copy(this.anchor).addScaledVector(this.tmp, keep / len);
    }
    // round 23: limit how far the camera moves relative to the drone in one frame (skipped while it catches up from far,
    // after a teleport or the title orbit)
    const dp = drone.group.position;
    this.tmp.copy(cam.position).sub(dp);
    if (this.relValid && this.lastRel.length() < 18) {
      this.idealDir.copy(this.tmp).sub(this.lastRel);
      const step = this.idealDir.length();
      if (step > MAX_REL_STEP) {
        this.tmp.copy(this.lastRel).addScaledVector(this.idealDir, MAX_REL_STEP / step);
        cam.position.copy(dp).add(this.tmp);
      }
    }

    // round 25: in an open street the camera never closes in below SWING.minDist of the drone (after a delivery beside
    // a wall it used to dive to 1.3 m, so the drone filled the screen). It keeps its direction from the drone if that
    // line is clear; otherwise it rises over the drone, a little behind it.
    if (this.corW < 0.05) this.keepRoom(world, drone);

    this.lookSmoothed.lerp(this.look, 1 - Math.exp(-12 * dt));
    cam.lookAt(this.lookSmoothed);
    this.keepInFrame(drone.group.position);

    // impact shake
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.4);
      const s = this.shake * this.shake * 0.35;
      cam.position.x += Math.sin(this.time * 61) * s;
      cam.position.y += Math.sin(this.time * 47 + 1) * s;
      cam.rotation.z += Math.sin(this.time * 53) * s * 0.08;
    }
    // round 21: never inside a wall, or so close that the near plane cuts into it (an orbit can swing the camera
    // toward the wall the drone is hugging); the shake is applied first so it cannot push the camera in either
    if (world.pushOutPoint(cam.position, 0.3)) {
      cam.lookAt(this.lookSmoothed);
      this.keepInFrame(drone.group.position);
    }
    cam.position.y = Math.max(cam.position.y, 0.8);
    this.lastRel.copy(cam.position).sub(drone.group.position);
    this.relValid = true;

    const targetFov = Math.min(CAMERA.maxFov, (drone.boosting ? CAMERA.boostFov : CAMERA.fov) + speedFactor * CAMERA.speedFov);
    this.fov += (targetFov - this.fov) * (1 - Math.exp(-(drone.boosting ? 6 : 3) * dt));
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }

  /** Slow cinematic orbit (title / game over). */
  orbitAround(dt: number, target: THREE.Vector3, radius: number, height: number, speed: number): void {
    this.orbit += dt * speed;
    this.relValid = false;
    const cam = this.camera;
    const desired = this.tmp.set(target.x + Math.cos(this.orbit) * radius, target.y + height, target.z + Math.sin(this.orbit) * radius);
    cam.position.lerp(desired, 1 - Math.exp(-2.5 * dt));
    this.lookSmoothed.lerp(target, 1 - Math.exp(-4 * dt));
    cam.lookAt(this.lookSmoothed);
    this.fov += (CAMERA.fov - 4 - this.fov) * (1 - Math.exp(-2 * dt));
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
  }

  setOrbitAngle(a: number): void {
    this.orbit = a;
  }
}
