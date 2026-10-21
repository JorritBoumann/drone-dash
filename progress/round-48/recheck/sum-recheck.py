# Summarise re-check pilot logs: rings, crashes within 3 s after a ring, speed gain after rings, chip fades.
import json, glob, sys, statistics as st
rows = []
for f in sorted(glob.glob('*.json')):
    d = json.load(open(f)); r = d['result']
    rings = d['ringTakes']
    # a crash within 3 s after any ring
    cr3 = 0
    for c in d['crashes']:
        if any(0 <= c['t'] - rt['t'] <= 3.0 for rt in rings): cr3 += c['n']
    gains = []; held = []
    for rt in rings:
        a = [x for x in rt['after'] if x[0] <= 1.6]
        if not a: continue
        peak = max(x[1] for x in a)
        wfrac = sum(x[3] for x in a) / len(a) if len(a[0]) > 3 else None
        gains.append(round(peak - rt['speed'], 1)); held.append((rt['speed'], peak, wfrac))
    heldW = [p - s for s, p, w in held if w is not None and w > 0.9]
    s = d.get('seeLog') or {}
    print(f"{d['tag']:22} {r['card']['kicker']:16} del {r['del']} tl {r['tl']:5} rings {len(rings):2}/{(r['rings'] or {}).get('placed')} "
          f"crashes {r['crashes']} within3s {cr3}  gain med {st.median(gains) if gains else '-'}  gainHeldW med {round(st.median(heldW),1) if heldW else '-'} (n={len(heldW)}) "
          f"peakHeld {[round(p,1) for s_,p,w in held if w and w>0.9][:6]} "
          f"see toggles {s.get('toggles')} spans {[x[1] for x in s.get('onSpans', [])][:12]} errs {len(r['errors'])} medal {r['card']['medal']} score {r['card']['score']} | {r['card']['shift']}")
