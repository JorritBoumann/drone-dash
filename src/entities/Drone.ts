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
export type FlightEvents = {
  bump: number; ledge: number; landed: boolean; wallLoss: number; wallTop: number; wallNormalY: number;
  /**
   * Round 39: glancing wall contacts (impact angle under FLIGHT.scrapeAngle). scrape: normal impact speed (0 = none),
   * scrapeSpeed: speed along the wall after it, sx/sy/sz the contact point, sdx/sdz the direction of travel along the wall,
   * snx/snz the wall normal. scrapeOld: the speed the round 38 response (bounce plus scrub) would have taken off, for the
   * "would have been charged" count. hitAngle (deg) and hitNx/hitNz: the hardest charged-type wall contact this frame.
   */
  scrape: number; scrapeSpeed: number; sx: number; sy: number; sz: number; sdx: number; sdz: number; snx: number; snz: number; scrapeOld: number;
  /** Round 40: column top at the scrape contact with the largest scrapeOld (the pad-edge exemption of the shadow rules). */
  scrapeTop: number;
  hitAngle: number; hitNx: number; hitNz: number;
};

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
  /** Round 48: seconds of free boost left from a tailwind ring (boost speed, the meter is not used). */
  gust = 0;
  private gustTurn = 0; // s of hard turn input at speed during a gust
  /**
   * Round 40: boost tail. Speed over the cruise top (m/s) the drone may still carry after a boost while forward is held.
   * It is set while boosting and eases down at FLIGHT.tailDecel (gentler near the end), so the boost tails off instead
   * of braking hard. It never adds speed: it only holds back the over-top drag.
   */
  carry = 0;
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
  // round 39: attitude spring state and its drive
  private pitchVel = 0;
  private rollVel = 0;
  private accF = 0; // smoothed forward acceleration from the flight controls (m/s^2; collisions left out)
  private accR = 0; // smoothed sideways acceleration
  private thrustCmd = 0; // forward thrust command this frame (-1..1.3)
  private readonly ctrlVel = new THREE.Vector3(); // velocity after controls, before collisions
  private tumbleYaw = 0; // visual-only body yaw wobble of a crash tumble (rad)
  private tumbleYawVel = 0;
  private sputter = 0; // 1 -> 0: rotors stutter after a crash
  private readonly rotorApp = { value: 0 }; // apparent rotor angle (reads as spinning without strobing)
  private readonly rotorSmear = { value: 0.4 }; // blur sector length, share of a quarter turn
  private readonly rotorVeil = { value: 0.08 };
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
    this.blurMat = new THREE.MeshBasicMaterial({ color: '#d9e2ea', transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide });
    this.blurMat.forceSinglePass = true; // round 33: one draw for the blur discs (a flat disc needs no back-then-front pass)
    {
      // round 39: the blur disc is a motion smear. Each of the 4 blade arms drags a fading sector behind it; the sector
      // grows with rotor speed and the whole pattern turns at an apparent rate (no strobing at 60 Hz). The blades turn
      // at the same apparent angle, so each blade leads its own smear.
      const app = this.rotorApp, smear = this.rotorSmear, veil = this.rotorVeil;
      this.blurMat.onBeforeCompile = (shader) => {
        shader.uniforms.uRotorApp = app;
        shader.uniforms.uSmear = smear;
        shader.uniforms.uVeil = veil;
        shader.vertexShader = 'attribute float spin;\nvarying vec2 vRuv;\nvarying float vSpin;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRuv = uv - 0.5; vSpin = spin;');
        shader.fragmentShader = 'uniform float uRotorApp;\nuniform float uSmear;\nuniform float uVeil;\nvarying vec2 vRuv;\nvarying float vSpin;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float rr = length(vRuv) * 2.0;
          float ang = atan(vRuv.y, vRuv.x) * vSpin - uRotorApp;
          float d = fract(ang / 1.5707963);          // 0 at a blade, rising toward the next one
          float behind = 1.0 - d;                     // share of a quarter turn behind the blade
          float sm = clamp(1.0 - behind / max(uSmear, 0.05), 0.0, 1.0);
          float body = smoothstep(0.12, 0.3, rr) * (1.0 - smoothstep(0.9, 1.0, rr));
          float tip = smoothstep(0.82, 0.93, rr) * (1.0 - smoothstep(0.93, 1.0, rr));
          diffuseColor.a = clamp(uVeil + sm * sm * 0.42 * body + tip * (0.1 + uSmear * 0.12), 0.0, 0.75) * (1.0 - smoothstep(0.97, 1.0, rr));`);
      };
      this.blurMat.customProgramCacheKey = () => 'drone-rotor-blur39';
    }
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
      const dg = discGeo.clone().translate(p.x, p.y + 0.135, p.z);
      dg.setAttribute('spin', new THREE.BufferAttribute(new Float32Array(dg.getAttribute('position').count).fill(i % 2 === 0 ? 1 : -1), 1));
      discParts.push(dg);
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
    this.gust = 0;
    this.gustTurn = 0;
    this.carry = 0;
    this.carrying = false;
    this.cargo.visible = false;
    this.pitch = this.roll = 0;
    this.pitchVel = this.rollVel = this.accF = this.accR = 0;
    this.tumble = this.tumbleYaw = this.tumbleYawVel = this.sputter = 0;
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

  /**
   * Hard crash: a visual tumble, a cargo jolt, a rotor sputter and a red status blink. Flight control is unchanged.
   * Round 39: the tumble is an angular kick on the attitude spring (the nose thrown up and back from the wall, a roll to
   * one side, a yaw wobble) plus the round 4 rattle, so the body clearly flips and then rights itself. nx/nz: the wall
   * normal (world, horizontal), which sets how much of the kick is pitch and how much is roll.
   */
  crash(strength: number, nx = 0, nz = 0, side = Math.random() < 0.5 ? -1 : 1): void {
    const s = THREE.MathUtils.clamp(strength, 0, 1);
    this.tumble = 1;
    this.tumbleAmp = 0.35 + s * 0.5;
    this.alarm = 1;
    this.sputter = 1;
    // wall normal in the drone's frame: along = how head-on (normal against the heading), across = from the side
    const fwd = -(nx * this.forward.x + nz * this.forward.z);
    const across = nx * -this.forward.z + nz * this.forward.x;
    const kick = 11 + s * 8; // rad/s
    const hasN = Math.hypot(nx, nz) > 0.1;
    const pitchShare = hasN ? THREE.MathUtils.clamp(Math.abs(fwd), 0.35, 1) : 0.8;
    this.pitchVel += kick * pitchShare; // nose thrown up, away from the wall
    this.rollVel += kick * (hasN && Math.abs(across) > 0.3 ? -Math.sign(across) * 0.9 : side * 0.75);
    this.tumbleYawVel += side * (6 + s * 5);
    if (this.carrying) this.cargoSwingVel.set((3 + s * 4) * Math.sign(fwd || 1), (Math.random() - 0.5) * 6);
  }

  /**
   * Round 40: a hard knock that is not a crash. A small kick on the attitude spring (the nose lifts off the wall about
   * 10 to 15 degrees and settles in about half a second) and the bump rattle. No tumble, no sputter, no alarm.
   */
  knock(strength: number, nx = 0, nz = 0): void {
    const s = THREE.MathUtils.clamp(strength, 0, 1);
    const fwd = -(nx * this.forward.x + nz * this.forward.z);
    const across = nx * -this.forward.z + nz * this.forward.x;
    const kick = 2.6 + s * 1.2; // rad/s (the crash kicks with 11 to 19)
    const hasN = Math.hypot(nx, nz) > 0.1;
    this.pitchVel += kick * (hasN ? THREE.MathUtils.clamp(Math.abs(fwd), 0.35, 1) : 0.8);
    this.rollVel += kick * 0.6 * (hasN && Math.abs(across) > 0.3 ? -Math.sign(across) : 0);
    if (this.carrying) this.cargoSwingVel.set((1.5 + s * 1.5) * Math.sign(fwd || 1), 0);
  }

  /** Round 39: attitude and effect state for probes (degrees where angles). */
  get feel(): { pitch: number; roll: number; tiltX: number; tiltZ: number; tumble: number; accF: number; accR: number; thrust: number; yawRate: number; cargoX: number; cargoZ: number; rotor: number; smear: number; sputter: number } {
    const d = THREE.MathUtils.radToDeg;
    return {
      pitch: d(this.pitch), roll: d(this.roll), tiltX: d(this.tilt.rotation.x), tiltZ: d(this.tilt.rotation.z), tumble: this.tumble,
      accF: this.accF, accR: this.accR, thrust: this.thrustCmd, yawRate: this.yawRate,
      cargoX: d(this.cargoSwing.x), cargoZ: d(this.cargoSwing.y), rotor: this.rotorSpeed, smear: this.rotorSmear.value, sputter: this.sputter,
    };
  }

  /** Round 39: smoothed forward acceleration from the controls (m/s^2), for the camera's spring arm. */
  get forwardAccel(): number {
    return this.accF;
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
    events.scrape = 0;
    events.scrapeSpeed = 0;
    events.scrapeOld = 0;
    events.scrapeTop = -1e9;
    events.hitAngle = -1;
    const F = FLIGHT;

    // Yaw with smoothed rate
    const targetRate = -intent.turn * F.turnRate;
    this.yawRate += (targetRate - this.yawRate) * (1 - Math.exp(-F.turnResponse * dt));
    this.yaw += this.yawRate * dt;
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));

    // Boost meter
    // round 48: a tailwind ring's gust boosts for free (the meter keeps refilling under it). Fix pass: it pushes only
    // while forward is held, and a hard turn at speed ends it (the player is taking a corner), so letting go of forward
    // or steering into a turn after a ring works the way it does without one
    if (this.gust > 0) {
      this.gust = Math.max(0, this.gust - dt);
      const hs = Math.hypot(this.velocity.x, this.velocity.z);
      this.gustTurn = Math.abs(intent.turn) > 0.5 && hs > F.maxSpeed * 0.8 ? this.gustTurn + dt : 0;
      if (this.gustTurn > F.gustTurnCut) this.gust = 0;
    } else this.gustTurn = 0;
    const gustPush = this.gust > 0 && intent.thrust > 0.2;
    const wantsBoost = intent.boost && this.boost > 0.02 && !gustPush;
    this.boosting = wantsBoost || gustPush;
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
    this.thrustCmd = thrustIn * (this.boosting ? 1.3 : 1);
    // round 39: over the top speed, forward thrust no longer pushes (it used to: with the gentle over-top drag the speed
    // ran away to about 2.9 x top, 48 m/s after a boost or a fast carve with W held, 88 m/s while boosting). The leftover
    // speed still bleeds off gently, as before.
    const push = thrustIn > 0 && hSpeed > top + 0.5 && !F.overTopPush ? 0 : thrustIn;
    const thrustDv = Math.max(0, push) * thrust * dt;
    v.x += this.forward.x * push * thrust * dt;
    v.z += this.forward.z * push * thrust * dt;
    // reversing is weaker than going forward
    const k = Math.exp(-drag * dt * (thrustIn < 0 ? 1.4 : 1));
    // outside of boost, excess speed bleeds off gently instead of snapping
    v.x *= k;
    v.z *= k;
    // round 40: boost tail. While boosting the carry follows the speed over the cruise top. After the boost, with forward
    // held (and not airbraking onto a pad), the speed is held at min(speed before the drag, top + carry), and the carry
    // eases down: tailDecel m/s^2 at most, tailBase + tailEase x carry near the end. The headwind eats it faster.
    const cruiseTop = F.maxSpeed * (1 - F.headwindSlow * this.headwind);
    // near the objective's pad (inside the airbrake range) the tail ends: arriving is the normal over-top bleed, as before
    const nearPad = this.hasGuide && Math.hypot(this.guide.x - p0.x, this.guide.z - p0.z) < F.guideBrakeRange;
    if (this.boosting) this.carry = Math.max(this.carry, hSpeed - cruiseTop);
    else if (nearPad) this.carry = 0;
    else if (this.carry > 0) {
      const rate = Math.min(F.tailDecel, F.tailBase + F.tailEase * this.carry) * (1 + F.tailWind * this.headwind);
      this.carry = Math.max(0, this.carry - rate * dt);
      if (thrustIn > 0.2 && !diving && hSpeed > top + 0.5) {
        const hold = Math.min(hSpeed, top + this.carry);
        const now = Math.hypot(v.x, v.z);
        if (now > 1e-3 && now < hold) {
          v.x *= hold / now;
          v.z *= hold / now;
        }
      }
    }
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

    // round 39: the velocity the controls asked for (before any contact), the drive of the attitude
    this.ctrlVel.copy(v);
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
        } else if (vn < 0 && this.glancing(v, low) < F.scrapeAngle) {
          // round 39: a glancing wall hit is a scrape: it slides along the wall with a small bounce, loses speed along
          // the wall by friction (scrapeFriction x the normal speed) and is never a crash (no wallHit, no wallLoss)
          const impact = -vn, n = this.normal, hBefore = Math.hypot(v.x, v.z);
          // what the round 38 response would have taken off (for the count of hits this round made free)
          {
            const ox = v.x - n.x * (1 + F.bounce) * vn, oy = v.y - n.y * (1 + F.bounce) * vn, oz = v.z - n.z * (1 + F.bounce) * vn;
            let rx = ox, rz = oz;
            if (impact > 2.5) {
              const on = ox * n.x + oy * n.y + oz * n.z;
              rx = n.x * on + (ox - n.x * on) * F.bumpFriction;
              rz = n.z * on + (oz - n.z * on) * F.bumpFriction;
            }
            const oldLost = hBefore - Math.hypot(rx, rz);
            if (oldLost > events.scrapeOld) {
              events.scrapeOld = oldLost;
              // round 40 (Codex C): the round 38 rules took the column top at this contact for the pad-edge exemption
              events.scrapeTop = this.columnTop(world, p);
            }
          }
          v.addScaledVector(n, -(1 + F.scrapeBounce) * vn);
          const on = v.dot(n);
          this.tmp.copy(v).addScaledVector(n, -on); // along the wall
          const tl = this.tmp.length();
          const keep = tl > 1e-3 ? Math.max(0.5, 1 - (F.scrapeFriction * impact) / tl) : 1;
          v.copy(n).multiplyScalar(on).addScaledVector(this.tmp, keep);
          if (impact > events.scrape) {
            events.scrape = impact;
            events.scrapeSpeed = Math.hypot(this.tmp.x, this.tmp.z) * keep;
            events.sx = p.x - n.x * F.radius; events.sy = p.y - n.y * F.radius; events.sz = p.z - n.z * F.radius;
            const th = Math.hypot(this.tmp.x, this.tmp.z) || 1;
            events.sdx = this.tmp.x / th; events.sdz = this.tmp.z / th;
            const nh = Math.hypot(n.x, n.z) || 1;
            events.snx = n.x / nh; events.snz = n.z / nh;
          }
        } else if (vn < 0) {
          const impact = -vn;
          const hBefore = Math.hypot(v.x, v.z);
          const hitAngle = this.normal.y < 0.7 && !low ? this.glancing(v, low) : -1;
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
                events.hitAngle = hitAngle;
                const nh = Math.hypot(this.normal.x, this.normal.z) || 1;
                events.hitNx = this.normal.x / nh;
                events.hitNz = this.normal.z / nh;
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
    } else if (events.scrape > 1.5) {
      // round 39: a scrape rattles the drone a little
      this.bumpFlash = Math.max(this.bumpFlash, 0.6);
      this.bumpAmp = Math.min(0.8, 0.25 + events.scrape / 16);
    }

    this.speed = Math.hypot(v.x, v.z);
    // round 40: the boost tail never outlives the speed (a wall, a brake or a turn that took the speed off ends it)
    if (!this.boosting) this.carry = Math.min(this.carry, Math.max(0, this.speed - F.maxSpeed * (1 - F.headwindSlow * this.headwind)));
    this.animate(dt, intent);
  }

  /**
   * Round 39: impact angle (deg) between the horizontal velocity and a wall face (this.normal), from the velocity
   * component along the wall normal: 0 = sliding along it, 90 = straight into it. Returns 90 (never a scrape) for
   * floors, ceilings, low steps and a drone barely moving sideways.
   */
  private glancing(v: THREE.Vector3, low: boolean): number {
    const n = this.normal;
    if (low || n.y >= 0.7 || n.y < -0.5) return 90;
    const nh = Math.hypot(n.x, n.z), h = Math.hypot(v.x, v.z);
    if (nh < 0.5 || h < 1) return 90;
    const into = -(v.x * n.x + v.z * n.z) / nh;
    return THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(into / h, 0, 1)));
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
    const rightX = -this.forward.z, rightZ = this.forward.x;
    // round 39: acceleration the controls produced this frame (thrust, drag, grip, guide; wall contacts left out),
    // low-passed so single frames never twitch the body
    const cax = dt > 0 ? (this.ctrlVel.x - this.prevVel.x) / dt : 0;
    const caz = dt > 0 ? (this.ctrlVel.z - this.prevVel.z) / dt : 0;
    const aF = cax * this.forward.x + caz * this.forward.z;
    const aR = cax * rightX + caz * rightZ;
    const la = 1 - Math.exp(-10 * dt);
    this.accF += (THREE.MathUtils.clamp(aF, -80, 80) - this.accF) * la;
    this.accR += (THREE.MathUtils.clamp(aR, -80, 80) - this.accR) * la;

    const sf = Math.min(1, Math.abs(fwdSpeed) / F.maxSpeed);
    // pitch: nose down for forward thrust (more under boost), plus the forward acceleration (braking lifts the nose)
    const targetPitch = THREE.MathUtils.clamp(-(this.thrustCmd * F.attPitchForce + THREE.MathUtils.clamp(this.accF / F.thrust, -1.5, 1.5) * F.attPitchAccel), -0.48, 0.48);
    // roll: into the turn by the yaw rate, more at speed, plus a little of the sideways acceleration
    const targetRoll = THREE.MathUtils.clamp(this.yawRate / F.turnRate, -1, 1) * F.attRoll * (F.attRollSlow + (1 - F.attRollSlow) * sf)
      - THREE.MathUtils.clamp(this.accR / 40, -1, 1) * 0.08;
    // lightly damped spring (sub-stepped for long frames); looser while a crash tumble plays, so the flip reads
    const w = F.attFreq * (1 - 0.55 * this.tumble), z = F.attDamp;
    const n = Math.max(1, Math.ceil(dt / 0.012)), h = dt / n;
    for (let i = 0; i < n; i++) {
      this.pitchVel += (w * w * (targetPitch - this.pitch) - 2 * z * w * this.pitchVel) * h;
      this.rollVel += (w * w * (targetRoll - this.roll) - 2 * z * w * this.rollVel) * h;
      this.pitch += this.pitchVel * h;
      this.roll += this.rollVel * h;
      this.tumbleYawVel += (-90 * this.tumbleYaw - 7 * this.tumbleYawVel) * h;
      this.tumbleYaw += this.tumbleYawVel * h;
    }
    this.group.rotation.set(0, this.yaw, 0);
    // hover bob + wobble from bumps
    const hover = Math.sin(this.time * 2.1) * F.hoverBob * (1 - sf * 0.7);
    this.bumpFlash = Math.max(0, this.bumpFlash - dt * 3);
    const wob = Math.sin(this.time * 38) * this.bumpFlash * 0.12 * this.bumpAmp;
    this.stepOffset *= Math.exp(-14 * dt);
    this.tilt.position.y = hover + this.stepOffset;
    // crash rattle on top of the tumble kick: a damped roll/pitch shake that settles in about a second
    this.tumble = Math.max(0, this.tumble - dt * 1.1);
    const tk = this.tumble * this.tumble * this.tumbleAmp;
    const tumbleP = Math.sin(this.time * 17) * 0.2 * tk;
    const tumbleR = Math.sin(this.time * 23 + 1.3) * 0.3 * tk;
    this.tilt.rotation.set(this.pitch + wob + tumbleP, this.tumbleYaw, this.roll - wob * 0.6 + tumbleR, 'YXZ');

    // rotor spin follows throttle effort; a crash makes them sputter (stall and catch) for about 0.7 s
    this.sputter = Math.max(0, this.sputter - dt / 0.7);
    const effort = 0.5 + Math.abs(intent.thrust) * 0.25 + Math.max(0, intent.lift) * 0.3 + (this.boosting ? 0.5 : 0);
    let targetSpin = 55 + effort * 70;
    if (this.sputter > 0) targetSpin *= 0.35 + 0.65 * (1 - this.sputter) * (0.5 + 0.5 * Math.sign(Math.sin(this.time * 31)));
    this.rotorSpeed += (targetSpin - this.rotorSpeed) * (1 - Math.exp(-(this.sputter > 0 ? 12 : 5) * dt));
    this.rotorAngle += this.rotorSpeed * dt;
    // round 39: blades and smear turn at an apparent 2 to 3.5 turns a second (no strobing); the smear grows with speed
    this.rotorApp.value = (this.rotorApp.value + this.rotorSpeed * 0.17 * dt) % (Math.PI * 2);
    this.rotorSpin.value = this.rotorApp.value;
    const r01 = THREE.MathUtils.clamp((this.rotorSpeed - 45) / 95, 0, 1);
    this.rotorSmear.value = 0.3 + r01 * 0.62;
    this.rotorVeil.value = 0.05 + r01 * 0.07;
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

    // cargo: a damped pendulum on its pivot, driven by the drone's acceleration (round 39: it now lags behind the
    // acceleration, as a hanging load does, and hangs plumb against the body's tilt)
    if (this.carrying) {
      const ax = dt > 0 ? (v.x - this.prevVel.x) / dt : 0;
      const az = dt > 0 ? (v.z - this.prevVel.z) / dt : 0;
      // into drone local frame
      const lf = THREE.MathUtils.clamp(ax * this.forward.x + az * this.forward.z, -60, 60);
      const lr = THREE.MathUtils.clamp(ax * rightX + az * rightZ, -60, 60);
      const kSpring = 22, damp = 2.4;
      const m = Math.max(1, Math.ceil(dt / 0.012)), hh = dt / m;
      for (let i = 0; i < m; i++) {
        this.cargoSwingVel.x += (-kSpring * this.cargoSwing.x - damp * this.cargoSwingVel.x - lf * 0.2) * hh;
        this.cargoSwingVel.y += (-kSpring * this.cargoSwing.y - damp * this.cargoSwingVel.y - lr * 0.2) * hh;
        this.cargoSwing.addScaledVector(this.cargoSwingVel, hh);
      }
      this.cargoSwing.x = THREE.MathUtils.clamp(this.cargoSwing.x, -0.6, 0.6);
      this.cargoSwing.y = THREE.MathUtils.clamp(this.cargoSwing.y, -0.6, 0.6);
      this.cargo.rotation.set(this.cargoSwing.x - this.pitch, 0, this.cargoSwing.y - this.roll);
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
