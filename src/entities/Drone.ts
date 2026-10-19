import * as THREE from 'three';
import { SHADOW_ONLY_LAYER } from '../world/shadowSubset';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { FlightIntent } from '../core/InputController';
import { FLIGHT } from '../game/config';
import type { CollisionWorld } from '../systems/CollisionWorld';

/**
 * bump: wall impact speed (into the surface normal); ledge: impact speed absorbed by a ledge hop (always free).
 * wallLoss: horizontal speed taken off by wall contacts this frame (collision response only, not drag, braking or the
 * drop guide). Contacts with low obstacles (skimmable lips, kerbs, rims) are not counted. wallTop: tallest top of the
 * obstacle column at the hardest wall contact.
 */
export type FlightEvents = { bump: number; ledge: number; landed: boolean; wallLoss: number; wallTop: number; wallNormalY: number };

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
  /** 0..1 headwind strength at the drone's altitude (see FLIGHT.headwind*). */
  headwind = 0;

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
  /** Round 33: the rotor angle as a shader uniform (all four rotors are one mesh). */
  private readonly rotorSpin = { value: 0 };
  private rotorSpeed = 40;
  private pitch = 0;
  private roll = 0;
  private boostIdle = 0;
  private time = 0;
  private bumpFlash = 0;
  private bumpAmp = 0;
  private tumble = 0;
  private tumbleAmp = 0;
  private alarm = 0;
  private cargoSnap = 0;
  /** Active objective pad; the drop guide eases the drone over it on the way down. */
  readonly guide = new THREE.Vector3();
  hasGuide = false;
  private guiding = false;
  // round 34: a boat bow or stern carries the drone off to the side as a velocity (no position jump): direction, speed
  // and the time it lasts after the last contact
  private slideX = 0;
  private slideZ = 0;
  private slideV = 0;
  private slideT = 0;
  private slideCap = 0;
  private hopCarry = 0; // m/s of forward speed a ledge hop absorbed; handed back once the drone clears the ledge
  private readonly hopDir = new THREE.Vector3();
  private hopTop = 0; // top of the ledge being hopped; the carry is only handed back once the skids are above it
  private hopLift = 0; // m/s upward target of the current hop
  private stepOffset = 0; // m: visual lag after stepping over a low lip (eases back to 0)
  private brushing = false; // touching a soft prop last frame
  private hop = 0; // s left of a ledge hop (lifts the drone over parapets and roof clutter it is pushing into)
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
    // round 33: the red, green and white nav lights share one material (their emissive colour is a vertex attribute),
    // so they merge into one mesh: 1 draw instead of 3
    const navMat = new THREE.MeshStandardMaterial({ color: '#1c1c1c', emissive: '#ffffff', emissiveIntensity: 3.5 });
    navMat.onBeforeCompile = (shader) => {
      shader.vertexShader = 'attribute vec3 navcol;\nvarying vec3 vNavCol;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvNavCol = navcol;');
      shader.fragmentShader = 'varying vec3 vNavCol;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vNavCol;');
    };
    navMat.customProgramCacheKey = () => 'drone-nav';
    const navGeo = (geo: THREE.BufferGeometry, hex: string) => {
      const c = new THREE.Color(hex), a = new Float32Array(geo.getAttribute('position').count * 3);
      for (let k = 0; k < a.length; k += 3) { a[k] = c.r; a[k + 1] = c.g; a[k + 2] = c.b; }
      geo.setAttribute('navcol', new THREE.BufferAttribute(a, 3));
      return geo;
    };
    const red = navMat, green = navMat, white = navMat;

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
    add(navGeo(new THREE.SphereGeometry(0.028, 8, 6), '#fff4d8'), white, 0.13, 0.02, -0.47);
    add(navGeo(new THREE.SphereGeometry(0.028, 8, 6), '#fff4d8'), white, -0.13, 0.02, -0.47);
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
    this.blurMat.forceSinglePass = true; // round 33: one draw for the blur discs (a flat disc needs no back-then-front pass)
    const rotorParts: THREE.BufferGeometry[] = [], discParts: THREE.BufferGeometry[] = [];
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
      // rotor (spins) and blur disc: round 33, all four go into one mesh each (see below), so 2 draws instead of 12
      const hubA = new Float32Array(rotorGeo.getAttribute('position').count * 4);
      for (let k = 0; k < hubA.length; k += 4) { hubA[k] = p.x; hubA[k + 1] = p.y + 0.13; hubA[k + 2] = p.z; hubA[k + 3] = i % 2 === 0 ? 1 : -1; }
      const rg = rotorGeo.clone().translate(p.x, p.y + 0.13, p.z);
      rg.setAttribute('hub', new THREE.BufferAttribute(hubA, 4));
      rotorParts.push(rg);
      discParts.push(discGeo.clone().translate(p.x, p.y + 0.135, p.z));
      // nav light under each motor: port red, starboard green
      add(navGeo(new THREE.SphereGeometry(0.03, 8, 6), p.x < 0 ? '#ff2a1a' : '#22ff6a'), p.x < 0 ? red : green, p.x * 1.08, p.y - 0.07, p.z * 1.08);
    });

    {
      // round 33: the four rotors are one mesh; each vertex turns about its own hub in the vertex shader (hub.w = spin
      // direction). Rotor blades cast no shadow (a 1 cm blade at speed is a blur; the guards and hull still cast).
      const rotorMat = blade.clone();
      const spin = this.rotorSpin;
      rotorMat.onBeforeCompile = (shader) => {
        shader.uniforms.uRotorAngle = spin;
        shader.vertexShader = 'uniform float uRotorAngle;\nattribute vec4 hub;\n' + shader.vertexShader
          .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
            float ra = uRotorAngle * hub.w; float rc = cos(ra), rs = sin(ra);
            objectNormal = vec3(rc * objectNormal.x + rs * objectNormal.z, objectNormal.y, -rs * objectNormal.x + rc * objectNormal.z);`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            vec3 rrel = transformed - hub.xyz;
            transformed = hub.xyz + vec3(rc * rrel.x + rs * rrel.z, rrel.y, -rs * rrel.x + rc * rrel.z);`);
      };
      rotorMat.customProgramCacheKey = () => 'drone-rotor';
      const rotors = new THREE.Mesh(mergeGeometries(rotorParts)!, rotorMat);
      rotors.name = 'drone-rotors';
      rotors.frustumCulled = false;
      this.body.add(rotors);
      this.rotors.push(rotors);
      const discs = new THREE.Mesh(mergeGeometries(discParts)!, this.blurMat);
      discs.name = 'drone-rotor-blur';
      discs.renderOrder = 2;
      this.body.add(discs);
      this.blurDiscs.push(discs);
    }

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

    // Cargo: taped parcel on two cables. Round 33: one vertex-coloured mesh (was 6 meshes and 7 draws)
    const cargoPart = (g: THREE.BufferGeometry, hex: string, x: number, y: number, z: number) => {
      const n = (g.index ? g.toNonIndexed() : g).translate(x, y, z);
      n.deleteAttribute('uv');
      const c = new THREE.Color(hex), col = new Float32Array(n.getAttribute('position').count * 3);
      for (let k = 0; k < col.length; k += 3) { col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; }
      n.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return n;
    };
    const cargoGeo = mergeGeometries([
      cargoPart(new THREE.BoxGeometry(0.38, 0.3, 0.38), '#c9935a', 0, -0.36, 0),
      cargoPart(new THREE.BoxGeometry(0.385, 0.305, 0.07), '#efe1b3', 0, -0.36, 0),
      cargoPart(new THREE.BoxGeometry(0.07, 0.305, 0.385), '#efe1b3', 0, -0.36, 0),
      cargoPart(new THREE.BoxGeometry(0.14, 0.1, 0.005), '#ffd2b8', 0.1, -0.33, 0.193),
      cargoPart(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4), '#222222', -0.12, -0.11, 0),
      cargoPart(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4), '#222222', 0.12, -0.11, 0),
    ])!;
    const box = new THREE.Mesh(cargoGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
    box.castShadow = true;
    box.name = 'drone-cargo';
    this.cargo.add(box);
    this.cargo.position.y = -0.22;
    this.cargo.visible = false;
    this.body.add(this.cargo);

    this.body.scale.setScalar(1.32);
    for (const m of [shell, carbon, this.accentMat]) addRim(m, m === carbon ? 0.55 : 0.75);
    // round 33: the duct lips and motor caps cast no shadow either (they sit inside the guards' shadow)
    this.mergeStatic([navMat, this.statusMat, this.strobeMat, lipMat, this.accentMat]);
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
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'navcol') g.deleteAttribute(name);
      if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
      g.clearGroups();
      const mat = mesh.material as THREE.Material;
      if (!groups.has(mat)) groups.set(mat, []);
      groups.get(mat)!.push(g);
      this.body.remove(mesh);
    }
    // round 34: the parts that cast a shadow draw it as one merged proxy (shadow pass only): 4 shadow draws -> 1
    const casters: THREE.BufferGeometry[] = [];
    for (const [mat, list] of groups) {
      const merged = mergeGeometries(list);
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = false;
      if (!noShadow.includes(mat)) {
        const c = new THREE.BufferGeometry();
        c.setAttribute('position', merged.getAttribute('position'));
        casters.push(c);
      }
      m.name = `drone-${mat.type}-${groups.size}`;
      this.body.add(m);
    }
    const shadowGeo = casters.length ? mergeGeometries(casters) : null;
    if (shadowGeo) {
      const proxy = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ colorWrite: false }));
      proxy.castShadow = true;
      proxy.receiveShadow = false;
      proxy.layers.set(SHADOW_ONLY_LAYER);
      proxy.name = 'drone-shadow';
      this.body.add(proxy);
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
    this.hop = 0;
    this.hopCarry = 0;
    this.slideT = 0;
    this.hasGuide = false;
    this.group.rotation.set(0, yaw, 0);
    this.tilt.rotation.set(0, 0, 0);
  }

  /** Debug/test: move the drone and give it a horizontal speed along its heading (keeps cargo and boost). */
  place(position: THREE.Vector3, yaw: number, speed: number): void {
    this.group.position.copy(position);
    this.yaw = yaw;
    this.yawRate = 0;
    this.forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    this.velocity.set(this.forward.x * speed, 0, this.forward.z * speed);
    this.prevVel.copy(this.velocity);
    this.hop = 0;
    this.hopCarry = 0;
    this.slideT = 0;
    this.group.rotation.set(0, yaw, 0);
  }

  setCarrying(v: boolean): void {
    this.carrying = v;
    this.cargo.visible = v;
    this.statusMat.emissive.set(v ? '#ffb02e' : '#38e8ff');
    this.cargoSwing.set(0, 0);
    this.cargoSwingVel.set(0.6, 0.0);
    this.cargoSnap = v ? 1 : 0;
  }

  /** Hard crash: a short visual tumble, a cargo jolt and a red status blink. Flight control is unchanged. */
  crash(strength: number): void {
    this.tumble = 1;
    this.tumbleAmp = 0.5 + strength * 0.7;
    this.alarm = 1;
    if (this.carrying) this.cargoSwingVel.set(3 + strength * 4, (Math.random() - 0.5) * 6);
  }

  /** Advance flight. Returns impact info for audio/camera feedback. */
  update(dt: number, intent: FlightIntent, world: CollisionWorld, bounds: number, events: FlightEvents): void {
    this.time += dt;
    events.bump = 0;
    events.ledge = 0;
    events.landed = false;
    events.wallLoss = 0;
    events.wallTop = -1e9;
    events.wallNormalY = 0;
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
    // headwind high above the roofs: cruising over the city is slower than threading the streets
    this.headwind = THREE.MathUtils.smoothstep(this.group.position.y, F.headwindStart, F.headwindFull);
    const top = (this.boosting ? F.boostSpeed : F.maxSpeed) * (1 - F.headwindSlow * this.headwind);
    // over the current top speed (e.g. just after a boost) speed bleeds off gently instead of collapsing
    // ...except when dropping toward a nearby pad: then leftover boost speed airbrakes so the drone does not sail past it
    const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const p0 = this.group.position;
    const diving = this.hasGuide && intent.lift < 0 && p0.y - this.guide.y > 2 && Math.hypot(this.guide.x - p0.x, this.guide.z - p0.z) < F.guideBrakeRange;
    const drag = (thrust / top) * (hSpeed > top + 0.5 && !diving ? 0.35 + 0.65 * this.headwind : 1); // the headwind eats carried speed too
    const v = this.velocity;
    this.prevVel.copy(v);
    const thrustDv = Math.max(0, thrustIn) * thrust * dt;
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

    // Drop guide: once the player commits to a pad (descending, or hovering low beside it) the beacon
    // eases the drone over its centre so the last few metres are a clean drop instead of a hunt.
    this.guiding = false;
    if (this.hasGuide && intent.lift <= 0 && !this.boosting) {
      const gx = this.guide.x - this.group.position.x;
      const gz = this.guide.z - this.group.position.z;
      const gd = Math.hypot(gx, gz);
      const above = this.group.position.y - this.guide.y;
      const committed = intent.lift < 0 || above < F.guideLowHeight;
      if (committed && above > 0.5 && gd < F.guideRange) {
        const w = THREE.MathUtils.smoothstep(F.guideRange - gd, 0, 2.5);
        const want = Math.min(gd * 1.6, F.guideSpeed);
        const wx = gd > 1e-3 ? (gx / gd) * want : 0;
        const wz = gd > 1e-3 ? (gz / gd) * want : 0;
        const kk = (1 - Math.exp(-F.guidePull * dt)) * w * (1 - Math.max(0, -intent.thrust) * 0.7);
        v.x += (wx - v.x) * kk;
        v.z += (wz - v.z) * kk;
        this.guiding = w > 0.2;
      }
    }

    // Vertical: target climb rate, auto-hover when released
    // dropping is quicker than climbing: getting down to a street-level drop should feel snappy
    let targetVy = intent.lift * (intent.lift < 0 ? F.descendSpeed : F.climbSpeed);
    if (this.hop > 0) {
      this.hop = Math.max(0, this.hop - dt);
      targetVy = Math.max(targetVy, this.hopLift);
    }
    // arresting a fast drop is crisper than starting one, so releasing descend does not sink you past a roof edge
    const vResp = v.y < 0 && targetVy > v.y ? F.sinkBrakeResponse : F.climbResponse;
    v.y += (targetVy - v.y) * (1 - Math.exp(-vResp * dt));

    // round 34: a boat's sideways carry, applied after the lateral grip so the grip does not eat it; it eases out
    if (this.slideT > 0) {
      this.slideT = Math.max(0, this.slideT - dt);
      const want = this.slideV * Math.min(1, this.slideT / 0.12);
      const along = v.x * this.slideX + v.z * this.slideZ;
      if (along < want) { v.x += this.slideX * (want - along); v.z += this.slideZ * (want - along); }
      const hs = Math.hypot(v.x, v.z);
      if (hs > this.slideCap) { v.x *= this.slideCap / hs; v.z *= this.slideCap / hs; }
    }

    // Sub-stepped integration so fast boosts never tunnel through thin walls
    const p = this.group.position;
    const travel = v.length() * dt;
    const steps = Math.max(1, Math.ceil(travel / (F.radius * 0.45)));
    const h = dt / steps;
    let touched = false;
    let wallHit = false;
    let brushed = this.brushing; // one glance per brush: while still touching the prop, the drone only slides
    let hardest = 0;
    const hStart = Math.hypot(v.x, v.z);
    const v0x = v.x, v0z = v.z; // round 33: velocity before this frame's contacts (caps a boat's push)
    for (let s = 0; s < steps; s++) {
      p.addScaledVector(v, h);
      const depth = world.resolveSphere(p, F.radius, this.normal);
      if (depth > 0) {
        touched = true;
        const vn = v.dot(this.normal);
        const soft = world.deepestSoft;
        // the obstacle top is below the drone's middle (belly clipping an edge) or a skimmable low step
        const edge = this.normal.y > 0.35 && this.normal.y <= 0.7;
        let low = vn < 0 && (soft || edge || this.isLowLedge(world, p));
        // round 33: also when the belly meets the hull's top edge (edge): a bus hit at 1 m used to hop over the cabin
        if (low && !soft && world.deepestDynamic) {
          // round 32: a boat is never hopped like a ledge. A gunwale low enough to step over is free (like a kerb),
          // anything taller (a deckhouse, a hull side) is a wall and the crash rules apply.
          if (this.columnTop(world, p) - (p.y - F.radius) + 0.05 > F.stepUp) low = false;
        }
        if (soft && vn < 0 && this.normal.y <= 0.7) {
          // thin props (lamp posts, trees) brush the drone aside: glance round them, no bounce, no crash
          const hs = Math.hypot(v.x, v.z);
          v.addScaledVector(this.normal, -vn);
          let tx = v.x, tz = v.z;
          let tl = Math.hypot(tx, tz);
          if (brushed) {
            // already glanced this frame: just slide
          } else if (tl < hs * 0.3) {
            // dead centre: pick the side the drone is turning or drifting toward
            const side = this.yawRate !== 0 ? -Math.sign(this.yawRate) : 1;
            tx = -this.normal.z * side;
            tz = this.normal.x * side;
            tl = Math.hypot(tx, tz) || 1;
          }
          if (!brushed) {
            const keep = hs * 0.8;
            v.x = (tx / tl) * keep;
            v.z = (tz / tl) * keep;
            brushed = true;
          }
          events.bump = Math.max(events.bump, -vn * 0.5);
        } else if (low && (intent.thrust > 0.2 || this.guiding)) {
          // Pushing into a low ledge (parapet, roof unit, fountain rim): skim over it instead of
          // bouncing off and getting pinned on the roof. Collision still holds; we only add lift.
          // The forward speed it absorbs is handed back once the drone is over the top.
          events.ledge = Math.max(events.ledge, -vn);
          const top = this.columnTop(world, p);
          const rise = top - (p.y - F.radius) + 0.05;
          if (rise > 0 && rise <= F.stepUp) {
            // a lip this low (parapet, kerb, rim) is stepped over without losing speed; the body eases up visually
            p.y += rise;
            this.stepOffset -= rise;
            if (v.y < 0) v.y = 0;
            continue;
          }
          const hn = Math.hypot(this.normal.x, this.normal.z);
          const carry = -vn * hn * 0.85;
          if (!this.guiding && carry > this.hopCarry && hn > 1e-3) {
            this.hopCarry = carry;
            this.hopTop = this.columnTop(world, p);
            this.hopDir.set(-this.normal.x / hn, 0, -this.normal.z / hn);
          }
          v.addScaledVector(this.normal, -vn);
          // the faster you meet it, the snappier the pop, so a fast skim stalls only briefly
          this.hopLift = Math.max(this.hop > 0 ? this.hopLift : 0, F.hopSpeed, Math.min(F.hopSpeed * 2, -vn * 0.55));
          v.y = Math.max(v.y, this.hopLift * 0.75);
          this.hop = F.hopTime;
        } else if (vn < 0) {
          const impact = -vn;
          const hBefore = Math.hypot(v.x, v.z);
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
            if (!low) {
              // a real wall (not a skimmable lip or kerb): remember the hardest contact
              wallHit = true;
              const lost = hBefore - Math.hypot(v.x, v.z);
              if (lost > hardest) {
                hardest = lost;
                events.wallTop = this.columnTop(world, p);
                events.wallNormalY = this.normal.y;
              }
            }
          }
        }
      }
      if (depth > 0 && world.pushBox) {
        // round 32: a moving boat carries the drone off its side instead of bulldozing it. The crash test above used the
        // drone's own speed only (a boat running into a hovering drone is never a crash); here the drone leaves the hull
        // face at least as fast as the face moves, and off a bow or stern it is also slid out to the side, so the boat
        // goes past and the drone never stays pinned on it.
        const b = world.pushBox, n = world.pushNormal, faceV = world.pushSpeed;
        const out = v.x * n.x + v.z * n.z;
        if (out < faceV + 0.6) { v.x += n.x * (faceV + 0.6 - out); v.z += n.z * (faceV + 0.6 - out); }
        const along = n.x * b.s + n.z * b.c; // contact normal along the boat's heading
        // round 33: cap what the boat adds, like a wall hit: the drone may leave the hull at the boat's own speed plus
        // 2 m/s (sideways and outwards), or keep the speed it already had; a low sailboat hull threw it at 8.5 m/s
        const cap = Math.hypot(b.vx, b.vz) + 2;
        const lim = Math.max(cap, Math.hypot(v0x, v0z));
        if (Math.abs(along) > 0.6) {
          // round 34: off a bow or stern the drone is carried sideways as a velocity that lasts a moment after each
          // contact (round 32 slid the position 0.55 m in one frame, which read as a snap). The boat goes past.
          const ox = p.x - b.x, oz = p.z - b.z, side = Math.sign(ox * b.c - oz * b.s) || 1;
          this.slideX = b.c * side;
          this.slideZ = -b.s * side;
          this.slideV = Math.min(faceV + 2, lim);
          this.slideT = 0.3;
          this.slideCap = lim;
          const sa = v.x * this.slideX + v.z * this.slideZ;
          if (sa < this.slideV) { v.x += this.slideX * (this.slideV - sa); v.z += this.slideZ * (this.slideV - sa); }
        }
        const hs = Math.hypot(v.x, v.z);
        if (hs > lim) { v.x *= lim / hs; v.z *= lim / hs; }
      }
      if (depth > 0 && world.deepestDynamic && !world.deepestSoft && world.deepestBox && this.normal.y > 0.7 && Math.abs(world.deepestBox.vx) + Math.abs(world.deepestBox.vz) > 0.1) {
        // round 37: resting on a hull top. The drone hovered on the boat's box while the boat (and its sail) slid
        // through it for seconds. It now slides off the nearer side, the same eased sideways carry as a bow contact,
        // fast enough to clear the beam in about half a second. Only for a boat under way: the docks and moored boats
        // hold still, so the drone may rest on them.
        const b = world.deepestBox;
        const ox = p.x - b.x, oz = p.z - b.z, side = Math.sign(ox * b.c - oz * b.s) || 1;
        const want = Math.max(2.5, b.hx * 2.2);
        this.slideX = b.c * side;
        this.slideZ = -b.s * side;
        this.slideV = Math.max(this.slideT > 0 ? this.slideV : 0, want);
        this.slideT = 0.3;
        this.slideCap = Math.max(Math.hypot(b.vx, b.vz) + 2, Math.hypot(v0x, v0z), want);
        const sa = v.x * this.slideX + v.z * this.slideZ;
        if (sa < this.slideV) { v.x += this.slideX * (this.slideV - sa); v.z += this.slideZ * (this.slideV - sa); }
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
    this.brushing = brushed && touched;
    // crash severity: net horizontal speed the collisions took off this frame (thrust, drag and guide ran before the loop)
    // forward thrust added this frame is taken out again, so holding forward into a wall never makes a hit count as
    // harder than the same impact with the key released (severity = what the wall took off the incoming speed)
    if (wallHit) events.wallLoss = Math.max(0, hStart - Math.hypot(v.x, v.z) - thrustDv);
    // ledge hop carry: once over the ledge (no contact this frame), give back the forward speed it absorbed
    if (this.hopCarry > 0 && !touched && p.y - F.radius > this.hopTop + 0.05) {
      if (!this.guiding && intent.thrust > 0.2) {
        const along = v.x * this.hopDir.x + v.z * this.hopDir.z;
        const add = Math.max(0, this.hopCarry - Math.max(0, along));
        v.x += this.hopDir.x * add;
        v.z += this.hopDir.z * add;
      }
      this.hopCarry = 0;
    } else if (this.hop <= 0 && this.hopCarry > 0) {
      // hop window over and the ledge was not cleared: drop the carry
      this.hopCarry = 0;
    }
    if (events.bump > 0) {
      this.bumpFlash = 1;
      this.bumpAmp = Math.min(1.6, 0.4 + events.bump / 10);
    }

    this.speed = Math.hypot(v.x, v.z);
    this.animate(dt, intent);
  }

  /**
   * True when the obstacle just contacted (along this.normal) is a low step: its top sits less than
   * FLIGHT.hopHeight above the bottom of the drone and nothing taller stands behind it.
   */
  private isLowLedge(world: CollisionWorld, p: THREE.Vector3): boolean {
    const n = this.normal;
    if (n.y > 0.7 || n.y < -0.2) return false;
    const hl = Math.hypot(n.x, n.z);
    if (hl < 1e-3) return false;
    const r = FLIGHT.radius;
    const px = p.x - (n.x / hl) * (r + 0.2);
    const pz = p.z - (n.z / hl) * (r + 0.2);
    const bottom = p.y - r;
    const top = world.surfaceBelow(px, bottom + FLIGHT.hopHeight, pz);
    if (top <= bottom - 0.05) return false;
    return world.surfaceBelow(px, 1e4, pz) <= top + 0.01;
  }

  /** Tallest obstacle top just inside the surface the drone is touching (along this.normal). */
  private columnTop(world: CollisionWorld, p: THREE.Vector3): number {
    const n = this.normal;
    const hl = Math.hypot(n.x, n.z);
    if (hl < 1e-3) return world.surfaceBelow(p.x, 1e4, p.z);
    // just past the contact point, horizontally into the obstacle
    const k = FLIGHT.radius * hl + 0.15;
    return world.surfaceBelow(p.x - (n.x / hl) * k, 1e4, p.z - (n.z / hl) * k);
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
    this.stepOffset *= Math.exp(-14 * dt);
    this.tilt.position.y = hover + this.stepOffset;
    // crash tumble: a damped roll/pitch shake that settles in about a second
    this.tumble = Math.max(0, this.tumble - dt * 1.1);
    const tk = this.tumble * this.tumble * this.tumbleAmp;
    const tumbleP = Math.sin(this.time * 17) * 0.35 * tk;
    const tumbleR = Math.sin(this.time * 23 + 1.3) * 0.55 * tk;
    this.tilt.rotation.set(this.pitch + wob + tumbleP, 0, this.roll - wob * 0.6 + tumbleR);

    // rotor spin follows throttle effort
    const effort = 0.5 + Math.abs(intent.thrust) * 0.25 + Math.max(0, intent.lift) * 0.3 + (this.boosting ? 0.5 : 0);
    const targetSpin = 55 + effort * 70;
    this.rotorSpeed += (targetSpin - this.rotorSpeed) * (1 - Math.exp(-5 * dt));
    this.rotorAngle += this.rotorSpeed * dt;
    this.rotorSpin.value = this.rotorAngle % (Math.PI * 2);
    this.blurMat.opacity = 0.08 + Math.min(0.18, (this.rotorSpeed - 50) / 500);
    this.blurMat.color.set(this.boosting ? '#9ff3ff' : '#d9e2ea');
    this.accentMat.emissiveIntensity = this.boosting ? 0.9 : 0;

    // strobe double-blink
    const ph = this.time % 1.4;
    this.strobeMat.emissiveIntensity = ph < 0.06 || (ph > 0.16 && ph < 0.22) ? 8 : 0;
    this.statusMat.emissiveIntensity = this.carrying ? 3 + Math.sin(this.time * 6) * 1.2 : 2.6;
    if (this.alarm > 0) {
      this.alarm = Math.max(0, this.alarm - dt / 0.9);
      const on = this.alarm > 0 && Math.sin(this.time * 30) > 0;
      this.statusMat.emissive.set(on ? '#ff4030' : this.carrying ? '#ffb02e' : '#38e8ff');
    }

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
      // snap-in: parcel is reeled up from below with an overshoot pop (round 26: from 1 m below, was 1.6: the long cable
      // made the drone plus parcel fill a phone screen right after a pickup)
      if (this.cargoSnap > 0) {
        this.cargoSnap = Math.max(0, this.cargoSnap - dt / 0.45);
        const t = 1 - this.cargoSnap;
        const c1 = 2.2, back = 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        this.cargo.position.y = -1.0 + (-0.22 + 1.0) * back;
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
