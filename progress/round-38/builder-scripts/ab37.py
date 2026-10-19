# Round 37 critic: blind A/B sets. Top or bottom is random per pair (SystemRandom). Keys go to critic/ab/.key-<set>.json;
# picks go to critic/ab/picks-<set>.txt BEFORE the keys are opened.
#  boat : 6 low boat views (hullwater35 low-side / low-quarter), round 37 (r37) vs round 36 (r36c, commit f63a1c3)
#  w36  : 1 m water views, golden and dusk, open sea and marina, r37 vs r36 (water37.mjs, tags r37b / r36cb)
#  w34  : the same views, r37 vs round 34 (r34cb, commit 8284d4a)
import json, random, os, sys
from PIL import Image
S = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r38/shots/'
O = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../builder-shots/ab/'); os.makedirs(O, exist_ok=True)
sets = {
  'boat': [('hw35-{t}-golden-sail-low-side', 'r37', 'r36c'), ('hw35-{t}-morning-sail-low-quarter', 'r37', 'r36c'),
           ('hw35-{t}-golden-rib-low-quarter', 'r37', 'r36c'), ('hw35-{t}-morning-rib-low-side', 'r37', 'r36c'),
           ('hw35-{t}-golden-row-low-quarter', 'r37', 'r36c'), ('hw35-{t}-morning-row-low-side', 'r37', 'r36c')],
  'w36': [(f'w37-{{t}}-{m}-{p}-1m', 'r37b', 'r36cb') for m in ('golden', 'dusk') for p in ('sea', 'marina')],
  'w34': [(f'w37-{{t}}-{m}-{p}-1m', 'r37b', 'r34cb') for m in ('golden', 'dusk') for p in ('sea', 'marina')],
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
