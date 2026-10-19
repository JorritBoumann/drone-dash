# Round 38 builder: blind A/B sets (ab37.py method). Top or bottom is random per pair (SystemRandom). The key goes to
# builder-shots/ab/.key-<set>.json when the pairs are made; picks go to builder-shots/ab/picks-<set>.txt BEFORE the key
# is opened.
#  cruise : 4 cruise-height views (water38.mjs EXTRA, HUD showing), round 38 (r38) vs round 37 (r37, commit e733ab3)
#  phone  : 4 phone low views (water38.mjs MOBILE EXTRA, 1 m and 4 m), r38 vs r37
import json, random, os, sys
from PIL import Image
S = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r38/shots/'
O = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../builder-shots/ab/'); os.makedirs(O, exist_ok=True)
sets = {
  'cruise': [('water38-{t}-130-golden-sea-24m-hud', 'r38', 'r37'), ('water38-{t}-22-morning-marina-15m-hud', 'r38', 'r37'),
             ('water38-{t}-33-dusk-marina-24m-hud', 'r38', 'r37'), ('water38-{t}-58-noon-sea-15m-hud', 'r38', 'r37')],
  'phone': [('water38-{t}-m-130-golden-sea-1m-hud', 'r38', 'r37'), ('water38-{t}-m-130-golden-marina-1m-hud', 'r38', 'r37'),
            ('water38-{t}-m-33-dusk-sea-1m-hud', 'r38', 'r37'), ('water38-{t}-m-33-dusk-marina-4m-hud', 'r38', 'r37')],
}
rng = random.SystemRandom()
for name in (sys.argv[1:] or sets):
    key = {}
    for n, (v, tn, to) in enumerate(sets[name], 1):
        new = Image.open(S + v.format(t=tn) + '.jpg').convert('RGB'); old = Image.open(S + v.format(t=to) + '.jpg').convert('RGB')
        w = 1100; new = new.resize((w, int(new.height * w / new.width))); old = old.resize((w, int(old.height * w / old.width)))
        top_new = rng.random() < 0.5
        a, b = (new, old) if top_new else (old, new)
        c = Image.new('RGB', (w, a.height + b.height + 8), (255, 255, 255)); c.paste(a, (0, 0)); c.paste(b, (0, a.height + 8))
        c.save(O + f'{name}-{n}.jpg', quality=80)
        key[n] = {'view': v.format(t=''), 'new': 'top' if top_new else 'bottom', 'old': to}
    json.dump(key, open(O + f'.key-{name}.json', 'w'))
    print(name, 'pairs written', len(sets[name]))
