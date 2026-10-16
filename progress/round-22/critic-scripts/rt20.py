# Round 20 critic: real-time summaries (gates, guards).
import json, sys
D = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/round-20/critic-scripts/'
def parse(f):
    runs = {}
    try: lines = open(D + f).read().splitlines()
    except FileNotFoundError: return runs
    for l in lines:
        for tag in ['MEDAL ', 'ESC ', 'END ', 'MUSIC ']:
            if l.startswith(tag): r = json.loads(l[len(tag):]); runs.setdefault(r['seed'], {})[tag.strip()] = r
        if l.startswith('{'): r = json.loads(l); runs.setdefault(r['seed'], {})['R'] = r
    return runs
for f in sys.argv[1:]:
    runs = parse(f); tot = 0
    print('==', f)
    for s, x in runs.items():
        R = x.get('R', {}); M = x.get('MEDAL', {}); E = x.get('ESC', {}); N = x.get('END', {})
        bd = M.get('breakdown', {})
        rush = [e for e in E.get('rush', []) if e['k'] == 'rushhour']
        ot = [e['k'] for e in N.get('log', []) if e['k'].startswith('ot') or e['k'] == 'overtime']
        tot += R.get('score', 0)
        print(f"  {s}: {R.get('score')} {M.get('tierName') or 'none'} drops {R.get('deliveries')} crashes {R.get('crashes')} simT {R.get('simT')} slip {bd.get('slip')} ({(bd.get('slip',0) or 0)/max(1,R.get('score',1)):.2f}) bdOk {M.get('bdOk')} domOk {M.get('domOk')} card '{(M.get('overDom') or {}).get('medal')}' rush@{[e['t'] for e in rush]} ot {ot} music {'' if 'MUSIC' not in x else [(c['chain'], c['layers'], c['meanI']) for c in x['MUSIC']['byChain']]}")
    print('  total', tot)
