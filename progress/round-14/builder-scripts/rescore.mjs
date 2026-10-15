// Round 14 builder: offline rescoring of tune-play LOG lines (UNCAP=1 runs) under street bonus settings.
// Usage: node rescore.mjs carry pickup perMetre legMin comboK maxFactor paceLow paceFull wMin wMax file...
import fs from 'node:fs';
const [carry, pickup, perM, legMin, comboK, maxF, pLow, pFull, wMin, wMax, ...files] = process.argv.slice(2);
const pw = (p) => Math.max(+wMin, Math.min(+wMax, (p - +pLow) / (+pFull - +pLow)));
for (const f of files) {
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line.startsWith('LOG ')) continue;
    const L = JSON.parse(line.slice(4));
    const B = L.breakdown; const base = B.drops + B.fast + B.combo;
    let bank = 0, legB = 0, cap = 0, paid = 0, old = 0, carryPts = 0, pickPts = 0;
    for (const e of L.log) {
      if (e.k === 'leg') { legB = 0; cap = Math.max(+legMin, Math.round(e.v * +perM)); }
      if (e.k === 'pay') { old += e.m; const add = Math.max(0, Math.min(Math.round(e.m * pw(e.par ?? 99) * (e.c ? +carry : +pickup)), cap - legB)); bank += add; legB += add; if (e.c) carryPts += add; else pickPts += add; }
      if (e.k === 'drop') { paid += Math.round(bank * Math.min(+maxF, 1 + +comboK * (e.m - 1))); bank = 0; }
    }
    const end = L.log.find((e) => e.k === 'end')?.t || 0;
    console.log(`${f.split('/').pop().padEnd(14)} drops ${String(B.drops ? L.log.filter((e) => e.k === 'drop').length : 0).padStart(2)} t ${String(end).padStart(6)} base ${String(base).padStart(5)} oldSlip ${String(old).padStart(5)} old ${String(base + old).padStart(5)} | bonus ${String(paid).padStart(5)} lost ${String(bank).padStart(4)} (carry ${carryPts} pick ${pickPts}) NEW ${String(base + paid).padStart(5)}`);
  }
}
