# Round 31 critic: hidden-drone spells from cam-clip rows (occ per frame). Longest spell (s), hidden frames, spells > 0.1 s, frames in solid, jumps > 1 m.
import json, sys, math
for fn in sys.argv[1:]:
    rows = json.load(open(fn)); m = None; spells = []; cur = None; hid = 0; in0 = 0; jumps = 0; prev = None; kk = 0
    for r in rows:
        if 'mark' in r: m = r['mark']; cur = None; prev = None; kk = 0; continue
        if m is None: continue
        if r.get('st') != 'playing' or kk < 90: kk += 1; continue
        if r.get('in0'): in0 += 1
        if prev is not None:
            j = math.dist([r['cx'] - prev['cx'], r['cy'] - prev['cy'], r['cz'] - prev['cz']], [r['px'] - prev['px'], r['py'] - prev['py'], r['pz'] - prev['pz']])
            if j > 1.0: jumps += 1
        prev = r
        if r.get('occ'):
            hid += 1
            if cur is None: cur = [m, r['t'], r['t'], 1]; spells.append(cur)
            else: cur[2] = r['t']; cur[3] += 1
        else:
            if cur is not None: cur[2] = r['t']  # spell lasts until the first visible frame
            cur = None
    spells = [[s[0], round(s[2] - s[1], 3), s[3]] for s in spells]
    longest = max(spells, key=lambda s: s[1]) if spells else None
    print(fn, 'hiddenFrames', hid, 'spells', len(spells), 'longest', longest, 'over0.1s', [s for s in spells if s[1] > 0.1], 'inSolid', in0, 'jumps>1m', jumps)
