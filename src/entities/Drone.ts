import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { FlightIntent } from '../core/InputController';
import { FLIGHT } from '../game/config';
import type { CollisionWorld } from '../systems/CollisionWorld';

export type FlightEvents = { bump: number; landed: boolean };

const UP = new THREE.Vector3(0, 1, 0);

/** Warm fresnel rim so the hero separates from both bright sky and dark facades. */
function addRim(material: THREE.MeshStandardMaterial, strength: number): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: new THREE.Color('#ffd27a') };
    shader.uniforms.uRimStrength = { value: strength };
    shader.fragmentShader = 'uniform vec3 uRimColor;\nuniform float uRimStrength;\n' + shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       float rimF = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 2.5);
       totalEmissiveRadiance += uRimColor * rimF * uRimStrength;`,
    );
  };
  material.customProgramCacheKey = () => `drone-rim-${strength}`;
}

/**
 * Hero quadcopter: authored model (shell, arms, ducted rotors, skids, gimbal,
 * nav lights, cargo) plus an arcade flight model with momentum, banking,
 * auto-hover and sub-stepped sphere collision.
 */
export class Drone {
  readonly group = new THREE.Group();
  readonly velocity = new THREE.Vector3();
  readonly forward = new THREE.Vector3(0, 0, -1);
  yaw = 0;
  yawRate = 0;
  boost = 1;
  boosting = false;
  carrying = false;
  speed = 0;

  private readonly tilt = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly rotors: THREE.Object3D[] = [];
  private readonly blurDiscs: THREE.Mesh[] = [];
  private readonly blurMat: THREE.MeshBasicMaterial;
  private readonly cargo = new THREE.Group();
  private readonly statusMat: THREE.MeshStandardMaterial;
  private readonly strobeMat: THREE.MeshStandardMaterial;
  private readonly accentMat: THREE.MeshPhysicalMaterial;
  private rotorAngle = 0;
  private rotorSpeed = 40;
  private pitch = 0;
  private roll = 0;
  private boostIdle = 0;
  private time = 0;
  private bumpFlash = 0;
  private bumpAmp = 0;
  private cargoSnap = 0;
  private readonly prevVel = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly cargoSwing = new THREE.Vector2();
  private readonly cargoSwingVel = new THREE.Vector2();

  constructor() {
    this.group.name = 'drone';
    this.group.add(this.tilt);
    this.tilt.add(this.body);

    const shell = new THREE.MeshPhysicalMaterial({ color: '#f3efe7', roughness: 0.32, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    this.accentMat = new THREE.MeshPhysicalMaterial({ color: '#ff6b2c', roughness: 0.4, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25, emissive: '#ff3b00', emissiveIntensity: 0 });
    const carbon = new THREE.MeshStandardMaterial({ color: '#23272e', roughness: 0.5, metalness: 0.35 });
    const metal = new THREE.MeshStandardMaterial({ color: '#a7b0ba', roughness: 0.28, metalness: 0.95 });
    const glass = new THREE.MeshPhysicalMaterial({ color: '#0d1520', roughness: 0.05, metalness: 0.3, clearcoat: 1 });
    const blade = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.35, metalness: 0.2 });
    this.statusMat = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#38e8ff', emissiveIntensity: 3 });
    this.strobeMat = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ffffff', emissiveIntensity: 0 });
    const red = new THREE.MeshStandardMaterial({ color: '#300', emissive: '#ff2a1a', emissiveIntensity: 3.5 });
    const green = new THREE.MeshStandardMaterial({ color: '#030', emissive: '#22ff6a', emissiveIntensity: 3.5 });
    const white = new THREE.MeshStandardMaterial({ color: '#222', emissive: '#fff4d8', emissiveIntensity: 3.5 });

    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, name = '') => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      if (name) m.name = name;
      this.body.add(m);
      return m;
    };

    // Main hull: rounded slab extruded vertically
    const shape = new THREE.Shape();
    const hw = 0.24, hl = 0.42, rr = 0.12;
    shape.moveTo(-hw + rr, -hl);
    shape.lineTo(hw - rr, -hl);
    shape.quadraticCurveTo(hw, -hl, hw, -hl + rr);
    shape.lineTo(hw, hl - rr);
    shape.quadraticCurveTo(hw, hl, hw - rr, hl);
    shape.lineTo(-hw + rr, hl);
    shape.quadraticCurveTo(-hw, hl, -hw, hl - rr);
    shape.lineTo(-hw, -hl + rr);
    shape.quadraticCurveTo(-hw, -hl, -hw + rr, -hl);
    const hull = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 6 });
    hull.rotateX(-Math.PI / 2);
    hull.translate(0, -0.06, 0);
    add(hull, carbon, 0, 0, 0, 'hull');

    // Top canopy shell
    const canopy = new THREE.SphereGeometry(0.3, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    canopy.scale(0.86, 0.52, 1.42);
    add(canopy, shell, 0, 0.1, 0.02, 'canopy');
    // accent spine
    add(new THREE.BoxGeometry(0.07, 0.03, 0.62), this.accentMat, 0, 0.255, 0.04, 'spine');
    // front visor
    const visor = new THREE.SphereGeometry(0.16, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    visor.scale(1.1, 0.6, 0.7);
    visor.rotateX(-Math.PI / 2 + 0.35);
    add(visor, glass, 0, 0.12, -0.33, 'visor');
    // side intakes
    add(new THREE.BoxGeometry(0.03, 0.06, 0.22), carbon, 0.27, 0.1, 0.05);
    add(new THREE.BoxGeometry(0.03, 0.06, 0.22), carbon, -0.27, 0.1, 0.05);
    // status light bar at the rear
    add(new THREE.BoxGeometry(0.26, 0.035, 0.03), this.statusMat, 0, 0.1, 0.46, 'statusBar');
    // gimbal camera
    add(new THREE.SphereGeometry(0.075, 16, 12), metal, 0, -0.1, -0.36, 'gimbal');
    const lens = new THREE.CylinderGeometry(0.04, 0.045, 0.05, 16);
    lens.rotateX(Math.PI / 2);
    add(lens, glass, 0, -0.1, -0.43, 'lens');
    // front headlights
    add(new THREE.SphereGeometry(0.028, 8, 6), white, 0.13, 0.02, -0.47);
    add(new THREE.SphereGeometry(0.028, 8, 6), white, -0.13, 0.02, -0.47);
    // strobe on top
    add(new THREE.SphereGeometry(0.03, 8, 6), this.strobeMat, 0, 0.27, 0.32, 'strobe');

    // Arms, motors, guards, rotors
    const motorPos = [
      new THREE.Vector3(0.62, 0.02, -0.52),
      new THREE.Vector3(-0.62, 0.02, -0.52),
      new THREE.Vector3(0.62, 0.02, 0.52),
      new THREE.Vector3(-0.62, 0.02, 0.52),
    ];
    const guardGeo = new THREE.TorusGeometry(0.36, 0.028, 8, 40);
    guardGeo.rotateX(Math.PI / 2);
    const lipGeo = new THREE.CylinderGeometry(0.385, 0.385, 0.07, 40, 1, true);
    const strutGeo = new THREE.BoxGeometry(0.34, 0.02, 0.03);
    const bladeGeo = new THREE.BoxGeometry(0.62, 0.012, 0.075);
    const hubGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.05, 12);
    const rotorGeo = mergeGeometries([
      bladeGeo.clone().rotateX(0.16).toNonIndexed(),
      bladeGeo.clone().rotateX(-0.16).rotateY(Math.PI / 2).toNonIndexed(),
      hubGeo.clone().toNonIndexed(),
    ])!;
    const discGeo = new THREE.CircleGeometry(0.33, 36);
    discGeo.rotateX(-Math.PI / 2);
    const lipMat = shell.clone();
    lipMat.side = THREE.DoubleSide;
    this.blurMat = new THREE.MeshBasicMaterial({ color: '#d9e2ea', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
    motorPos.forEach((p, i) => {
      // arm from hull to motor
      const from = new THREE.Vector3(Math.sign(p.x) * 0.2, 0.02, Math.sign(p.z) * 0.28);
      const len = from.distanceTo(p);
      const arm = new THREE.BoxGeometry(0.075, 0.05, len);
      const m = add(arm, carbon, (from.x + p.x) / 2, 0.02, (from.z + p.z) / 2);
      m.lookAt(this.tmp.set(p.x, 0.02, p.z));
      // motor bell + accent cap
      add(new THREE.CylinderGeometry(0.075, 0.09, 0.13, 18), metal, p.x, p.y + 0.02, p.z);
      add(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 18), this.accentMat, p.x, p.y + 0.09, p.z);
      // ducted guard with struts
      add(guardGeo, shell, p.x, p.y + 0.06, p.z);
      add(lipGeo, lipMat, p.x, p.y + 0.03, p.z);
      for (let k = 0; k < 3; k++) {
        const s = new THREE.Mesh(strutGeo, carbon);
        const a = (k / 3) * Math.PI * 2 + i;
        s.position.set(p.x + Math.cos(a) * 0.2, p.y - 0.01, p.z + Math.sin(a) * 0.2);
        s.rotation.y = -a;
        this.body.add(s);
      }
      // rotor (spins)
      const rotor = new THREE.Mesh(rotorGeo, blade);
      rotor.position.set(p.x, p.y + 0.13, p.z);
      rotor.castShadow = true;
      this.body.add(rotor);
      this.rotors.push(rotor);
      const disc = new THREE.Mesh(discGeo, this.blurMat);
      disc.position.set(p.x, p.y + 0.135, p.z);
      disc.renderOrder = 2;
      this.body.add(disc);
      this.blurDiscs.push(disc);
      // nav light under each motor: port red, starboard green
      add(new THREE.SphereGeometry(0.03, 8, 6), p.x < 0 ? red : green, p.x * 1.08, p.y - 0.07, p.z * 1.08);
    });

    // Landing skids
    for (const sx of [-0.2, 0.2]) {
      const rail = new THREE.CylinderGeometry(0.018, 0.018, 0.62, 8);
      rail.rotateX(Math.PI / 2);
      add(rail, carbon, sx, -0.3, 0);
      for (const sz of [-0.18, 0.18]) {
        const leg = new THREE.CylinderGeometry(0.014, 0.014, 0.26, 6);
        const lm = add(leg, carbon, sx * 0.85, -0.18, sz);
        lm.rotation.z = sx > 0 ? 0.25 : -0.25;
      }
    }

    // Cargo: taped parcel on two cables
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.38), new THREE.MeshStandardMaterial({ color: '#c9935a', roughness: 0.85 }));
    box.position.y = -0.36;
    box.castShadow = true;
    const tapeMat = new THREE.MeshStandardMaterial({ color: '#efe1b3', roughness: 0.6 });
    const tape1 = new THREE.Mesh(new THREE.BoxGeometry(0.385, 0.305, 0.07), tapeMat);
    tape1.position.y = -0.36;
    const tape2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.305, 0.385), tapeMat);
    tape2.position.y = -0.36;
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.005), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ff6b2c', emissiveIntensity: 0.4 }));
    label.position.set(0.1, -0.33, 0.193);
    const cableMat = new THREE.MeshStandardMaterial({ color: '#222' });
    for (const cx of [-0.12, 0.12]) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4), cableMat);
      cable.position.set(cx, -0.11, 0);
      this.cargo.add(cable);
    }
    this.cargo.add(box, tape1, tape2, label);
    this.cargo.position.y = -0.22;
    this.cargo.visible = false;
    this.body.add(this.cargo);

    this.body.scale.setScalar(1.32);
    for (const m of [shell, carbon, this.accentMat]) addRim(m, m === carbon ? 0.55 : 0.75);
    this.mergeStatic([white, red, green, this.statusMat, this.strobeMat]);
  }

  /** Collapse all static hull parts into one mesh per material (keeps the hero cheap: ~12 draws). */
  private mergeStatic(noShadow: THREE.Material[]): void {
    const keep = new Set<THREE.Object3D>([...this.rotors, ...this.blurDiscs, this.cargo]);
    const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const child of [...this.body.children]) {
      const mesh = child as THREE.Mesh;
      if (keep.has(child) || !mesh.isMesh) continue;
      mesh.updateMatrix();
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      g.applyMatrix4(mesh.matrix);
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
      g.clearGroups();
      const mat = mesh.material as THREE.Material;
      if (!groups.has(mat)) groups.set(mat, []);
      groups.get(mat)!.push(g);
      this.body.remove(mesh);
    }
    for (const [mat, list] of groups) {
      const merged = mergeGeometries(list);
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = !noShadow.includes(mat);
      m.name = `drone-${mat.type}-${groups.size}`;
      this.body.add(m);
    }
  }

  reset(position: THREE.Vector3, yaw: number): void {
    this.group.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.prevVel.set(0, 0, 0);
    this.yaw = yaw;
    this.yawRate = 0;
    this.boost = 1;
    this.boosting = false;
    this.carrying = false;
    this.cargo.visible = false;
    this.pitch = this.roll = 0;
    this.group.rotation.set(0, yaw, 0);
    this.tilt.rotation.set(0, 0, 0);
  }

  setCarrying(v: boolean): void {
    this.carrying = v;
    this.cargo.visible = v;
    this.statusMat.emissive.set(v ? '#ffb02e' : '#38e8ff');
    this.cargoSwing.set(0, 0);
    this.cargoSwingVel.set(0.6, 0.0);
    this.cargoSnap = v ? 1 : 0;
  }

  /** Advance flight. Returns impact info for audio/camera feedback. */
  update(dt: number, intent: FlightIntent, world: CollisionWorld, bounds: number, events: FlightEvents): void {
    this.time += dt;
    events.bump = 0;
    events.landed = false;
    const F = FLIGHT;

    // Yaw with smoothed rate
    const targetRate = -intent.turn * F.turnRate;
    this.yawRate += (targetRate - this.yawRate) * (1 - Math.exp(-F.turnResponse * dt));
    this.yaw += this.yawRate * dt;
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));

    // Boost meter
    const wantsBoost = intent.boost && this.boost > 0.02;
    this.boosting = wantsBoost;
    if (wantsBoost) {
      this.boost = Math.max(0, this.boost - F.boostDrain * dt);
      this.boostIdle = 0;
    } else {
      this.boostIdle += dt;
      if (this.boostIdle > F.boostRegenDelay) this.boost = Math.min(1, this.boost + F.boostRegen * dt);
    }

    // Horizontal thrust & drag (terminal velocity = thrust / drag)
    const thrustIn = this.boosting ? Math.max(intent.thrust, 0.0) || 1 : intent.thrust;
    const thrust = this.boosting ? F.boostThrust : F.thrust;
    const top = this.boosting ? F.boostSpeed : F.maxSpeed;
    // over the current top speed (e.g. just after a boost) speed bleeds off gently instead of collapsing
    const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const drag = (thrust / top) * (hSpeed > top + 0.5 ? 0.35 : 1);
    const v = this.velocity;
    this.prevVel.copy(v);
    v.x += this.forward.x * thrustIn * thrust * dt;
    v.z += this.forward.z * thrustIn * thrust * dt;
    // reversing is weaker than going forward
    const k = Math.exp(-drag * dt * (thrustIn < 0 ? 1.4 : 1));
    // outside of boost, excess speed bleeds off gently instead of snapping
    v.x *= k;
    v.z *= k;
    // lateral grip: drift turns into heading over time
    const fwdComp = v.x * this.forward.x + v.z * this.forward.z;
    const latX = v.x - this.forward.x * fwdComp;
    const latZ = v.z - this.forward.z * fwdComp;
    const g = 1 - Math.exp(-F.lateralGrip * dt);
    v.x -= latX * g;
    v.z -= latZ * g;
    // redirect a portion of the lost lateral speed into the heading (carving)
    const latLen = Math.hypot(latX, latZ) * g * 0.55;
    v.x += this.forward.x * latLen * Math.sign(fwdComp || 1);
    v.z += this.forward.z * latLen * Math.sign(fwdComp || 1);

    // Vertical: target climb rate, auto-hover when released
    const targetVy = intent.lift * F.climbSpeed;
    v.y += (targetVy - v.y) * (1 - Math.exp(-F.climbResponse * dt));

    // Sub-stepped integration so fast boosts never tunnel through thin walls
    const p = this.group.position;
    const travel = v.length() * dt;
    const steps = Math.max(1, Math.ceil(travel / (F.radius * 0.45)));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      p.addScaledVector(v, h);
      const depth = world.resolveSphere(p, F.radius, this.normal);
      if (depth > 0) {
        const vn = v.dot(this.normal);
        if (vn < 0) {
          const impact = -vn;
          v.addScaledVector(this.normal, -(1 + F.bounce) * vn);
          if (impact > 2.5 && this.normal.y < 0.7) {
            // tangential scrub on hard wall hits
            this.tmp.copy(this.normal).multiplyScalar(v.dot(this.normal));
            this.tmp2.copy(v).sub(this.tmp).multiplyScalar(F.bumpFriction);
            v.copy(this.tmp).add(this.tmp2);
          }
          if (this.normal.y > 0.7) {
            v.y = Math.max(0, v.y * 0.2);
            if (impact > 1.5) events.landed = true;
          } else {
            events.bump = Math.max(events.bump, impact);
          }
        }
      }
      // ground
      const floor = world.floorY + 0.85; // skids just above the sidewalk
      if (p.y < floor) {
        if (v.y < -3) events.landed = true;
        p.y = floor;
        if (v.y < 0) v.y = 0;
      }
    }
    // ceiling and soft city bounds
    if (p.y > F.maxAltitude) {
      p.y += (F.maxAltitude - p.y) * Math.min(1, dt * 4);
      if (v.y > 0) v.y *= 0.8;
    }
    for (const axis of ['x', 'z'] as const) {
      const lim = bounds;
      if (Math.abs(p[axis]) > lim) {
        const over = Math.abs(p[axis]) - lim;
        v[axis] -= Math.sign(p[axis]) * over * 6 * dt;
        if (over > 25) p[axis] = Math.sign(p[axis]) * (lim + 25);
      }
    }
    if (events.bump > 0) {
      this.bumpFlash = 1;
      this.bumpAmp = Math.min(1.6, 0.4 + events.bump / 10);
    }

    this.speed = Math.hypot(v.x, v.z);
    this.animate(dt, intent);
  }

  /** Visual-only: tilt, rotors, lights, cargo swing. */
  private animate(dt: number, intent: FlightIntent): void {
    const F = FLIGHT;
    const v = this.velocity;
    const fwdSpeed = v.x * this.forward.x + v.z * this.forward.z;
    const accelF = dt > 0 ? ((v.x - this.prevVel.x) * this.forward.x + (v.z - this.prevVel.z) * this.forward.z) / dt : 0;
    const rightX = -this.forward.z, rightZ = this.forward.x;
    const latSpeed = v.x * rightX + v.z * rightZ;

    const sf = Math.min(1, Math.abs(fwdSpeed) / F.maxSpeed);
    const targetPitch = -(THREE.MathUtils.clamp(accelF / 30, -1, 1) * 0.55 + (fwdSpeed / F.boostSpeed) * 0.75) * F.pitchAngle;
    const targetRoll = (this.yawRate / F.turnRate) * F.bankAngle * (0.35 + 0.65 * sf) - (latSpeed / 10) * 0.25;
    const a = 1 - Math.exp(-8 * dt);
    this.pitch += (targetPitch - this.pitch) * a;
    this.roll += (targetRoll - this.roll) * a;
    this.group.rotation.set(0, this.yaw, 0);
    // hover bob + wobble from bumps
    const hover = Math.sin(this.time * 2.1) * F.hoverBob * (1 - sf * 0.7);
    this.bumpFlash = Math.max(0, this.bumpFlash - dt * 3);
    const wob = Math.sin(this.time * 38) * this.bumpFlash * 0.12 * this.bumpAmp;
    this.tilt.position.y = hover;
    this.tilt.rotation.set(this.pitch + wob, 0, this.roll - wob * 0.6);

    // rotor spin follows throttle effort
    const effort = 0.5 + Math.abs(intent.thrust) * 0.25 + Math.max(0, intent.lift) * 0.3 + (this.boosting ? 0.5 : 0);
    const targetSpin = 55 + effort * 70;
    this.rotorSpeed += (targetSpin - this.rotorSpeed) * (1 - Math.exp(-5 * dt));
    this.rotorAngle += this.rotorSpeed * dt;
    this.rotors.forEach((r, i) => {
      r.rotation.y = (i % 2 === 0 ? 1 : -1) * this.rotorAngle;
    });
    this.blurMat.opacity = 0.08 + Math.min(0.18, (this.rotorSpeed - 50) / 500);
    this.blurMat.color.set(this.boosting ? '#9ff3ff' : '#d9e2ea');
    this.accentMat.emissiveIntensity = this.boosting ? 0.9 : 0;

    // strobe double-blink
    const ph = this.time % 1.4;
    this.strobeMat.emissiveIntensity = ph < 0.06 || (ph > 0.16 && ph < 0.22) ? 8 : 0;
    this.statusMat.emissiveIntensity = this.carrying ? 3 + Math.sin(this.time * 6) * 1.2 : 2.6;

    // cargo pendulum driven by acceleration
    if (this.carrying) {
      const ax = dt > 0 ? (v.x - this.prevVel.x) / dt : 0;
      const az = dt > 0 ? (v.z - this.prevVel.z) / dt : 0;
      // into drone local frame
      const lf = ax * this.forward.x + az * this.forward.z;
      const lr = ax * rightX + az * rightZ;
      const kSpring = 30, damp = 4;
      this.cargoSwingVel.x += (-kSpring * this.cargoSwing.x - damp * this.cargoSwingVel.x + lf * 0.25) * dt;
      this.cargoSwingVel.y += (-kSpring * this.cargoSwing.y - damp * this.cargoSwingVel.y - lr * 0.25) * dt;
      this.cargoSwing.addScaledVector(this.cargoSwingVel, dt);
      this.cargo.rotation.set(this.cargoSwing.x - this.pitch * 0.8, 0, this.cargoSwing.y - this.roll * 0.8);
      // snap-in: parcel is reeled up from below with an overshoot pop
      if (this.cargoSnap > 0) {
        this.cargoSnap = Math.max(0, this.cargoSnap - dt / 0.45);
        const t = 1 - this.cargoSnap;
        const c1 = 2.2, back = 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        this.cargo.position.y = -1.6 + (-0.22 + 1.6) * back;
        this.cargo.scale.setScalar(0.6 + 0.4 * back + Math.sin(t * Math.PI) * 0.25);
      } else {
        this.cargo.position.y = -0.22;
        this.cargo.scale.setScalar(1);
      }
    }
  }

  /** Point slightly ahead of the drone for camera look-at. */
  getForward(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.forward);
  }

  static readonly up = UP;
}
