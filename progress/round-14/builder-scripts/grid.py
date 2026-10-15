# Round 14 builder: grid search of street bonus settings on tune3 logs; projects real-time round 13 runs.
import json,glob,itertools,math
runs={}
for f in glob.glob('tune3/*.log'):
    for l in open(f):
        if l.startswith('LOG '):
            j=json.loads(l[4:]); runs[f.split('/')[-1][:-4]]=j
def score(j,carry,pick,comboK,maxF,pl,pf,wmin,wmax):
    B=j['breakdown']; base=B['drops']+B['fast']+B['combo']
    bank=0; paid=0; old=0
    for e in j['log']:
        if e['k']=='pay':
            old+=e['m']; w=max(wmin,min(wmax,(e['par']-pl)/(pf-pl)))
            bank+=round(e['m']*w*(carry if e['c'] else pick))
        if e['k']=='drop':
            paid+=round(bank*min(maxF,1+comboK*(e['m']-1))); bank=0
    return base,old,paid
# real-time round 13 (base, slip) per seed: low A/B, high A/B, lazy A/B
rt={'low':[(3962,2570),(1027,765),(2040,1650),(3962,2745),(1027,810),(2040,1875)],
    'high':[(3618,225),(4033,45),(4967,180),(3962,45),(4033,45),(3824,255)],
    'lazy':[(228,390),(446,300),(556,585),(1123,605),(446,250),(556,585)]}
seeds=['22','58','130']
best=[]
for carry,pick,comboK,pl,pf,wmin,wmax in itertools.product([1],[0.5,0.75,1],[0,0.5],[2,2.5,3],[6,8,10],[0.1,0.2],[1.5,2,2.5]):
    f={}
    for k in ['low','high','lazy']:
        for s in seeds:
            j=runs.get(f'{k}-{s}') if (k,s)!=('lazy','130') else runs['lazy-22']
            base,old,paid=score(j,carry,pick,comboK,9,pl,pf,wmin,wmax)
            f[(k,s)]=paid/old if old else 0
    proj={k:[b+f[(k,seeds[i%3])]*sl for i,(b,sl) in enumerate(rt[k])] for k in rt}
    low=proj['low']; high=proj['high']; lazy=proj['lazy']
    ratio=min(sum(low[:3]),sum(low[3:]))/max(sum(high[:3]),sum(high[3:]))
    gap=min(low)-max(lazy)
    best.append((round(gap),round(ratio,3),carry,pick,comboK,pl,pf,wmin,wmax,[round(x) for x in low],[round(x) for x in lazy],round(max(low))))
ok=[b for b in best if 0.97<=b[1]<=1.12 and b[4]==0]
ok.sort(key=lambda b:-b[0])
for b in ok[:12]: print(b)
