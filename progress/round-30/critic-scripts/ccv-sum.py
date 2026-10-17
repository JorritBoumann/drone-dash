# Round 24 critic: crash-classify summary. Pad lip = a crash within 30 m of the target where the face hit tops out within 1 m
# above the drone (it clipped the edge of the pad's building / pad).
import json, sys
for f in sys.argv[1:]:
    rows = [json.loads(l) for l in open(f) if l.startswith('{"seed"')]
    tail = [l for l in open(f) if l.startswith('ALT')]
    near = [r for r in rows if r['hd'] < 30]
    gaps = [round(r['lc']['wallTop'] - r['lc']['y'], 1) for r in near if r.get('lc')]
    lips = [r for r in near if r.get('lc') and r['lc']['wallTop'] - r['lc']['y'] < 1.0]
    seeds = sorted(set(r['seed'] for r in rows), key=int)
    print(f, 'crashes', len(rows), 'seeds with crashes', seeds, 'near', len(near), 'closest face below top', min(gaps) if gaps else None, 'pad lips', len(lips))
    print('  ', tail[0].strip() if tail else '')
