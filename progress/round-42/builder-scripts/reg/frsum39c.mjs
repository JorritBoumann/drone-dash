// Round 39 critic (new): summary of hud-probe34 logs (wall-side framing 3 s after pickups and drops, HUD, camera frames).
import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  const L = fs.readFileSync(f, 'utf8').split('\n'); const get = (k) => { const l = L.find((x) => x.startsWith(k + ' ')); return l ? JSON.parse(l.slice(k.length + 1)) : null; };
  const fb = get('FB27'), hp = get('HUDPROBE'), cf = get('CAMFRAMES'), pp = get('POP34');
  const cam = (fb && fb.cam) || []; const w = cam.filter((c) => c.wall);
  console.log(f, JSON.stringify({ wallSamples: w.length, wallOver40: w.filter((c) => c.hf >= 0.4).length, wallMax: Math.max(0, ...w.map((c) => c.hf)), allMax: Math.max(0, ...cam.map((c) => c.hf)), markerHit: hp && hp.markerHit, droneUnderPill: hp && `${hp.droneUnderPill}/${hp.droneSamples}`, popOnDrone: hp && `${hp.popOnDrone}/${hp.popVis}`, popHits: pp && pp.hit, camOpenMin: cf && cf.openMin, camInSolid: cf && cf.inSolid, camOcc: cf && cf.occluded }));
}
