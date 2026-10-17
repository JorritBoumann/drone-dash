# Round 25 builder: delivery share per bot run from the MEDAL lines (two views).
# Delivery itself = drops + fast (time bonus, rush included) + combo. Street bonus = slip (bank paid on delivery + time-up share).
# View 2 counts the street bonus paid on a delivery as part of that delivery (relabelled; for reference only).
import sys, json
tot = {}
for f in sys.argv[1:]:
    for l in open(f):
        if not l.startswith('MEDAL'): continue
        d = json.loads(l[6:]); b = d['breakdown']; s = d['finalScore']
        dl = b['drops'] + b['fast'] + b['combo']; dlnr = dl - b['rush']
        print(f"{f:16s} seed {d['seed']:>6} {s:6d} {d['tierName'] or 'none':7s} drops {b['drops']:5d} fast {b['fast']-b['rush']:4d} rush {b['rush']:4d} combo {b['combo']:4d} street {b['slip']:5d} | delivery {100*dl/max(1,s):5.1f}% (no rush {100*dlnr/max(1,s):5.1f}%) | with street bonus {100*(dl+b['slip']-b['partial'])/max(1,s):5.1f}% | bdOk {d['bdOk']} domOk {d['domOk']}")
        t = tot.setdefault(f, [0, 0, 0, 0]); t[0] += s; t[1] += dl; t[2] += b['slip']; t[3] += 1
for f, t in tot.items():
    print(f"TOTAL {f}: runs {t[3]} score {t[0]} delivery {t[1]} ({100*t[1]/max(1,t[0]):.1f}%) street {t[2]} ({100*t[2]/max(1,t[0]):.1f}%)")
