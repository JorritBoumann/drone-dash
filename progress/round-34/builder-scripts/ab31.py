# Round 31 critic: blind A/B pairs of water views, round 30 (old flat water) against round 31 (new water). Random sides,
# shuffled order, key in ../builder-shots/ab/.key.json (opened only after the picks are written).
import json, random, os
from PIL import Image
C = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/round-31/critic/'
out = C + 'ab/'; os.makedirs(out, exist_ok=True)
rng = random.SystemRandom()
items = [(s, v) for s in ['130', '33', '58'] for v in ['g-cruise', 'g-low']] + [('22', 'shoreline'), ('22', 'glint'), ('m-22', 'g-cruise'), ('m-22', 'g-low')]
rng.shuffle(items); key = {}
for i, (s, v) in enumerate(items, 1):
    o, n = f'{C}water31-r30-{s}-{v}.jpg', f'{C}water31-r31-{s}-{v}.jpg'
    newLeft = rng.random() < 0.5
    L, R = (n, o) if newLeft else (o, n)
    a, b = Image.open(L), Image.open(R)
    w = 640; a = a.resize((w, int(a.height * w / a.width))); b = b.resize((w, int(b.height * w / b.width)))
    im = Image.new('RGB', (w * 2 + 8, max(a.height, b.height)), (255, 255, 255)); im.paste(a, (0, 0)); im.paste(b, (w + 8, 0))
    im.save(f'{out}pair-{i:02d}.jpg', quality=80); key[f'pair-{i:02d}'] = {'seed': s, 'view': v, 'newSide': 'A' if newLeft else 'B'}
json.dump(key, open(out + '.key.json', 'w'), indent=1)
print(len(items))
