# Round 18 builder: summary of real-time MEDAL / ESC / END lines (street or lazy logs): score, medal, run medal vs final
# score medal, breakdown checks, rush hour start, overtime.
import json,sys
T=[1000,2000,4500,10000]
tier=lambda s: sum(1 for t in T if s>=t)
for f in sys.argv[1:]:
    rows={}
    for l in open(f):
        if l.startswith('MEDAL '):
            d=json.loads(l[6:]); rows.setdefault(d['seed'],[]).append(d)
        elif l.startswith('ESC '):
            d=json.loads(l[4:]); r=rows.get(d['seed'],[{}])[-1]; r['rush']=[e for e in d['rush'] if e['k']=='rushhour']
        elif l.startswith('END '):
            d=json.loads(l[4:]); r=rows.get(d['seed'],[{}])[-1]; r['ending']=d['ending']
    print(f)
    for seed,rs in rows.items():
        for d in rs:
            print(seed, d['finalScore'], d['tierName'] or '-', 'tierOK', d['tier']==tier(d['finalScore']), 'bdOk', d['bdOk'], 'domOk', d['domOk'], 'rush', [e['t'] for e in d.get('rush',[])], 'ot', (d.get('ending') or {}).get('overtime'), (d.get('ending') or {}).get('finished'))
