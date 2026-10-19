# Round 37 builder: blind A/B, round 37 final (r37c) against the round 36 control (r36c, commit f63a1c3), same seed, time and
# pose. Set "low": six low boat views (boatlow37.mjs). Set "streak": the golden and dusk 1 m game views (water31.mjs
# g-low) against the round 34 critic's own frames (water34-r34-*-g-low.jpg), to check the round 33 soft streaks did not
# come back. Top or bottom is random per pair (SystemRandom); keys go to builder-shots/ab/.key-<set>.json BEFORE judging.
import json, random, os
from PIL import Image
S = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r37/shots/'
R34 = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/round-34/critic/'
O = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../builder-shots/ab/'); os.makedirs(O, exist_ok=True)
sets = {
  'low': [(S + 'bl37-r37c-golden-sail-low-side.jpg', S + 'bl37-r36c-golden-sail-low-side.jpg'),
          (S + 'bl37-r37c-golden-rib-low-quarter.jpg', S + 'bl37-r36c-golden-rib-low-quarter.jpg'),
          (S + 'bl37-r37c-golden-row-low-side.jpg', S + 'bl37-r36c-golden-row-low-side.jpg'),
          (S + 'bl37-r37c-morning-sail-low-quarter.jpg', S + 'bl37-r36c-morning-sail-low-quarter.jpg'),
          (S + 'bl37-r37c-morning-rib-low-side.jpg', S + 'bl37-r36c-morning-rib-low-side.jpg'),
          (S + 'bl37-r37c-morning-row-low-quarter.jpg', S + 'bl37-r36c-morning-row-low-quarter.jpg')],
  'streak': [(S + 'water31-r37c-130-g-low.jpg', R34 + 'water34-r34-130-g-low.jpg'),
             (S + 'water31-r37c-33-g-low.jpg', R34 + 'water34-r34-33-g-low.jpg')],
}
rng = random.SystemRandom()
for name, pairs in sets.items():
    key = {}
    for n, (nf, of) in enumerate(pairs, 1):
        new = Image.open(nf).convert('RGB'); old = Image.open(of).convert('RGB')
        w = 1100; new = new.resize((w, int(new.height * w / new.width))); old = old.resize((w, int(old.height * w / old.width)))
        top_new = rng.random() < 0.5
        a, b = (new, old) if top_new else (old, new)
        c = Image.new('RGB', (w, a.height + b.height + 8), (255, 255, 255)); c.paste(a, (0, 0)); c.paste(b, (0, a.height + 8))
        c.save(O + f'{name}-{n}.jpg', quality=80)
        key[n] = {'view': os.path.basename(nf), 'new': 'top' if top_new else 'bottom'}
    json.dump(key, open(O + f'.key-{name}.json', 'w'))
    print(name, 'pairs written', len(pairs))
