# Round 19 builder: per-leg feature shares from route-feat18 logs (grid bot legs). Usage: python3 legsum19.py log...
import json, sys
tot = narrowOn = narrowAlone = cut = 0; names = {}
for f in sys.argv[1:]:
    for l in open(f):
        if not l.startswith('{'): continue
        r = json.loads(l)
        legs = [x for x in r['legs'] if x['done']]
        n1 = sum(1 for x in legs if set(x['kinds']) & {'alley', 'tunnel'})
        n2 = sum(1 for x in legs if x['cut'] and set(x['kinds']) & {'alley', 'tunnel'} and 'diagonal' not in x['kinds'])
        c = sum(1 for x in legs if x['cut'])
        tot += len(legs); narrowOn += n1; narrowAlone += n2; cut += c
        print(r['seed'], r.get('tag'), 'score', r['score'], 'legs', len(legs), 'narrowOn', n1, 'narrowAlone15', n2, 'cut15', c, 'crashes', r['crashes'], 'simT', r['simT'])
if tot: print(f'ALL legs {tot}: alley/tunnel on route {narrowOn} ({narrowOn/tot:.2f}), alley/tunnel alone 15% {narrowAlone} ({narrowAlone/tot:.2f}), any 15% {cut} ({cut/tot:.2f})')
