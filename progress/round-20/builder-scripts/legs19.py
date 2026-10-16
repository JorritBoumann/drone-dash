# Round 19 critic: round 18 acceptance on 12 fresh cities, from feat-grid-{a,b}.log and feat-feat-{a,b}.log (route-feat19).
import json, statistics as st
D = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/round-20/builder-scripts/'
def load(fs):
    out = {}
    for f in fs:
        for l in open(D + f):
            if l.startswith('{'): r = json.loads(l); out[r['seed']] = r
    return out
G = load(['feat-grid-a.log', 'feat-grid-b.log']); F = load(['feat-feat-a.log', 'feat-feat-b.log'])
legs = [l for r in G.values() for l in r['legs'] if l['done']]
nar = lambda l: 'alley' in l['kinds'] or 'tunnel' in l['kinds']
print('grid legs', len(legs))
print('1a alley/tunnel on shortest route:', sum(nar(l) for l in legs), f"{sum(nar(l) for l in legs)/len(legs):.2f}")
alone = [l for l in legs if l['cut'] and nar(l) and 'diagonal' not in l['kinds']]
print('1b alley/tunnel alone 15% cut:', len(alone), f"{len(alone)/len(legs):.2f}", 'any 15% cut:', sum(l['cut'] for l in legs))
print('   kinds on cut legs:', {k: sum(1 for l in legs if l['cut'] and k in l['kinds']) for k in ['alley','tunnel','diagonal']})
# matched legs where the feature route is alley/tunnel and a 15% cut
tg = tf = 0; n = 0; tgall = tfall = 0; nall = 0
for s, g in G.items():
    f = F.get(s)
    if not f: continue
    fl = {(l['from'], l['to']): l for l in f['legs'] if l['done']}
    for l in g['legs']:
        if not l['done'] or not l['cut']: continue
        o = fl.get((l['from'], l['to']))
        if not o: continue
        tgall += l['t']; tfall += o['t']; nall += 1
        if nar(l): tg += l['t']; tf += o['t']; n += 1
print(f'2 matched alley/tunnel cut legs {n}: grid {tg:.1f}s feat {tf:.1f}s faster by {1-tf/tg:.3f}' if n else '2 none matched')
print(f'  all matched cut legs {nall}: grid {tgall:.1f} feat {tfall:.1f} faster by {1-tfall/tgall:.3f}')
cg = sum(r['crashes'] for r in G.values()); cf = sum(r['crashes'] for r in F.values()); sg = sum(r['simT'] for r in G.values()); sf = sum(r['simT'] for r in F.values())
print(f'  crashes grid {cg} in {sg}s ({cg/sg*60:.2f}/min), feat {cf} in {sf}s ({cf/sf*60:.2f}/min)')
print('  crash kinds feat:', [c['wk'] for r in F.values() for c in r['crashList']])
# 3 hint
hl = [l for r in list(G.values()) + list(F.values()) for l in r['legs'] if l.get('hint')]
need = [l for l in hl if nar(l) or 'diagonal' in l['kinds']]
named = [l for l in need if l['hint']['dom'] and l['hint']['h']['delay'] is not None and l['hint']['h']['delay'] <= 1.0]
print(f'3 legs with a feature on the shortest route (both bots) {len(need)}, named on screen at 1 s {len(named)}; delays', sorted(set(str(l["hint"]["h"]["delay"]) for l in need if l["hint"]["h"]))[:5])
# mismatch: label says tunnel but no tunnel named
mis = [l['hint']['dom'] for l in hl if l['hint']['h'] and l['hint']['h']['kind'] == 'tunnel' and not any('Tunnel' in n for n in l['hint']['h']['names'])]
print('  hint says Tunnel but names no tunnel:', len(mis), mis[:3])
nohint_feat = [l for l in hl if (not l['hint']['dom']) and nar(l)]
print('  narrow route but no hint:', len(nohint_feat))
for s, r in G.items(): 
    if len(set(r['featNames'])) != len(r['featNames']): print('  DUP NAMES', s)
print('  names unique in all', all(len(set(r['featNames'])) == len(r['featNames']) for r in G.values()), 'features per city', [len(r['featNames']) for r in G.values()])
print('scores grid', sorted((r['score'], r['tier']) for r in G.values()))
print('scores feat', sorted((r['score'], r['tier']) for r in F.values()))
for s in G: print(s, 'grid', G[s]['score'], G[s]['crashes'], 'feat', F[s]['score'], F[s]['crashes'], F[s]['simT'], [ (l['t'], l['kinds']) for l in F[s]['legs'] if l['t'] > 30])
