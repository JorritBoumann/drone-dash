# Round 26 builder: first-run pacing check from hud-probe25 FIRSTRUN output.
import json,sys
for f in sys.argv[1:]:
    fr=None
    for line in open(f):
        if line.startswith('FIRSTRUN '): fr=json.loads(line[9:])
    if not fr: print(f,'no FIRSTRUN'); continue
    print('==',f)
    first=sorted(fr['first'].items(), key=lambda kv: kv[1])
    print(' first:', ', '.join(f'{k}@{v}' for k,v in first))
    print(' teach:', fr.get('teach'))
    shows=fr['shows']
    for s in shows:
        if s['t']<=80 and s['s']!='#slip-pop': print('  ',s['t'],s['s'],s['txt'][:70])
    pops=[s['t'] for s in shows if s['s']=='#pop' and ('secured' in s['txt'] or 'delivered' in s['txt'] or 'Rush order' in s['txt'] or 'Last call' in s['txt'])]
    print(' objective pops:',pops)
    tl=(fr.get('teach') or {}).get('log',[])
    intro=[x['t'] for x in tl]
    viol=[]
    for x in tl:
        for p in pops:
            if abs(x['t']-p)<3 and x['k'] not in ('medal',): viol.append((x['k'],x['t'],p))
    gaps=[(a['k'],b['k'],round(b['t']-a['t'],1)) for a,b in zip(tl,tl[1:]) if b['t']>=30 and b['t']-a['t']<8]
    print(' intro-near-pop:',viol,' gaps<8 from 30s:',gaps)
    # feedback stretches: any visible pop/event/slip/medal text change or first-appearance
    ev=sorted(set([s['t'] for s in shows]+[v for k,v in first]))
    ev=[0]+[e for e in ev if e<=60]+[60]
    mx=max((b-a,a) for a,b in zip(ev,ev[1:]))
    print(' longest stretch without new visible feedback in first 60 s: %.1f s from %.1f'%mx)
