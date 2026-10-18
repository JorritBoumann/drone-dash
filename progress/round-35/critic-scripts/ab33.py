# Round 33 critic: blind A/B pairs, round 32 control (port 5192) against round 33, three sets of 6:
#  street = art27 views (art27c-* vs art27-*), water = water31 views (water33-r32c-* vs water33-r33-*),
#  cruise = fast cruise frames from cruise33.mjs (cruise33-r32c-* vs cruise33-r33-*).
# Random sides (SystemRandom), shuffled order; key in ../critic/ab/.key.json, opened only after ../critic/ab/picks.txt.
import json, random, os
from PIL import Image
C = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/round-33/critic/'
out = C + 'ab/'; os.makedirs(out, exist_ok=True)
rng = random.SystemRandom()
sets = {
 'street': [('art27c-d-hour-130-street', 'art27-d-hour-130-street'), ('art27c-d-hour-130-mid', 'art27-d-hour-130-mid'), ('art27c-d-hour-130-cruise', 'art27-d-hour-130-cruise'),
            ('art27c-d-morning-22-shopfront', 'art27-d-morning-22-shopfront'), ('art27c-d-morning-22-cruise-down', 'art27-d-morning-22-cruise-down'), ('art27c-m-hour-130-cruise', 'art27-m-hour-130-cruise')],
 'water': [(f'water33-r32c-{s}-{v}', f'water33-r33-{s}-{v}') for s, v in [('130', 'g-low'), ('130', 'glint'), ('33', 'g-low'), ('33', 'glint'), ('130', 'g-cruise'), ('58', 'g-cruise')]],
 'cruise': [(f'cruise33-r32c-{s}', f'cruise33-r33-{s}') for s in ['130-ns-1', '130-ew-2', '22-ns-3', '22-ew-1', 'm-22-ns-2', 'm-22-ew-3']],
}
key = {}
for name, items in sets.items():
    items = items[:]; rng.shuffle(items)
    for i, (o, n) in enumerate(items, 1):
        newLeft = rng.random() < 0.5
        L, R = (n, o) if newLeft else (o, n)
        a, b = Image.open(C + L + '.jpg'), Image.open(C + R + '.jpg')
        w = 800; a = a.resize((w, int(a.height * w / a.width))); b = b.resize((w, int(b.height * w / b.width)))
        im = Image.new('RGB', (w, a.height + b.height + 8), (255, 255, 255)); im.paste(a, (0, 0)); im.paste(b, (0, a.height + 8))
        im.save(f'{out}{name}-{i}.jpg', quality=80); key[f'{name}-{i}'] = {'item': n, 'newSide': 'A(top)' if newLeft else 'B(bottom)'}
json.dump(key, open(out + '.key.json', 'w'), indent=1)
print('pairs', len(key))
