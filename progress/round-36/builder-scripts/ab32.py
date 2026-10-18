# Round 32 critic: blind A/B pairs of water views, round 31 (water31-r31-*, round-31/critic) against round 32
# (water32-r32-*, round-32/critic). Random sides, shuffled order, key in ../builder-shots/ab/.key.json (opened only after the
# picks are written to ../builder-shots/ab/picks.txt).
import json, random, os
from PIL import Image
R = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/'
C31, C32 = R + 'round-31/critic/', R + 'round-32/critic/'
out = C32 + 'ab/'; os.makedirs(out, exist_ok=True)
rng = random.SystemRandom()
items = [('130', 'g-cruise'), ('130', 'g-low'), ('33', 'g-cruise'), ('33', 'g-low'), ('58', 'g-cruise'), ('22', 'g-cruise'), ('130', 'glint'), ('33', 'glint'), ('m-22', 'g-cruise'), ('130', 'g-marina')]
rng.shuffle(items); key = {}
for i, (s, v) in enumerate(items, 1):
    o, n = f'{C31}water31-r31-{s}-{v}.jpg', f'{C32}water32-r32-{s}-{v}.jpg'
    newLeft = rng.random() < 0.5
    L, Rr = (n, o) if newLeft else (o, n)
    a, b = Image.open(L), Image.open(Rr)
    w = 640; a = a.resize((w, int(a.height * w / a.width))); b = b.resize((w, int(b.height * w / b.width)))
    im = Image.new('RGB', (w * 2 + 8, max(a.height, b.height)), (255, 255, 255)); im.paste(a, (0, 0)); im.paste(b, (w + 8, 0))
    im.save(f'{out}pair-{i:02d}.jpg', quality=80); key[f'pair-{i:02d}'] = {'seed': s, 'view': v, 'newSide': 'A' if newLeft else 'B'}
json.dump(key, open(out + '.key.json', 'w'), indent=1)
print(len(items))
