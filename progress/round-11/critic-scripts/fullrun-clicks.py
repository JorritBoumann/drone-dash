# Round 11 critic: both click detectors over each whole capture (title, run, game over), music bus and master.
import sys, json, numpy as np
sys.argv = ['x', sys.argv[1], sys.argv[2], '-']
src = open(__file__.replace('fullrun-clicks.py', 'analyze11.py')).read(); exec(src[:src.index('segs = {}')])
a = idx(calT + 0.2, 'music'); res = {}
for ch, floor in [('music', 0.002), ('master', 0.005)]:
    x = CH[ch][a:]; r10 = clicks_r10(x); st = clicks_strict(x, floor)
    res[ch] = dict(seconds=round(len(x) / sr, 1), r10=len(r10), strict=len(st), strict_per_min=round(len(st) / (len(x) / sr) * 60, 1), r10_sizes=[round(e[1], 3) for e in r10][:10])
print(sys.argv[2], json.dumps(res))
