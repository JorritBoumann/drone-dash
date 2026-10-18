# Round 33 builder: blind A/B pairs, round 32 (port 5192, the round-32 commit) against round 33, two sets of 6:
# art27 street views and water views. Random sides (SystemRandom), shuffled; key written to ../builder-shots/ab/.key.json
# before any judging; picks go to ../builder-shots/ab/picks.txt first, the key is opened only after that.
import json, random, os
from PIL import Image
B = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/round-33/builder-shots/'
out = B + 'ab/'; os.makedirs(out, exist_ok=True)
rng = random.SystemRandom()
sets = {
  'street': [f'art27-{v}.jpg' for v in ['d-hour-130-street', 'd-hour-130-shopfront', 'd-hour-130-people-f0', 'd-morning-22-street', 'd-morning-22-shopfront', 'm-hour-130-street']],
  'water': [f'water33-%s-{v}.jpg' for v in ['130-g-low', '130-glint', '33-g-low', '33-glint', '58-g-cruise', '130-g-marina']],
}
key = {}
for name, items in sets.items():
    rng.shuffle(items)
    for i, it in enumerate(items, 1):
        if name == 'street': o, n = B + 'r32-' + it, B + 'r33-' + it
        else: o, n = B + (it % 'r32'), B + (it % 'r33')
        newLeft = rng.random() < 0.5
        L, R = (n, o) if newLeft else (o, n)
        a, b = Image.open(L), Image.open(R)
        w = 640; a = a.resize((w, int(a.height * w / a.width))); b = b.resize((w, int(b.height * w / b.width)))
        im = Image.new('RGB', (w * 2 + 8, max(a.height, b.height)), (255, 255, 255)); im.paste(a, (0, 0)); im.paste(b, (w + 8, 0))
        im.save(f'{out}{name}-{i:02d}.jpg', quality=82); key[f'{name}-{i:02d}'] = {'item': it, 'newSide': 'A' if newLeft else 'B'}
json.dump(key, open(out + '.key.json', 'w'), indent=1)
print('pairs', len(key))
