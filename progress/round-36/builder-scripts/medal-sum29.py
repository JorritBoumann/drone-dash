# Round 29 critic: medal gate summary (MEDAL lines): score, tier, breakdown exact, strict delivery share, drops, crashes.
import json, sys
for fn in sys.argv[1:]:
    rows = []; summ = []
    for l in open(fn):
        if l.startswith('MEDAL '): rows.append(json.loads(l[6:]))
        elif l.startswith('{"seed"'): summ.append(json.loads(l))
    T = 0; S = 0
    for i, j in enumerate(rows):
        b = j['breakdown']; s = summ[i] if i < len(summ) else {}
        parts = sum(b[k] for k in ('drops', 'fast', 'combo', 'slip', 'rush', 'partial') if k in b)
        strict = b['drops'] + b['fast'] + b['combo']; T += b['total']; S += strict
        print(fn, j['seed'], j['finalScore'], j['tierName'] or 'none', 'bdOk', j.get('bdOk'), 'sum==total', parts == b['total'] == j['finalScore'], 'strict%', round(100 * strict / max(1, b['total'])), 'drops', s.get('deliveries'), 'crashes', s.get('crashes'), 'speed', s.get('meanSpeed'))
    print(fn, 'TOTAL', T, 'strict share', round(100 * S / max(1, T), 1))
