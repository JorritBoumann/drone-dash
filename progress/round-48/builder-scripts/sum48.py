# Round 48 builder: one line per bot run from shift48.mjs output (stdin).
import sys, json
for l in sys.stdin:
    try: r = json.loads(l)
    except Exception: print(l.rstrip()); continue
    rs = r.get('rings') or {}
    print(f"{str(r['seed']):>6} {r['profile']:<8} del {r['deliveries']} {'WIN ' if r.get('win') else 'loss'} t {r['simT']:>6} left {r['timeLeftEnd']:>5} score {r['score']:>6} {r['tier']:<7} crash {r['crashes']} boost {r['boostT']:>5} rings {rs.get('taken','-')}/{rs.get('placed','-')} unst {r['unsticks']} dt {r['delTimes']} {r['errors'][:1]}")
