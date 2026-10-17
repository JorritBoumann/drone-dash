# Round 25 critic: score split per run from MEDAL lines (breakdown = game tally). strict = drops + fast (incl. rush) + combo.
# street = slip - partial (street bonus paid at drops). presented = strict + street (all paid at the drop moment).
import json, sys
for fn in sys.argv[1:]:
    tot = {'total': 0, 'strict': 0, 'street': 0, 'partial': 0}
    print('==', fn)
    summ = {}
    for line in open(fn):
        if line.startswith('{') and '"seed"' in line:
            try: j = json.loads(line); summ[j['seed']] = j
            except Exception: pass
    for line in open(fn):
        if not line.startswith('MEDAL '): continue
        j = json.loads(line[6:]); b = j['breakdown']
        strict = b['drops'] + b['fast'] + b['combo']; street = b['slip'] - b['partial']; T = b['total']
        s = summ.get(j['seed'], {})
        for k, v in (('total', T), ('strict', strict), ('street', street), ('partial', b['partial'])): tot[k] += v
        print(f"{j['seed']:>6} {T:>6} {j['tierName'] or 'none':>7} drops {s.get('deliveries','?')} crashes {s.get('crashes','?')} strict {strict} ({100*strict/max(1,T):.0f}%) street {street} partial {b['partial']} rush {b['rush']} presented {100*(strict+street)/max(1,T):.0f}% bdOk {j.get('bdOk')} domOk {j.get('domOk')}")
    if tot['total']: print(f"TOTAL {tot['total']} strict {tot['strict']} ({100*tot['strict']/tot['total']:.1f}%) street {tot['street']} ({100*tot['street']/tot['total']:.1f}%) partial {tot['partial']} presented {100*(tot['strict']+tot['street'])/tot['total']:.1f}%")
