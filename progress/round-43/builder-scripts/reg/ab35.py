# Round 35 critic: blind A/B of close boat views, round 35 against the round 34 control (05cd223), same seed, same
# time, same pose relative to the boat. Top or bottom is random per pair. The key goes to critic/ab/.key.json; picks
# are written to critic/ab/picks.txt BEFORE the key is opened.
import json, random, os
from PIL import Image
S = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c36/shots/'
O = os.path.join(os.path.dirname(__file__), '../critic/ab/'); os.makedirs(O, exist_ok=True)
pairs = [('', 'golden-sail-into-hull'), ('', 'golden-row-into-hull'), ('', 'morning-rib-low-quarter'),
         ('', 'dusk-sail-very-close'), ('', 'golden-ferry-low-quarter'), ('-m', 'golden-sail-low-quarter')]
rng = random.SystemRandom(); key = {}
for n, (m, v) in enumerate(pairs, 1):
    new = Image.open(S + f'hw35-r35{m}-{v}.jpg').convert('RGB'); old = Image.open(S + f'hw35-r34c{m}-{v}.jpg').convert('RGB')
    w = 1100; new = new.resize((w, int(new.height * w / new.width))); old = old.resize((w, int(old.height * w / old.width)))
    top_new = rng.random() < 0.5
    a, b = (new, old) if top_new else (old, new)
    c = Image.new('RGB', (w, a.height + b.height + 8), (255, 255, 255)); c.paste(a, (0, 0)); c.paste(b, (0, a.height + 8))
    c.save(O + f'boat-{n}.jpg', quality=80)
    key[n] = {'view': m + v, 'new': 'top' if top_new else 'bottom'}
json.dump(key, open(O + '.key.json', 'w'))
print('pairs written', len(pairs))
