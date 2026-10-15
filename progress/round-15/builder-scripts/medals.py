# Round 15 builder: summarise MEDAL lines (score, medal, breakdown checks, escalation) from bot logs.
import sys, json
for f in sys.argv[1:]:
    for l in open(f):
        if not l.startswith('MEDAL '): continue
        m = json.loads(l[6:]); e = m.get('escalation') or {}
        print(f"{f:14s} seed {m['seed']:>6} {m['finalScore']:>6} {m['tierName'] or 'none':7s} bdOk {m['bdOk']} domOk {m['domOk']} | rush on {e.get('on')} at {e.get('startedAt')} stage {e.get('stage')} orders {e.get('orders')} made {e.get('made')} missed {e.get('missed')} pts {m.get('rushBd')}")
