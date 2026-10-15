# Round 14 builder: summary of the round 10 test logs (m-*.log): score, medal, base vs street bonus, breakdown checks.
import json,sys,glob
tiers=[(1000,'Bronze'),(1600,'Silver'),(4500,'Gold'),(8500,'Ace')]
for f in ['m-low-a','m-low-b','m-high-a','m-high-b','m-lazy-a','m-lazy-b']:
    try: lines=open(f+'.log').read().split('\n')
    except: continue
    tot=0; out=[]; mins=0
    for l in lines:
        if l.startswith('MEDAL '):
            j=json.loads(l[6:]); b=j['breakdown']
            out.append(f"{j['seed']}: {j['finalScore']} {j['tierName'] or 'none'} (base {b['drops']+b['fast']+b['combo']}, bonus {b['slip']}, bd {j['bdOk']} dom {j['domOk']})")
            tot+=j['finalScore']
        elif l.startswith('{"seed"'):
            j=json.loads(l); mins+=j['simT']
    print(f, 'total', tot, 'per min', round(tot/mins*60) if mins else '-', '|', ' ; '.join(out))
