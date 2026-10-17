# Round 26 builder: medal acceptance from MEDAL + summary lines. Usage: acc26.py street.log lazy.log [silver] [bronze]
import json, sys
def runs(fn):
    out = {}; summ = {}
    for line in open(fn):
        if line.startswith('{') and '"seed"' in line:
            try: j = json.loads(line); summ.setdefault(j['seed'], []).append(j)
            except Exception: pass
    for line in open(fn):
        if line.startswith('MEDAL '):
            j = json.loads(line[6:]); b = j['breakdown']
            out.setdefault(j['seed'], []).append({'score': j['finalScore'], 'strict': b['drops'] + b['fast'] + b['combo'], 'bdOk': j['bdOk'], 'domOk': j['domOk']})
    for s, L in out.items():
        for i, r in enumerate(L): r['drops'] = summ.get(s, [{}] * (i + 1))[i].get('deliveries', '?') if i < len(summ.get(s, [])) else '?'
    return out
st, lz = runs(sys.argv[1]), runs(sys.argv[2])
silver = int(sys.argv[3]) if len(sys.argv) > 3 else 2800; bronze = int(sys.argv[4]) if len(sys.argv) > 4 else 1200
tier = lambda x: 'Silver+' if x >= silver else 'Bronze' if x >= bronze else 'none'
worst_st, best_lz, same = 1e9, 0, []
for s in st:
    S = st[s]; Z = lz.get(s, [])
    for r in S: worst_st = min(worst_st, r['score'])
    for z in Z: best_lz = max(best_lz, z['score'])
    print(f"{s:>6} street " + ', '.join(f"{r['score']} {tier(r['score'])} {r['drops']}d" for r in S) + " | lazy " + ', '.join(f"{z['score']} {tier(z['score'])} {z['drops']}d" for z in Z))
    for r in S:
        for z in Z:
            if r['drops'] == z['drops']: same.append((s, r['score'], z['score'], round(1 - z['score'] / r['score'], 3)))
print(f"silver {silver}: street Silver+ {sum(1 for s in st for r in st[s] if r['score']>=silver)} of {sum(len(v) for v in st.values())}; lazy Bronze or below {sum(1 for s in lz for z in lz[s] if z['score']<silver)} of {sum(len(v) for v in lz.values())}")
print(f"worst street {worst_st}, best lazy {best_lz}, gap {worst_st-best_lz}; same-drop pairs (lazy less by): {same}")
print('breakdown exact:', all(r['bdOk'] and r['domOk'] for d in (st, lz) for L in d.values() for r in L))
