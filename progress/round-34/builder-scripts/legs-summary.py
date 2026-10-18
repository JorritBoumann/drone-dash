# Round 17 critic (new): summarise route-legs17 logs: per city drops, score, ending, and leg speed (street metres / leg seconds).
import json, sys, statistics as st
for fn in sys.argv[1:]:
    print('==', fn)
    ends = {}
    for line in open(fn):
        if line.startswith('END '):
            e = json.loads(line[4:]); ends[e['seed']] = e
        elif line.startswith('{"seed"'):
            r = json.loads(line); e = ends.get(r['seed'], {})
            legs = r['legs']; pk = [l for l in legs if l['n'] == 'pi']; dr = [l for l in legs if l['n'] == 'de']
            sp = lambda L: round(sum(l['g'] + l['y'] for l in L) / max(0.1, sum(l['t'] for l in L)), 1)
            first3 = legs[:6]
            z = e.get('zero') or {}
            en = e.get('ending') or {}
            log = {x['k']: x for x in e.get('log', [])}
            print(f"{r['seed']:>6} score {r['score']:>5} drops {r['deliveries']} t {r['simT']:>3} crashes {r['crashes']} | pick m/s {sp(pk)} drop m/s {sp(dr)} | first 3 cycles: {sum(l['g'] for l in first3)} m in {round(sum(l['t'] for l in first3),1)} s, roofs {[l['y'] for l in dr if l['y']>2]} | zero: {z.get('leg')} hd {z.get('hd')} bank {z.get('bank')} | OT {en.get('overtime')} done {en.get('finished')} partial {en.get('partial')} otcut {log.get('otcut',{}).get('v')} otshare {log.get('otshare',{}).get('v')}")
