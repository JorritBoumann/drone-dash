# Round 41 critic: fix E. Head-on (>=60 deg) hits by impact speed band, charged vs not: camera shake and live particles.
import json, sys, statistics as st
for f in sys.argv[1:]:
    rows = json.load(open(f))
    print(f)
    for lo, hi in [(8, 10), (10, 11), (11, 12), (12, 40)]:
        for ch in (0, 1):
            s = [r for r in rows if r['ang'] >= 60 and lo <= r['impactV'] < hi and (r['charged'] > 0) == bool(ch)]
            if not s: continue
            print(f"  impact {lo}-{hi} m/s {'charged' if ch else 'free'}: n {len(s)}, shake median {st.median(r['shake'] for r in s):.2f} max {max(r['shake'] for r in s):.2f}, particles median {st.median(r['parts'] for r in s):.0f} max {max(r['parts'] for r in s)}, tilt max {max(r['tilt'] for r in s)}, slow frames max {max(r['slowFrames'] for r in s)}")
