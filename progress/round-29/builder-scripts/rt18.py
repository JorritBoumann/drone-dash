# Round 18 critic: summarize real-time MEDAL/END lines of a log.
import json, sys
th=[1000,2000,4500,10000]
for f in sys.argv[1:]:
    print('==', f)
    runs={}
    for l in open(f):
        if l.startswith('MEDAL '):
            r=json.loads(l[6:]); s=r['finalScore']; c=sum(s>=t for t in th)
            print(r['seed'], s, r['tierName'], 'tierOk', r['tier']==c, 'card', r['overDom']['medal'], 'bdOk', r['bdOk'], 'domOk', r['domOk'], 'trunc', r['truncated'])
        elif l.startswith('ESC '):
            r=json.loads(l[4:]); e=r['esc'] or {}
            print('   rush startedAt', e.get('startedAt'), 'orders', e.get('orders'), 'made', e.get('made'), 'rushLanes', (r.get('city') or {}).get('rushLanes'))
        elif l.startswith('END '):
            r=json.loads(l[4:]); e=r['ending'] or {}
            print('   ending ot', e.get('overtime'), 'finished', e.get('finished'), 'otSec', e.get('overtimeSeconds'), 'partial', e.get('partial'))
        elif l.startswith('{'):
            r=json.loads(l); print('   del', r['deliveries'], 'crashes', r['crashes'], 'simT', r['simT'])
