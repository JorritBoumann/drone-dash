# Round 36 critic: two blind A/B sets, round 36 (r36) against the round 35 control (r35c, commit 5a53f9e), same seed, time
# and pose. Set "boat": the six close views of ab35. Set "wake": six wake views from above (wake36.mjs). Top or bottom is
# random per pair (SystemRandom). Keys go to critic/ab/.key-<set>.json; picks go to critic/ab/picks-<set>.txt BEFORE the
# keys are opened.
import json, random, os
from PIL import Image
S = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c36/shots/'
O = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../critic/ab/'); os.makedirs(O, exist_ok=True)
sets = {
  'boat': [('hw35-{t}-golden-sail-into-hull'), ('hw35-{t}-golden-row-into-hull'), ('hw35-{t}-morning-rib-low-quarter'),
           ('hw35-{t}-dusk-sail-very-close'), ('hw35-{t}-golden-ferry-low-quarter'), ('hw35-{t}-m-golden-sail-low-quarter')],
  'wake': [('wake36-{t}-golden-sail-top'), ('wake36-{t}-golden-rib-cruise'), ('wake36-{t}-morning-ferry-top'),
           ('wake36-{t}-morning-rib-top'), ('wake36-{t}-dusk-sail-cruise'), ('wake36-{t}-m-golden-rib-top')],
}
rng = random.SystemRandom()
for name, pairs in sets.items():
    key = {}
    for n, v in enumerate(pairs, 1):
        new = Image.open(S + v.format(t='r36') + '.jpg').convert('RGB'); old = Image.open(S + v.format(t='r35c') + '.jpg').convert('RGB')
        w = 1100; new = new.resize((w, int(new.height * w / new.width))); old = old.resize((w, int(old.height * w / old.width)))
        top_new = rng.random() < 0.5
        a, b = (new, old) if top_new else (old, new)
        c = Image.new('RGB', (w, a.height + b.height + 8), (255, 255, 255)); c.paste(a, (0, 0)); c.paste(b, (0, a.height + 8))
        c.save(O + f'{name}-{n}.jpg', quality=80)
        key[n] = {'view': v.format(t=''), 'new': 'top' if top_new else 'bottom'}
    json.dump(key, open(O + f'.key-{name}.json', 'w'))
    print(name, 'pairs written', len(pairs))
