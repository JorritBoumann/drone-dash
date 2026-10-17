# Round 20 critic: acceptance on 12 fresh cities from acc-grid.log, acc-feat.log, acc-sign.log (route-sign20.mjs).
import json, collections
D = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/round-20/critic-scripts/'
def load(f):
    out = {}
    for l in open(D + f):
        if l.startswith('{'): r = json.loads(l); out[r['seed']] = r
    return out
B = {m: load(f'acc-{m}.log') for m in ['grid', 'feat', 'sign']}
nar = lambda l: 'alley' in l['kinds'] or 'tunnel' in l['kinds']
for m, R in B.items():
    legs = [l for r in R.values() for l in r['legs'] if l['done']]
    nl = [l for l in legs if nar(l)]; mk = [l for l in legs if l.get('mark')]
    vis = lambda l: (l['seenT'] is not None and l['seenT'] <= 3) or l.get('in80seen') or l.get('in80late')
    fails = [l for l in mk if not vis(l)]
    tag3 = [l for l in mk if l.get('tagOnT') is not None and l['tagOnT'] <= 3]
    nomark_cut = [l for l in legs if nar(l) and l['cut'] and not l.get('mark')]
    print(f"== {m}: legs {len(legs)}, alley/tunnel on shortest route {len(nl)}, marked at start {len(mk)} (cut15 & marked {sum(1 for l in mk if l['cut'])}), cut15 alley/tunnel not marked {len(nomark_cut)}")
    print(f"   arch in view within 3 s or by 80 m: {len(mk)-len(fails)}/{len(mk)}; HUD tag inside frame within 3 s: {len(tag3)}/{len(mk)}; arch-in-view times {sorted(l['seenT'] for l in mk if l['seenT'] is not None)[-6:]}")
    for l in fails[:8]: print('   FAIL', r'', l['to'][:40], l['mark'], 'seenT', l['seenT'], 'seenD', l['seenD'], 'in80', l['in80'], l.get('in80seen'), l.get('in80late'), 't', l['t'])
    for l in nomark_cut[:5]: print('   UNMARKED cut', l['to'][:40], l['g'], l['f'], l['kinds'], l.get('hint'))
    hl = [l for l in legs if l.get('hint') and l.get('mark')]
    bad = []
    for l in hl:
        h = l['hint']['h']; dom = l['hint']['dom'] or ''
        if not h or h['kind'] != l['mark']['kind'] or h['names'] != [l['mark']['board']] or l['mark']['board'] not in dom: bad.append((dom, l['mark'], h and h['names']))
    print(f"   hint matches board (kind, name, DOM text): {len(hl)-len(bad)}/{len(hl)}", bad[:4])
    raised = [l for l in mk if l['mark']['kind'] == 'tunnel' and l['y'] > 2]
    print(f"   tunnel marks to raised pads: {len(raised)}; replans {sum(l.get('replans',0) or 0 for l in legs)}, marks dropped before entry {sum(l.get('dropped',0) or 0 for l in legs)}, legs with >1 mark name {sum(1 for l in legs if len(l.get('allMarks') or [])>1)}")
    c = sum(r['crashes'] for r in R.values()); s = sum(r['simT'] for r in R.values())
    print(f"   crashes {c} in {s}s = {c/s*60:.2f}/min; kinds {collections.Counter(x['wk'] for r in R.values() for x in r['crashList'])}; scores {sorted((r['score'], r['tier']) for r in R.values())}")
G = B['grid']
def matched(other, sel):
    tg = to = 0; n = 0; co = 0
    for s, g in G.items():
        o = B[other].get(s)
        if not o: continue
        ol = {(l['from'], l['to']): l for l in o['legs'] if l['done']}
        for l in g['legs']:
            if not l['done'] or not sel(l): continue
            x = ol.get((l['from'], l['to']))
            if not x: continue
            tg += l['t']; to += x['t']; n += 1; co += x['crashes']
    return n, tg, to, co
for name, sel in [('marked at leg start (grid run)', lambda l: l.get('mark')), ('alley/tunnel 15% cut', lambda l: nar(l) and l['cut']), ('alley/tunnel on route', nar), ('all legs', lambda l: True)]:
    for o in ['sign', 'feat']:
        n, tg, to, co = matched(o, sel)
        if n: print(f"{name}: {o} vs grid on {n} matched legs: grid {tg:.1f}s {o} {to:.1f}s faster by {1-to/tg:.3f}; {o} crashes on them {co} ({co/to*60:.2f}/min)")
