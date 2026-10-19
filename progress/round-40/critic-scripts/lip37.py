# Round 37 critic: pad-lip crashes in crash-classify-v logs. A pad-lip crash: charged within 30 m of the target, and the
# crash's wall top within 0.6 m of the pad height (oy) with the drone at most 1.2 m below that top (it clipped the rim).
import sys, json
for f in sys.argv[1:]:
    rows = [json.loads(l) for l in open(f) if l.startswith('{')]
    lip = [r for r in rows if r.get('lc') and r['hd'] < 30 and abs(r['lc']['wallTop'] - r['oy']) < 0.6 and r['lc']['wallTop'] - r['y'] < 1.2]
    print(f, 'crashes', len(rows), 'near target', sum(1 for r in rows if r['hd'] < 30), 'pad-lip', len(lip), 'seeds', sorted({r['seed'] for r in rows}))
    for r in lip: print('  ', r)
