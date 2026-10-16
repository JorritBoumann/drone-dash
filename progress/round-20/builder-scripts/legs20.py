# Round 20 builder: route-mark acceptance from route-sign20 logs: FEAT=0 grid bot (sign-grid-*.log), FEAT=2 sign follower
# (sign-sign-*.log), FEAT=1 shortcut bot (sign-feat-*.log, crash rate only). Usage: python3 legs20.py
import json, glob, os, sys
D = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'builder', 'detF')
def load(pat):
    out = {}
    for f in sorted(glob.glob(os.path.join(D, pat))):
        for l in open(f):
            if l.startswith('{'): r = json.loads(l); out[r['seed']] = r
    return out
G, S, F = load('sign-grid-*.log'), load('sign-sign-*.log'), load('sign-feat-*.log')
print('cities grid', len(G), 'sign', len(S), 'feat', len(F))
def marklegs(R): return [(s, l) for s, r in R.items() for l in r['legs'] if l.get('mark')]
for tag, R in (('grid', G), ('sign', S)):
    ml = marklegs(R)
    vis = [l for s, l in ml if l.get('seen') and (l['seen']['delay'] <= 3 or l['seen']['dist'] <= 80)]
    tag0 = [l for s, l in ml if l.get('seen') and l['seen']['tag'] <= 0.1]
    unseen = [(s, l['to'][:30], l['mark']['gd'], l.get('t')) for s, l in ml if not (l.get('seen') and (l['seen']['delay'] <= 3 or l['seen']['dist'] <= 80))]
    hb = [l for s, l in ml if l.get('hintDom') == l['mark']['board'] == l['mark']['name']]
    bad = [(l.get('hintDom'), l['mark']['board'], l['mark']['name']) for s, l in ml if not (l.get('hintDom') == l['mark']['board'] == l['mark']['name'])]
    print(f'{tag}: mark legs {len(ml)}; arch in view within 3 s or at <=80 m: {len(vis)}; HUD tag at 0 s: {len(tag0)}; hint == board: {len(hb)}')
    if unseen: print('   not seen in time:', unseen[:12])
    if bad: print('   hint/board mismatch:', bad[:6])
    if tag == 'sign':
        dl = [l['seen']['delay'] for s, l in ml if l.get('seen')]
        print('   arch seen delay s: median', sorted(dl)[len(dl)//2] if dl else None, 'max', max(dl) if dl else None, ' through the marked entrance on', sum(1 for s, l in ml if l.get('through')), 'legs')
tg = ts = 0; n = 0; per = []
for s, g in G.items():
    sg = S.get(s)
    if not sg: continue
    fl = {(l['from'], l['to']): l for l in sg['legs'] if l['done']}
    for l in g['legs']:
        if not l['done'] or not l.get('mark'): continue
        o = fl.get((l['from'], l['to']))
        if not o: continue
        tg += l['t']; ts += o['t']; n += 1; per.append((s, round(l['t'], 1), round(o['t'], 1), l['mark']['kind']))
print(f'matched mark legs {n}: grid {tg:.1f} s, sign {ts:.1f} s, sign faster by {1 - ts / tg:.3f}' if n else 'no matched legs')
tg = tf = 0; n = 0
for s, g in G.items():
    fg = F.get(s)
    if not fg: continue
    fl = {(l['from'], l['to']): l for l in fg['legs'] if l['done']}
    for l in g['legs']:
        if not l['done'] or not l.get('mark'): continue
        o = fl.get((l['from'], l['to']))
        if o: tg += l['t']; tf += o['t']; n += 1
if n: print(f'shortcut bot (street graph) on the same mark legs {n}: grid {tg:.1f} s, shortcut {tf:.1f} s, faster by {1 - tf / tg:.3f}')
for tag, R in (('grid', G), ('sign', S), ('feat', F)):
    c = sum(r['crashes'] for r in R.values()); t = sum(r['simT'] for r in R.values())
    if t: print(f'{tag}: crashes {c} in {t} s = {c / t * 60:.2f}/min; kinds', [x['wk'] for r in R.values() for x in r['crashList']])
for tag, R in (('grid', G), ('sign', S), ('feat', F)):
    print(tag, 'scores', sorted((r['score'], r['tier']) for r in R.values()))
