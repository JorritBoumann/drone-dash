# Round 18 builder: pair legs of the shortcut bot (CUT=1) and the grid bot (CUT=0) by seed, from and to (within 4 m).
# Reports, on legs where the feature route is at least 15% under the grid route, the summed leg times and crash counts.
import json,sys
def load(fs):
    out=[]
    for f in fs:
        for l in open(f):
            if l.startswith('LEG '): out.append(json.loads(l[4:]))
    return out
cut=load([f for f in sys.argv[1:] if '/c1-' in f or 't1-' in f.split('/')[-1] or 'cut1' in f])
grid=load([f for f in sys.argv[1:] if '/c0-' in f or 't0-' in f.split('/')[-1] or 'cut0' in f])
near=lambda a,b: abs(a[0]-b[0])<=4 and abs(a[1]-b[1])<=4
n=0; tc=tg=0; cc=cg=0; nall=0; shortall=0; rows=[]
for c in cut:
    nall+=1
    if c['feat']<=0.85*c['grid']: shortall+=1
    if c['feat']>0.85*c['grid']: continue
    g=[g for g in grid if g['seed']==c['seed'] and near(g['from'],c['from']) and near(g['to'],c['to'])]
    if not g: continue
    g=g[0]; n+=1; tc+=c['t']; tg+=g['t']; cc+=c['crashes']; cg+=g['crashes']
    rows.append((c['seed'],c['n'],c['grid'],c['feat'],g['t'],c['t'],c['kinds']))
for r in rows: print(r)
print(f'cut-bot legs {nall}, with a 15% shortcut {shortall} ({shortall/max(1,nall):.2f}); paired {n}: grid bot {tg:.1f} s, cut bot {tc:.1f} s, faster by {(1-tc/max(1e-9,tg))*100:.1f}%; crashes grid {cg}, cut {cc}')
