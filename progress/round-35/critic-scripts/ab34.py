# Round 34 critic: blind A/B pairs, round 33 control (port 5192, tag r33c / art27c) against round 34 (r34 / art27).
#  water = water31 views at 1 m (g-low) and the 14 m glint views; street = art27 views (merged shadows, tape).
# Shots read from the scratch shot folder. Random sides (SystemRandom), shuffled order; key in ../critic/ab/.key.json,
# opened only after ../critic/ab/picks.txt is written.
import json, random, os
from PIL import Image
S = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c35/shots/'
out = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/round-34/critic/ab/'; os.makedirs(out, exist_ok=True)
rng = random.SystemRandom()
sets = {
 'water': [(f'water34-r33c-{s}-{v}', f'water34-r34-{s}-{v}') for s, v in [('130', 'g-low'), ('33', 'g-low'), ('130', 'glint'), ('33', 'glint'), ('22', 'g-low'), ('58', 'g-low')]],
 'street': [('art27c-d-hour-130-street', 'art27-d-hour-130-street'), ('art27c-d-hour-130-mid', 'art27-d-hour-130-mid'), ('art27c-d-hour-130-cruise', 'art27-d-hour-130-cruise'),
            ('art27c-d-morning-22-shopfront', 'art27-d-morning-22-shopfront'), ('art27c-d-morning-22-cruise-down', 'art27-d-morning-22-cruise-down'), ('art27c-m-hour-130-cruise', 'art27-m-hour-130-cruise')],
}
key = {}
for name, items in sets.items():
    items = items[:]; rng.shuffle(items)
    for i, (o, n) in enumerate(items, 1):
        newTop = rng.random() < 0.5
        T, B = (n, o) if newTop else (o, n)
        a, b = Image.open(S + T + '.jpg'), Image.open(S + B + '.jpg')
        w = 800; a = a.resize((w, int(a.height * w / a.width))); b = b.resize((w, int(b.height * w / b.width)))
        im = Image.new('RGB', (w, a.height + b.height + 8), (255, 255, 255)); im.paste(a, (0, 0)); im.paste(b, (0, a.height + 8))
        im.save(f'{out}{name}-{i}.jpg', quality=80); key[f'{name}-{i}'] = {'item': n, 'newSide': 'A(top)' if newTop else 'B(bottom)'}
json.dump(key, open(out + '.key.json', 'w'), indent=1)
print('pairs', len(key))
