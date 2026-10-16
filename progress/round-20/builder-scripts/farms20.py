# Round 20 builder: carry farm ratios (sum of farm points a minute over sum of honest, seeds 22, 58, 130) from ../builder/farms.
import json, glob, os, sys
D = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'builder', 'farms')
R = {}
for f in glob.glob(os.path.join(D, '*.log')):
    for l in open(f):
        if l.startswith('CAPFARM '): R[os.path.basename(f)[:-4]] = json.loads(l[8:])
H = {s: R[f'capfarm-honest-{s}'] for s in ['22', '58', '130']}
print('honest', {s: (H[s]['score'], H[s]['tier'], H[s]['perMin'], H[s]['deliveries'], H[s]['breakdown']['slip']) for s in H})
hs = sum(H[s]['perMin'] for s in H)
for v in ['capfarm-carry', 'capfarm-both', 'cfn-tunnel-12', 'cfn-tunnel-25', 'cfn-alley-12', 'cfn-alley-25', 'cfn-van-12', 'cfn-van-25', 'cfn-vanidle-12', 'cfn-tunnelidle-12', 'cfn-alleyidle-12']:
    rs = {s: R.get(f'{v}-{s}') for s in ['22', '58', '130']}
    tot = sum(r['perMin'] for r in rs.values() if r)
    worst = max((r['perMin'] / H[s]['perMin'] for s, r in rs.items() if r), default=0)
    print(f"{v:16s} ratio {tot / hs:.2f} (worst seed {worst:.2f})", {s: (r['score'], r['tier'], r['deliveries'], r['perMin'], r['breakdown']['slip'], round(r['farmTime'])) for s, r in rs.items() if r})
two = [(k, r['score'], r['tier']) for k, r in R.items() if not k.startswith('capfarm-honest') and r['deliveries'] <= 2 and r['score'] >= 2000]
print('farms with 2 drops or fewer at Silver or better:', two)
