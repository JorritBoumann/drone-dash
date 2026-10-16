# Round 18 builder: per-city table (real-time street and lazy, deterministic plain street and shortcut bot).
import json
A='89101,27874,55752,43564,41272,12810,42547,41570,99586,49549,64360,47096'.split(',')
def med(f):
    out={}
    try:
        for l in open(f):
            if l.startswith('MEDAL '):
                d=json.loads(l[6:]); out.setdefault(d['seed'],[]).append((d['finalScore'],d['tierName'] or 'none'))
    except FileNotFoundError: pass
    return out
def det(fs):
    out={}
    for f in fs:
        for l in open(f):
            if l.startswith('{"seed"'):
                d=json.loads(l); out[d['seed']]=(d['score'],d['deliveries'],d['crashes'])
    return out
st=med('acc-low.log'); lz=med('acc-lazy.log'); rep=med('rep-low.log')
pl=det(['legs-a.log','legs-b.log','legs-c.log']); ct=det(['cut1-final-a.log','cut1-final-b.log','cut1-final-c.log'])
print('| City | Street, real time | Lazy, real time | Street, deterministic (drops) | Shortcut bot, deterministic (drops) |')
print('|---|---|---|---|---|')
for s in A:
    a=st.get(s,[('?','')])[0]; b=lz.get(s,[('?','')])[0]
    print(f"| {s} | {a[0]:,} {a[1]} | {b[0] if b[0]=='?' else format(b[0],',')} {b[1]} | {pl[s][0]:,} ({pl[s][1]}) | {ct[s][0]:,} ({ct[s][1]}) |")
ss=[st[s][0][0] for s in A if s in st]; ls=[lz[s][0][0] for s in A if s in lz]
print('street', min(ss), max(ss), 'silver+', sum(1 for x in ss if x>=2000), 'lazy', min(ls) if ls else None, max(ls) if ls else None, 'bronze-or-below', sum(1 for x in ls if x<2000))
print('rep', {k:[x[0] for x in v] for k,v in rep.items()}, {k:st[k][0][0] for k in rep})
