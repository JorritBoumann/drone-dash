# Round 27 critic: medal acceptance table from acc-low.log (street) and acc-lazy.log (lazy), plus reruns (rep-*.log).
import json, sys, glob
def runs(fn):
    out = []; summ = {}
    try: lines = open(fn).read().splitlines()
    except FileNotFoundError: return out
    for l in lines:
        if l.startswith('MEDAL '):
            j = json.loads(l[6:]); out.append({'seed': str(j['seed']), 'score': j['breakdown']['total'], 'tier': j['tierName'] or 'none', 'b': j['breakdown'], 'bdOk': j.get('bdOk')})
        elif l.startswith('{') and '"deliveries"' in l and '"seed"' in l:
            try: s = json.loads(l); summ.setdefault(str(s['seed']), []).append(s)
            except Exception: pass
    for r in out:
        lst = summ.get(r['seed']) or [{}]; s = lst.pop(0) if lst else {}; r['drops'] = s.get('deliveries', '?'); r['crashes'] = s.get('crashes', '?')
    return out
st = runs('acc-low.log'); lz = runs('acc-lazy.log'); reps = sum([runs(f) for f in sorted(glob.glob('rep-*.log'))], [])
L = {r['seed']: r for r in lz}
print('city | street | lazy | lazy/street')
for r in st:
    z = L.get(r['seed']); ratio = f"{z['score']/r['score']:.2f}" if z and r['score'] else ''
    print(f"{r['seed']} | {r['score']} {r['tier']}, {r['drops']} drops | " + (f"{z['score']} {z['tier']}, {z['drops']} drops" if z else '-') + f" | {ratio}" + (' SAME DROPS' if z and z['drops'] == r['drops'] else ''))
for r in reps: print('rerun', r['seed'], r['score'], r['tier'], r['drops'], 'drops')
if st and lz:
    print('street Silver+:', sum(r['tier'] in ('Silver', 'Gold', 'Ace') for r in st), 'of', len(st), '| lazy Bronze or below:', sum(r['tier'] in ('none', 'Bronze') for r in lz), 'of', len(lz))
    print('best lazy', max(r['score'] for r in lz), 'worst street', min(r['score'] for r in st), 'gap', min(r['score'] for r in st) - max(r['score'] for r in lz))
    same = [(r['seed'], round(1 - L[r['seed']]['score'] / r['score'], 2)) for r in st if r['score'] and r['seed'] in L and L[r['seed']]['drops'] == r['drops']]
    print('same-drop cities (lazy below street by):', same)
    print('bdOk all:', all(r['bdOk'] for r in st + lz))
    for nm, rs in (('street', st), ('lazy', lz)):
        T = sum(r['b']['total'] for r in rs); S = sum(r['b']['drops'] + r['b']['fast'] + r['b']['combo'] for r in rs)
        print(nm, 'strict share', round(100 * S / T, 1), 'lowest', min(round(100 * (r['b']['drops'] + r['b']['fast'] + r['b']['combo']) / r['b']['total']) for r in rs if r['b']['total']))
