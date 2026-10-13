import * as THREE from 'three';

export type CityMaterial = THREE.MeshStandardMaterial & {
  userData: { shader?: { uniforms: Record<string, THREE.IUniform> } };
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
          float s = floor(vStyle + 0.5);
          float sd = floor(vSeed + 0.5);
          vec3 wn = normalize(vObjNormal);
          if (s > -0.5) {
            if (wn.y > 0.5) {
              // flat roof: gravel membrane, darker toward edges handled by parapets
              vec3 roofBase = mix(diffuseColor.rgb, vec3(0.52, 0.5, 0.49), 0.72);
              float n = cNoise(vCityPos.xz * 2.7) * 0.5 + cNoise(vCityPos.xz * 0.35) * 0.5;
              diffuseColor.rgb = roofBase * (0.86 + n * 0.22);
            } else if (wn.y > -0.5) {
              vec2 g = vFacadeUv;
              vec2 id = floor(g);
              vec2 f = fract(g);
              vec2 h; float cy = 0.55;
              float ground = step(id.y, 0.5);
              if (s < 0.5)      { h = vec2(0.24, 0.27); }
              else if (s < 1.5) { h = vec2(0.5, 0.21); cy = 0.52; }
              else if (s < 2.5) { h = vec2(0.17, 0.33); }
              else              { h = vec2(0.47, 0.45); cy = 0.5; }
              if (ground > 0.5 && s < 2.5) { h = vec2(0.4, 0.31); cy = 0.42; }
              float win = boxMask(f, vec2(0.5, cy), h);
              // frame / sill
              float frame = boxMask(f, vec2(0.5, cy - 0.01), h + vec2(0.05, 0.06)) - win;
              // floor ledge every storey
              float ledge = 1.0 - smoothstep(0.0, 0.06, f.y);
              // ribbon offices: vertical mullions
              if (s > 0.5 && s < 1.5 && ground < 0.5) win *= 1.0 - smoothstep(0.465, 0.485, abs(fract(g.x * 2.0) - 0.5));
              float rnd = cHash(id + vec2(sd * 0.731, sd * 0.379));
              float lit = step(1.0 - uLitAmount - ground * 0.35, rnd);
              float hue = cHash(id.yx * 1.37 + sd * 0.53);
              gLitCol = mix(vec3(1.0, 0.5, 0.18), vec3(1.0, 0.74, 0.42), hue);
              vec3 wall = diffuseColor.rgb;
              // subtle vertical weathering + ground darkening
              float weather = cNoise(vec2(g.x * 0.7, vCityPos.y * 0.15) + sd * 0.17) * 0.08;
              wall *= 0.94 + weather;
              wall *= mix(0.82, 1.0, smoothstep(0.0, 1.2, vCityPos.y));
              wall = mix(wall, wall * 0.78, ledge * 0.6);
              wall = mix(wall, wall * 1.12 + 0.03, frame * 0.8);
              vec3 glass = mix(vec3(0.05, 0.08, 0.12), vec3(0.11, 0.16, 0.22), rnd);
              diffuseColor.rgb = mix(wall, glass, win);
              gWin = win;
              gLit = lit * win;
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
          } else {
            gRough = 0.08;
          }
          `,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          /* glsl */ `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.12, gWin);
          if (gRough >= 0.0) roughnessFactor = gRough;`,
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
  material.customProgramCacheKey = () => 'drone-dash-city-v1';
  return material;
}
