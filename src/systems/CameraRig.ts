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

  /** Drop any orbit offset (new run). The zoom stays. */
  resetView(): void {
    this.viewYaw = this.viewPitch = this.wantYaw = this.wantPitch = 0;
    this.viewIdle = 99;
    this.free = 0;
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
    this.computeIdeal(drone, 0);
    this.camera.position.copy(this.ideal);
    this.lookSmoothed.copy(this.look);
    this.camera.lookAt(this.lookSmoothed);
  }

  addShake(amount: number): void {
    this.shake = Math.min(1, this.shake + amount);
  }

  private computeIdeal(drone: Drone, speedFactor: number, alt = 0, target: THREE.Vector3 | null = null): void {
    // round 21: the player's orbit turns the chase view around the drone; heading still follows the drone
    const yaw = this.yaw + this.viewYaw;
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
    this.applyView(view, dt);
    // yaw follows the drone heading with lag; shortest-arc
    let dy = drone.yaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * (1 - Math.exp(-CAMERA.yawLag * dt));

    const speedFactor = Math.min(1, drone.speed / FLIGHT.maxSpeed);
    const wantApproach = this.approachWeight(drone, target);
    this.approach += (wantApproach - this.approach) * (1 - Math.exp(-(wantApproach > this.approach ? 2.5 : 1.5) * dt));
    this.computeIdeal(drone, speedFactor, alt, target);
    const cam = this.camera;
    // tighter follow while the player orbits, so the camera swings around the drone instead of cutting across it
    const k = 1 - Math.exp(-(CAMERA.followLag + 10 * this.free) * dt);
    cam.position.lerp(this.ideal, k);
    // never go below street level
    cam.position.y = Math.max(cam.position.y, 0.8);

    // pull in when a building blocks the view of the drone
    this.anchor.copy(drone.group.position).y += 0.4;
    // spherecast (r=0.5) against solid geometry only; trees/lamps are hidden instead of pushing the camera
    const frac = world.segmentFraction(this.anchor, cam.position, 0.5, false);
    const targetLift = frac < 0.85 ? (1 - frac) * 5 : 0;
    this.lift += (targetLift - this.lift) * (1 - Math.exp(-(targetLift > this.lift ? 3 : 1.2) * dt));
    if (frac < 1) {
      this.tmp.copy(cam.position).sub(this.anchor);
      const len = this.tmp.length();
      const keep = Math.max(0.9, frac * len - 0.4);
      if (len > 1e-4) cam.position.copy(this.anchor).addScaledVector(this.tmp, keep / len);
    }

    this.lookSmoothed.lerp(this.look, 1 - Math.exp(-12 * dt));
    cam.lookAt(this.lookSmoothed);

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
    if (world.pushOutPoint(cam.position, 0.3)) cam.lookAt(this.lookSmoothed);
    cam.position.y = Math.max(cam.position.y, 0.8);

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
