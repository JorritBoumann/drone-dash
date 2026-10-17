# Round 24 critic: route mark steadiness (acc-sign.log, sign bot) and lag (acc-grid.log, grid bot that ignores the mark).
import json, sys
D = sys.argv[1] if len(sys.argv) > 1 else '.'
for f in ['acc-sign.log', 'acc-grid.log']:
    try: lines = open(D + '/' + f).read().splitlines()
    except Exception: continue
    R = [json.loads(l) for l in lines if l.startswith('{"seed"')]
    legs = [l for r in R for l in r['legs'] if l['done']]
    mk = [l for l in legs if l.get('mark')]
    rp = sum(l.get('replans', 0) or 0 for l in legs); dr = sum(l.get('dropped', 0) or 0 for l in legs)
    multi = sum(1 for l in legs if len(l.get('allMarks') or []) > 1)
    print(f"== {f}: cities {len(R)}, legs {len(legs)}, marked at start {len(mk)}, replans {rp}, drops {dr}, per 100 legs {100*rp/max(1,len(legs)):.1f} / {100*dr/max(1,len(legs)):.1f}, legs with >1 name {multi}, crashes {sum(r['crashes'] for r in R)}")
    lags = [json.loads(l[4:]) for l in lines if l.startswith('LAG ')]
    ch = [x for x in lags if x['to'] == '' or not x['to'].endswith(':through')]
    ch = [x for x in ch if x['to'].split(':')[0] != x['from'].split(':')[0]]
    if ch:
        ls = sorted(x['lag'] for x in ch); ex = sorted(x['extra'] for x in ch)
        q = lambda a, p: a[min(len(a)-1, int(p*len(a)))]
        print(f"   mark moved/dropped at entrance stage: {len(ch)}; s since closest to entrance: median {q(ls,.5)} p90 {q(ls,.9)} max {ls[-1]}; metres past closest: median {q(ex,.5)} p90 {q(ex,.9)} max {ex[-1]}")
