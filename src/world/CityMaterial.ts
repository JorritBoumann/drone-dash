import * as THREE from 'three';

export type CityMaterial = THREE.MeshStandardMaterial & {
  userData: { shader?: { uniforms: Record<string, THREE.IUniform> }; uniforms?: Record<string, THREE.IUniform> };
};

/**
 * One material for the whole merged city. Surfaces are differentiated by the
 * per-vertex `aStyle` attribute: procedural windows (lit / reflective), roof
 * gravel, paving grid, grass, roof tiles, solar panels and emissive lamps.
 */
export function createCityMaterial(): CityMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.0,
    envMapIntensity: 0.55,
  }) as CityMaterial;

  const uniforms = {
    uLitAmount: { value: 0.16 },
    uLitIntensity: { value: 0.95 },
    uSkyTop: { value: new THREE.Color('#6f9fd8') },
    uSkyHorizon: { value: new THREE.Color('#ffc890') },
    uTime: { value: 0 },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    material.userData.shader = shader;

    shader.vertexShader =
      /* glsl */ `
      attribute float aStyle;
      attribute float aSeed;
      varying vec2 vFacadeUv;
      varying float vStyle;
      varying float vSeed;
      varying vec3 vObjNormal;
      varying vec3 vCityPos;
      ` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        vFacadeUv = uv;
        vStyle = aStyle;
        vSeed = aSeed;
        vObjNormal = normal;
        vCityPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );

    shader.fragmentShader =
      /* glsl */ `
      uniform float uLitAmount;
      uniform float uLitIntensity;
      uniform vec3 uSkyTop;
      uniform vec3 uSkyHorizon;
      uniform float uTime;
      varying vec2 vFacadeUv;
      varying float vStyle;
      varying float vSeed;
      varying vec3 vObjNormal;
      varying vec3 vCityPos;

      float cHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float cNoise(vec2 p){
        vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(cHash(i), cHash(i+vec2(1,0)), f.x), mix(cHash(i+vec2(0,1)), cHash(i+vec2(1,1)), f.x), f.y);
      }
      float boxMask(vec2 p, vec2 c, vec2 h){
        vec2 d = abs(p - c) - h;
        float e = max(d.x, d.y);
        float aa = max(fwidth(e) * 0.75, 0.002);
        return 1.0 - smoothstep(-aa, aa, e);
      }
      ` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          /* glsl */ `#include <color_fragment>
          float gWin = 0.0;       // window glass coverage
          float gLit = 0.0;       // lit interior
          vec3 gLitCol = vec3(1.0, 0.72, 0.4);
          vec3 gEmissive = vec3(0.0);
          float gRough = -1.0;
          float gH = 0.0;         // round 27: relief height for the bump (mortar, reveals, panel joints)
          float s = floor(vStyle + 0.5);
          // round 27: the seed carries the wall material in its high bits (seed + 256 * material)
          float sRaw = floor(vSeed + 0.5);
          float mt = floor(sRaw / 256.0 + 0.001);
          float sd = sRaw - mt * 256.0;
          vec3 wn = normalize(vObjNormal);
          if (s > -0.5) {
            if (wn.y > 0.5) {
              // flat roof: membrane sheets with seams, patches and soot near the edges
              vec3 roofBase = mix(diffuseColor.rgb, vec3(0.52, 0.5, 0.49), 0.72);
              float n = cNoise(vCityPos.xz * 2.7) * 0.5 + cNoise(vCityPos.xz * 0.35) * 0.5;
              vec2 sh = abs(fract(vCityPos.xz / vec2(1.9, 7.0)) - 0.5);
              float seam = smoothstep(0.47, 0.5, sh.x);
              float rpatch = step(0.78, cNoise(floor(vCityPos.xz / 2.3) * 1.3 + sd));
              diffuseColor.rgb = roofBase * (0.86 + n * 0.22) * (1.0 - seam * 0.12) * (1.0 - rpatch * 0.12);
            } else if (wn.y > -0.5) {
              vec2 g = vFacadeUv;
              vec2 id = floor(g);
              vec2 f = fract(g);
              vec2 h; float cy = 0.55;
              float ground = step(abs(id.y), 0.5);
              if (s < 0.5)      { h = vec2(0.24, 0.27); }
              else if (s < 1.5) { h = vec2(0.5, 0.21); cy = 0.52; }
              else if (s < 2.5) { h = vec2(0.17, 0.33); }
              else              { h = vec2(0.47, 0.45); cy = 0.5; }
              float rnd = cHash(id + vec2(sd * 0.731, sd * 0.379));
              float rnd2 = cHash(id * 1.91 + vec2(sd * 0.17, 3.7));
              float hue = cHash(id.yx * 1.37 + sd * 0.53);
              vec2 m = vec2(g.x * 2.7, vCityPos.y);       // metres along the face and up
              float far = clamp(max(fwidth(g.x), fwidth(g.y)) * 7.0, 0.0, 1.0); // 1 when a window is a few pixels
              vec3 wall = diffuseColor.rgb;
              float shop = ground * step(s, 2.5);
              // ---- wall material ----
              if (mt > 0.5 && mt < 1.5) {
                // brick: running bond, per-brick tone, mortar joints (faded out where the bricks get sub-pixel)
                int bt = int(mod(sd, 4.0));
                vec3 tone = bt == 0 ? vec3(0.36, 0.11, 0.07) : bt == 1 ? vec3(0.42, 0.2, 0.11) : bt == 2 ? vec3(0.27, 0.13, 0.1) : wall * 0.9;
                vec2 bk = m / vec2(0.25, 0.085);
                float row = floor(bk.y);
                float bxx = bk.x + mod(row, 2.0) * 0.5;
                float bfade = 1.0 - smoothstep(0.25, 0.7, max(fwidth(bk.x), fwidth(bk.y)));
                float bv = cHash(vec2(floor(bxx), row) * 0.37 + sd);
                float mort = max(1.0 - smoothstep(0.0, 0.08, fract(bxx)) , 1.0 - smoothstep(0.0, 0.16, fract(bk.y)));
                wall = mix(wall, tone, 0.82) * (0.88 + bv * 0.22 * bfade);
                wall = mix(wall, vec3(0.42, 0.4, 0.37), mort * 0.7 * bfade);
                gH -= mort * 0.35 * bfade;
              } else if (mt > 1.5 && mt < 2.5) {
                // precast concrete: a panel per bay and storey, joints, slight tone per panel, water stains
                vec2 pj = abs(f - 0.5);
                float joint = smoothstep(0.485, 0.5, max(pj.x, pj.y * 1.0));
                float pv = cHash(id * 0.71 + sd * 0.3);
                wall = mix(wall, vec3(0.5, 0.49, 0.46), 0.55) * (0.93 + pv * 0.1);
                wall *= 1.0 - joint * 0.35;
                gH -= joint * 0.5;
              } else if (mt > 2.5 && mt < 3.5) {
                // dressed stone: courses and staggered joints, deeper (rusticated) on the ground floor
                vec2 st = vec2(m.x / 1.1, m.y / (ground > 0.5 ? 0.53 : 0.8));
                float row = floor(st.y);
                float sx = fract(st.x + mod(row, 2.0) * 0.5);
                float jw = ground > 0.5 ? 0.06 : 0.025;
                float sj = max(1.0 - smoothstep(0.0, jw, sx), 1.0 - smoothstep(0.0, jw * 2.2, fract(st.y))) * (1.0 - far);
                float sv = cHash(vec2(floor(st.x + mod(row, 2.0) * 0.5), row) + sd);
                wall = mix(wall, vec3(0.62, 0.55, 0.45), 0.5) * (0.94 + sv * 0.09);
                wall *= 1.0 - sj * 0.28;
                gH -= sj * 0.6;
              } else if (mt > 3.5) {
                // office: metal spandrels between the glass bands, panel seams per bay
                float seam = smoothstep(0.48, 0.5, abs(f.x - 0.5));
                wall = mix(wall, vec3(0.3, 0.33, 0.36), 0.35) * (1.0 - seam * 0.25);
                gRough = 0.45;
              } else {
                // painted plaster: soft mottling
                float mo = cNoise(m * 0.9 + sd) * 0.6 + cNoise(m * 4.1) * 0.4;
                wall *= 0.93 + mo * 0.12;
              }
              // weathering: vertical streaks, darker toward the ground (grime and splash-back)
              float weather = cNoise(vec2(g.x * 0.7, vCityPos.y * 0.15) + sd * 0.17) * 0.08;
              wall *= 0.94 + weather;
              float grime = 1.0 - smoothstep(0.25, 1.6, vCityPos.y);
              wall *= 1.0 - grime * 0.22 * (0.7 + 0.6 * cNoise(m * vec2(2.3, 6.0)));
              // storey ledge (string course) at each floor line
              float ledge = (1.0 - smoothstep(0.0, 0.05, f.y)) * (1.0 - shop);
              wall = mix(wall, wall * 0.8, ledge * 0.6);
              gH += ledge * 0.3;
              float win = 0.0, glassTone = 0.0;
              vec3 glass = vec3(0.0);
              if (shop > 0.5) {
                // ---- ground floor shop front: fascia sign, big glazing with a mullion, a door in some bays, kick plate
                float bay = floor(id.x / 2.0);
                float bh = cHash(vec2(bay, sd) * 0.913);
                float pier = 1.0 - step(0.07, f.x) * step(f.x, 0.93);
                float fascia = step(0.76, f.y) * step(f.y, 0.94) * (1.0 - pier) * step(0.22, bh);
                float kick = step(f.y, 0.08) * (1.0 - pier);
                float door = step(0.6, bh) * step(0.5, cHash(id + sd)) ;
                vec2 dc = vec2(0.5, 0.36);
                float doorM = door * boxMask(f, dc, vec2(0.15, 0.36));
                float glz = boxMask(f, vec2(0.5, 0.42), vec2(0.42, 0.32)) * (1.0 - doorM);
                float mull = (1.0 - smoothstep(0.008, 0.016, abs(f.x - 0.5))) * (1.0 - door);
                glz *= 1.0 - mull;
                vec3 signCol = bh < 0.2 ? vec3(0.06, 0.12, 0.1) : bh < 0.4 ? vec3(0.42, 0.06, 0.04) : bh < 0.6 ? vec3(0.05, 0.08, 0.2) : bh < 0.8 ? vec3(0.55, 0.36, 0.06) : vec3(0.03, 0.03, 0.035);
                // letters: blocky glyph marks centred on the fascia
                float lx = f.x * 9.0 + mod(id.x, 2.0) * 9.0;
                float letter = step(0.35, cHash(vec2(floor(lx * 1.0), bay + sd))) * step(0.15, fract(lx)) * step(fract(lx), 0.85)
                  * step(0.805, f.y) * step(f.y, 0.905) * step(1.5, lx) * step(lx, 16.5) * (1.0 - far);
                wall = mix(wall, signCol, fascia);
                wall = mix(wall, vec3(0.92, 0.86, 0.72), fascia * letter);
                wall = mix(wall, wall * 0.5 + vec3(0.03), kick);
                wall = mix(wall, vec3(0.08, 0.06, 0.05), doorM);
                gEmissive += fascia * letter * vec3(1.0, 0.8, 0.5) * (uLitAmount * 2.2) * step(0.45, bh);
                gH += fascia * 0.6 - glz * 0.6 + pier * 0.4;
                win = glz;
                // shop interior: floor, a back wall and shelves of coloured goods; dark glass in front
                vec2 lp = (f - vec2(0.08, 0.1)) / vec2(0.84, 0.64);
                float shelfRow = floor(lp.y * 3.2);
                float onShelf = step(0.12, fract(lp.y * 3.2)) * step(fract(lp.y * 3.2), 0.62) * step(0.18, lp.y) * step(lp.y, 0.9);
                vec2 cell = vec2(floor(lp.x * 11.0), shelfRow);
                float gh = cHash(cell + vec2(bay * 3.1, sd));
                vec3 goods = gh < 0.25 ? vec3(0.55, 0.12, 0.08) : gh < 0.5 ? vec3(0.75, 0.6, 0.25) : gh < 0.75 ? vec3(0.12, 0.3, 0.4) : vec3(0.6, 0.58, 0.52);
                float item = onShelf * step(0.15, fract(lp.x * 11.0)) * step(fract(lp.x * 11.0), 0.88) * step(0.3, gh);
                glass = mix(vec3(0.07, 0.065, 0.06), vec3(0.2, 0.17, 0.14), smoothstep(0.15, 0.6, lp.y));
                glass = mix(glass, goods * 0.6, item * (1.0 - far));
                glass = mix(glass, vec3(0.05, 0.07, 0.09), 0.25);
                glassTone = 1.0;
                float lit = step(0.7 - uLitAmount * 1.4, rnd);
                gLitCol = mix(vec3(1.0, 0.78, 0.5), vec3(0.95, 0.9, 0.78), hue) * mix(vec3(0.3), goods * 1.4 + 0.15, item);
                gLit = lit * glz * (0.35 + 0.65 * smoothstep(0.0, 1.0, lp.y)) * (0.45 + uLitAmount * 1.5);
                // some bays are a residential entrance: wall, a panelled door and a transom, no shop window
                if (bh < 0.22) {
                  float rdoor = boxMask(f, vec2(0.5, 0.33), vec2(0.13, 0.33));
                  float transom = boxMask(f, vec2(0.5, 0.72), vec2(0.13, 0.04));
                  wall = mix(wall, vec3(0.12, 0.07, 0.05) * (0.85 + 0.15 * step(0.5, fract(f.y * 6.0))), rdoor);
                  win = transom; glass = vec3(0.1, 0.12, 0.14);
                  gLit = transom * lit * 0.6; gLitCol = vec3(1.0, 0.75, 0.45);
                }
              } else {
                if (ground > 0.5) { h = vec2(0.47, 0.42); cy = 0.46; }
                vec2 c = vec2(0.5, cy);
                win = boxMask(f, c, h);
                float frameO = boxMask(f, c, h + vec2(0.035, 0.03));
                float frame = frameO - win;
                float sill = boxMask(f, vec2(0.5, cy - h.y - 0.03), vec2(h.x + 0.07, 0.022));
                float lintel = (mt > 0.5 && mt < 3.5) ? boxMask(f, vec2(0.5, cy + h.y + 0.045), vec2(h.x + 0.05, 0.04)) : 0.0;
                // rain streaks under the sill
                float below = step(f.y, cy - h.y - 0.05) * step(abs(f.x - 0.5), h.x * 0.9);
                float streak = below * smoothstep(0.35, 0.8, cNoise(vec2(m.x * 9.0, m.y * 0.6 + sd))) * (1.0 - f.y / max(cy - h.y, 0.01)) ;
                wall *= 1.0 - streak * 0.18 * (1.0 - far);
                // shutters on painted residential facades
                float shut = 0.0;
                if (mt < 0.5 && s > 1.5 && s < 2.5 && rnd2 > 0.25) {
                  shut = boxMask(f, vec2(0.5 - h.x - 0.1, cy), vec2(0.085, h.y)) + boxMask(f, vec2(0.5 + h.x + 0.1, cy), vec2(0.085, h.y));
                  vec3 sc = mod(sd, 3.0) < 1.0 ? vec3(0.12, 0.24, 0.16) : mod(sd, 3.0) < 2.0 ? vec3(0.1, 0.2, 0.32) : vec3(0.32, 0.18, 0.1);
                  float slat = 0.85 + 0.15 * step(0.5, fract(f.y * 30.0));
                  wall = mix(wall, sc * mix(1.0, slat, 1.0 - far), shut);
                  gH += shut * 0.3;
                }
                vec3 trimC = mt > 3.5 ? vec3(0.18, 0.19, 0.2) : (mt > 0.5 && mt < 1.5) ? vec3(0.78, 0.74, 0.66) : wall * 1.25 + 0.05;
                wall = mix(wall, trimC, clamp(frame + sill + lintel, 0.0, 1.0) * 0.9);
                gH += (sill + lintel) * 0.7 + frame * 0.35;
                // the glass: a recessed opening (reveal shadow on the top and one side), an interior behind it
                vec2 lp = (f - (c - h)) / (2.0 * h);
                float reveal = (1.0 - smoothstep(0.0, 0.14, 1.0 - lp.y)) + (1.0 - smoothstep(0.0, 0.09, lp.x)) * 0.6;
                gH -= win * 0.9;
                // interior: dark floor, back wall, lighter ceiling; curtains or blinds in some windows
                vec3 room = mix(vec3(0.05, 0.045, 0.04), vec3(0.16, 0.13, 0.11), smoothstep(0.1, 0.35, lp.y));
                room = mix(room, vec3(0.24, 0.22, 0.2), smoothstep(0.82, 0.95, lp.y));
                float curtain = 0.0;
                if (s > 0.5 && s < 1.5) {
                  // office blinds, lowered to a random height
                  float bl = 1.0 - rnd2 * 0.8;
                  curtain = step(bl, lp.y) * (0.75 + 0.25 * step(0.5, fract(lp.y * 22.0)));
                  room = mix(room, vec3(0.5, 0.5, 0.48), curtain * 0.7);
                } else if (s < 2.5) {
                  float cw = rnd2 < 0.4 ? 0.0 : rnd2 < 0.75 ? 0.22 : 0.42;
                  curtain = max(step(lp.x, cw), step(1.0 - cw, lp.x)) * (0.85 + 0.15 * sin(lp.x * 60.0));
                  vec3 cc = hue < 0.33 ? vec3(0.6, 0.55, 0.45) : hue < 0.66 ? vec3(0.45, 0.2, 0.15) : vec3(0.25, 0.32, 0.4);
                  room = mix(room, cc * 0.6, curtain);
                }
                float mull = 0.0;
                if (s < 0.5 || (s > 1.5 && s < 2.5)) mull = (1.0 - smoothstep(0.012, 0.024, abs(lp.x - 0.5))) + (1.0 - smoothstep(0.012, 0.03, abs(lp.y - 0.62)));
                if (s > 0.5 && s < 1.5) mull = 1.0 - smoothstep(0.465, 0.485, abs(fract(g.x * 2.0) - 0.5));
                if (s > 2.5) mull = (1.0 - smoothstep(0.47, 0.49, abs(fract(g.x * 2.0) - 0.5))) + (1.0 - smoothstep(0.45, 0.48, abs(f.y - 0.5)));
                mull = clamp(mull, 0.0, 1.0) * win;
                glass = mix(vec3(0.05, 0.08, 0.12), vec3(0.11, 0.16, 0.22), rnd);
                if (ground > 0.5) room = mix(vec3(0.16, 0.14, 0.12), vec3(0.42, 0.38, 0.32), smoothstep(0.0, 0.9, lp.y)); // lobby
                glass = mix(glass, room, (1.0 - far * 0.6) * (s > 2.5 && ground < 0.5 ? 0.35 : 0.75));
                glass *= 1.0 - clamp(reveal, 0.0, 1.0) * 0.55;
                glassTone = 1.0;
                float lit = step(1.0 - uLitAmount - ground * 0.35, rnd);
                gLitCol = mix(vec3(1.0, 0.5, 0.18), vec3(1.0, 0.74, 0.42), hue) * (1.0 - ground * 0.45);
                gLit = lit * win * (1.0 - mull) * (0.55 + 0.45 * smoothstep(0.2, 0.95, lp.y)) * (1.0 - curtain * 0.45) * (1.0 - reveal * 0.4);
                wall = mix(wall, trimC * 0.8, mull);
                win *= 1.0 - mull;
              }
              diffuseColor.rgb = mix(wall, glass, win * glassTone);
              gWin = win;
              gH *= 1.0 - far;
            }
          } else if (s > -1.5) {
            // plain trim
          } else if (s > -2.5) {
            // paving: tile grid in world space; curbs on vertical faces
            if (wn.y > 0.5) {
              vec2 t = vCityPos.xz / 1.4;
              vec2 ft = abs(fract(t) - 0.5);
              float line = smoothstep(0.47, 0.5, max(ft.x, ft.y));
              float n = cNoise(floor(t) * 1.7);
              diffuseColor.rgb *= (0.92 + n * 0.12) * (1.0 - line * 0.18);
            } else {
              diffuseColor.rgb = vec3(0.68, 0.66, 0.63);
            }
          } else if (s > -3.5) {
            float n = cNoise(vCityPos.xz * 0.6) * 0.6 + cNoise(vCityPos.xz * 3.1) * 0.4;
            diffuseColor.rgb *= 0.78 + n * 0.4;
          } else if (s > -4.5) {
            float n = cNoise(vCityPos.xz * 2.7);
            diffuseColor.rgb *= 0.88 + n * 0.2;
          } else if (s > -5.5) {
            gEmissive = diffuseColor.rgb * 2.6;
          } else if (s > -6.5) {
            vec2 t = fract(vFacadeUv * vec2(6.0, 3.0));
            float line = step(0.92, max(t.x, t.y));
            diffuseColor.rgb = mix(vec3(0.07, 0.11, 0.2), vec3(0.6, 0.62, 0.66), line);
            gRough = 0.22;
          } else if (s > -7.5) {
            // roof tiles: rows along slope, staggered joints
            vec2 t = vFacadeUv * vec2(1.0 / 0.55, 1.0 / 0.38);
            float row = floor(t.y);
            float fx = fract(t.x + row * 0.5);
            float fy = fract(t.y);
            float shade = 0.78 + 0.22 * smoothstep(0.0, 0.85, fy);
            float joint = smoothstep(0.0, 0.06, fx) * smoothstep(1.0, 0.94, fx);
            float n = cHash(vec2(floor(t.x + row * 0.5), row) * 0.71 + sd * 0.13);
            diffuseColor.rgb *= shade * (0.9 + n * 0.16) * mix(0.75, 1.0, joint);
          } else if (s > -8.5) {
            gRough = 0.08;
          } else {
            // round 27: awning canvas: wide stripes (every other one pale), darker valance, soft fabric sheen
            float stripe = step(0.5, fract(vFacadeUv.x));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.82, 0.74), stripe * step(mod(sd, 2.0), 0.5) * 0.85);
            diffuseColor.rgb *= 0.92 + 0.08 * sin(vFacadeUv.x * 6.2832);
            gRough = 0.75;
          }
          `,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          /* glsl */ `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.12, gWin);
          if (gRough >= 0.0) roughnessFactor = mix(gRough, 0.12, gWin);`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          /* glsl */ `#include <normal_fragment_maps>
          // round 27: relief from the facade pattern (mortar, joints, reveals, sills) as a derivative bump
          {
            vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
            float hx = dFdx(gH) * 0.05, hy = dFdy(gH) * 0.05;
            vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
            float det = dot(dpx, r1);
            vec3 grad = sign(det) * (hx * r1 + hy * r2);
            normal = normalize(abs(det) * normal - grad);
          }`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          /* glsl */ `#include <emissivemap_fragment>
          {
            vec3 vdir = normalize(vViewPosition);
            float fres = pow(1.0 - saturate(dot(normal, vdir)), 3.0);
            vec3 refl = mix(uSkyHorizon, uSkyTop, 0.35 + 0.4 * fres);
            totalEmissiveRadiance += gWin * (1.0 - gLit / max(gWin, 0.001)) * refl * (0.12 + fres * 0.55);
            totalEmissiveRadiance += gLit * gLitCol * uLitIntensity;
            totalEmissiveRadiance += gEmissive;
          }`,
        );
  };
  material.userData.uniforms = uniforms;
  material.customProgramCacheKey = () => 'drone-dash-city-v2';
  return material;
}
