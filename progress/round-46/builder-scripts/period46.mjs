// Round 46 builder: exact-repeat period of the Breakbeat run music, from the score itself. Transpiles src/systems/breakbeat.ts
// with TypeScript, runs its step() against a fake audio context, records every voice call (instrument, step, pitch, gain,
// length) per bar, and finds the smallest lag P (bars) after which every bar is identical. Done for each chain level,
// with and without rush hour, over 400 bars (bar 0 is left out: the first downbeat of a run has no crash).
import fs from 'node:fs';
import ts from 'typescript';
const root = new URL('../../../', import.meta.url).pathname;
const dir = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/b46/bbjs/';
fs.mkdirSync(dir, { recursive: true });
for (const f of ['breakbeat', 'music']) {
  const js = ts.transpileModule(fs.readFileSync(root + `src/systems/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  fs.writeFileSync(dir + f + '.mjs', js.replace("from './music'", "from './music.mjs'"));
}
const out = dir + 'breakbeat.mjs';
globalThis.AudioNode = class {};
const fake = () => new Proxy(function () {}, { get: (t, k) => (k === 'connect' ? (x) => x : k === 'value' ? 0 : fake()), apply: () => fake(), set: () => true });
const { Breakbeat, BB_STEP } = await import(out + '?v=' + Date.now());
const VOICES = ['kick', 'snare', 'hat', 'shaker', 'ride', 'crash', 'riser', 'subNote', 'bassNote', 'rhodes', 'pluck', 'leadNote', 'stab'];
function sigs(st, bars) {
  const bb = new Breakbeat({ ctx: fake(), input: fake(), noise: null, softSaw: null, reap() {}, note() {} });
  let cur = [];
  for (const v of VOICES) { bb[v] = (...a) => { cur.push(v + ':' + a.slice(0).map((x) => (typeof x === 'number' ? +x.toFixed(4) : Array.isArray(x) ? x.join('.') : x && x.name ? x.name : '')).join(',')); }; }
  const out = [];
  for (let bar = 0; bar < bars; bar++) {
    cur = [];
    for (let s = 0; s < 16; s++) { const t = (bar * 16 + s) * BB_STEP; bb.step('run', bar, s, 0, st); cur.push('|' + s); }
    out.push(cur.join(';'));
  }
  return out;
}
const period = (S) => { for (let P = 1; P < S.length / 2; P++) { let ok = true; for (let b = 1; b + P < S.length; b++) if (S[b] !== S[b + P]) { ok = false; break; } if (ok) return P; } return null; };
const res = [];
for (const chain of [0, 1, 2, 3]) for (const rush of [false, true]) {
  const S = sigs({ chain, chase: false, rush, overtime: false, tier: 0 }, 400);
  const P = period(S); const distinct = new Set(S).size;
  res.push({ chain, rush, periodBars: P, periodS: P ? +(P * 16 * BB_STEP).toFixed(1) : null, distinctBars: distinct });
}
console.log(JSON.stringify(res, null, 0).replace(/},/g, '},\n'));
fs.writeFileSync(new URL('./period46.log', import.meta.url), JSON.stringify(res, null, 1));
