import json,sys,glob
rows=[]
for f in sys.argv[1:]:
    for line in open(f):
        if line.startswith('{"seed"'):
            r=json.loads(line); rows.append(r)
for r in rows:
    bd=r.get('bd') or {}; e=r.get('ending') or {}
    tail=[(x['k'],x['v'],x.get('c')) for x in r.get('tail',[]) if x['k']!='drop']
    print(r['seed'], 'score',r['score'],'del',r['deliveries'],'simT',r['simT'],'crash',r['crashes'],'| drops',bd.get('drops'),'fast',bd.get('fast'),'combo',bd.get('combo'),'slip',bd.get('slip'),'partial',bd.get('partial'),'ot',round(bd.get('overtimeSeconds',0),1),'otDrop',bd.get('overtimeDrop'),'| open',r['open']['n'],r['open']['hdLeft'],'|',tail)
sc=[r['score'] for r in rows]
if sc: print('min',min(sc),'max',max(sc),'ratio',round(max(sc)/max(1,min(sc)),2))
