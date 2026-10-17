# Round 32 builder: blind A/B pairs of water views, round 31 (critic's shots of the round 31 build) against round 32
# (this build, same script water31.mjs, same frames). Random sides, shuffled order, key in out/ab/.key.json, opened
# only after the picks are written to out/ab/picks.txt. Usage: python3 ab32.py (make) | python3 ab32.py score
import json, random, os, sys
from PIL import Image
OLD = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/round-31/critic/'
NEW = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/round-32/builder-scripts/out/'
out = NEW + 'ab/'; os.makedirs(out, exist_ok=True)
if len(sys.argv) > 1 and sys.argv[1] == 'score':
    key = json.load(open(out + '.key.json')); picks = {}
    for l in open(out + 'picks.txt'):
        p = l.split()
        if len(p) >= 2 and p[0].startswith('pair-'): picks[p[0]] = p[1].upper()
    w = t = l_ = 0
    for k, v in sorted(key.items()):
        pk = picks.get(k, '?'); res = 'tie' if pk == 'T' else ('new' if pk == v['newSide'] else 'old')
        w += res == 'new'; t += res == 'tie'; l_ += res == 'old'
        print(k, v['seed'], v['view'], 'pick', pk, 'new on', v['newSide'], '->', res)
    print('new wins', w, 'ties', t, 'old wins', l_)
    sys.exit()
rng = random.SystemRandom()
items = [(s, v) for s in ['130', '33', '58'] for v in ['g-cruise', 'g-low']] + [('22', 'shoreline'), ('22', 'glint'), ('m-22', 'g-cruise'), ('m-22', 'g-low')]
rng.shuffle(items); key = {}
for i, (s, v) in enumerate(items, 1):
    o, n = f'{OLD}water31-r31-{s}-{v}.jpg', f'{NEW}water31-r31-{s}-{v}.jpg'
    newLeft = rng.random() < 0.5
    L, R = (n, o) if newLeft else (o, n)
    a, b = Image.open(L), Image.open(R)
    w = 640; a = a.resize((w, int(a.height * w / a.width))); b = b.resize((w, int(b.height * w / b.width)))
    im = Image.new('RGB', (w * 2 + 8, max(a.height, b.height)), (255, 255, 255)); im.paste(a, (0, 0)); im.paste(b, (w + 8, 0))
    im.save(f'{out}pair-{i:02d}.jpg', quality=80); key[f'pair-{i:02d}'] = {'seed': s, 'view': v, 'newSide': 'A' if newLeft else 'B'}
json.dump(key, open(out + '.key.json', 'w'), indent=1)
print(len(items))
