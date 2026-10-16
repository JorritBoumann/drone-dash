# Round 18 critic: route-choice analysis from feat-grid.log (grid bot) and feat-feat.log (shortcut bot), both deterministic.
import json, sys, statistics as st
D = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/round-19/critic-scripts/'
def load(f):
    return {r['seed']: r for r in (json.loads(l) for l in open(D + f) if l.startswith('{'))}
G, F = load('feat-grid.log'), load('feat-feat.log')
allLegs = cutLegs = 0
kinds = {}
mt_g = mt_f = 0; nmatch = 0; per = []
cg = sum(r['crashes'] for r in G.values()); cf = sum(r['crashes'] for r in F.values())
tg = sum(r['simT'] for r in G.values()); tf = sum(r['simT'] for r in F.values())
for seed in G:
    g, f = G[seed], F.get(seed)
    done = [l for l in g['legs'] if l['done']]
    allLegs += len(done); c = [l for l in done if l['cut']]; cutLegs += len(c)
    for l in c:
        for k in l['kinds']: kinds[k] = kinds.get(k, 0) + 1
    if not f: continue
    fl = {(l['from'], l['to']): l for l in f['legs'] if l['done']}
    sg = sf = 0; m = 0; fg = ff = 0
    for l in done:
        if not l['cut']: continue
        o = fl.get((l['from'], l['to']))
        if not o: continue
        sg += l['t']; sf += o['t']; m += 1; fg += l['flown']; ff += o['flown']
    mt_g += sg; mt_f += sf; nmatch += m
    per.append((seed, len(done), len(c), m, round(sg,1), round(sf,1), round(1 - sf/sg, 3) if sg else None, fg, ff, g['score'], f['score'], g['crashes'], f['crashes']))
print('seed legs cutLegs matched gridT featT saving gridFlown featFlown gridScore featScore gridCr featCr')
for p in per: print(*p)
print(f'ALL legs {allLegs}, legs with a 15% shortcut {cutLegs} ({cutLegs/allLegs:.2f}); kinds on those legs {kinds}')
print(f'MATCHED cut legs {nmatch}: grid {mt_g:.1f} s, feat {mt_f:.1f} s, feat faster by {1-mt_f/mt_g:.3f}')
print(f'CRASHES grid {cg} in {tg} s ({cg/tg*60:.2f}/min), feat {cf} in {tf} s ({cf/tf*60:.2f}/min)')
print('SCORES grid', sorted(r['score'] for r in G.values()), 'feat', sorted(r['score'] for r in F.values()))
# route-length shortcut size on cut legs (hook lengths)
sav = [1 - l['f']/l['g'] for r in G.values() for l in r['legs'] if l['done'] and l['cut']]
if sav: print(f'route saving on cut legs: median {st.median(sav):.2f}, min {min(sav):.2f}, max {max(sav):.2f}')
