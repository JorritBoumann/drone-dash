import * as THREE from 'three';
import { CAMERA, FLIGHT } from '../game/config';
import type { Drone } from '../entities/Drone';
import type { CollisionWorld } from './CollisionWorld';

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

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  snapTo(drone: Drone): void {
    this.yaw = drone.yaw;
    this.approach = 0;
    this.computeIdeal(drone, 0);
    this.camera.position.copy(this.ideal);
    this.lookSmoothed.copy(this.look);
    this.camera.lookAt(this.lookSmoothed);
  }

  addShake(amount: number): void {
    this.shake = Math.min(1, this.shake + amount);
  }

  private computeIdeal(drone: Drone, speedFactor: number, alt = 0, target: THREE.Vector3 | null = null): void {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const p = drone.group.position;
    const ap = target ? this.approach : 0;
    // never further than CAMERA.maxDistance so the drone stays readable at speed;
    // on the final approach the camera pulls in a little and rises to look down over roof edges
    const dist = Math.min(CAMERA.maxDistance, CAMERA.distance + speedFactor * 1.0 + (drone.boosting ? 0.8 : 0)) * (1 - CAMERA.approachPullIn * ap);
    const vy = THREE.MathUtils.clamp(drone.velocity.y / FLIGHT.climbSpeed, -1, 1);
    // higher up -> camera rises and pitches down so the city stays in frame
    const height = Math.min(CAMERA.maxHeight, CAMERA.height + CAMERA.heightPerAlt * alt) + CAMERA.approachRise * ap;
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

  update(dt: number, drone: Drone, world: CollisionWorld, alt = 0, target: THREE.Vector3 | null = null): void {
    this.time += dt;
    // yaw follows the drone heading with lag; shortest-arc
    let dy = drone.yaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * (1 - Math.exp(-CAMERA.yawLag * dt));

    const speedFactor = Math.min(1, drone.speed / FLIGHT.maxSpeed);
    const wantApproach = this.approachWeight(drone, target);
    this.approach += (wantApproach - this.approach) * (1 - Math.exp(-(wantApproach > this.approach ? 2.5 : 1.5) * dt));
    this.computeIdeal(drone, speedFactor, alt, target);
    const cam = this.camera;
    const k = 1 - Math.exp(-CAMERA.followLag * dt);
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
