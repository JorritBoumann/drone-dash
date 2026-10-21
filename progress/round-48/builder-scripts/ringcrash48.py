# Round 48 fix pass: rings flown, crashes within 3 s of a ring, all crashes, time left, from pilot JSON logs.
# python3 ringcrash48.py <json files...>
import sys, json
T = [0, 0, 0]
for f in sys.argv[1:]:
    L = json.load(open(f))
    rings = [r['t'] for r in L['ringTakes']]
    cr = L['crashes']
    near = sum(1 for c in cr if any(0 <= c['t'] - t <= 3.0 for t in rings))
    res = L['result']
    left = res['card'].get('shift', '')
    print(f"{L['tag']:<28} rings {len(rings):>2}  crashes within 3 s {near}  crashes {len(cr)}  delivered {res['del']}  {res['card']['kicker']}: {left}")
    T[0] += len(rings); T[1] += near; T[2] += len(cr)
print(f"TOTAL rings {T[0]}, crashes within 3 s of a ring {T[1]} ({T[1] / max(1, T[0]) * 10:.1f} per 10 rings), all crashes {T[2]}")
