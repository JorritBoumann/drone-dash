# Round 35 builder: blind A/B of close boat views, round 34 (control, port 5193) against round 35 (5190).
# Pairs are the full-size single views written by boatclose35.mjs (AB folder). Left / right is random; the key is
# written to ab35-key.json BEFORE judging, the pair images carry no build label. Usage:
#   python3 ab35.py make <AB folder> <out folder>    -> pair-1..6.jpg + ab35-key.json (do not open the key)
#   python3 ab35.py score <out folder> L,R,...       -> reveals the key and counts the wins
import json, os, random, sys
from PIL import Image

PAIRS = [('golden', 'sail', 'into-hull'), ('morning', 'row', 'into-hull'), ('dusk', 'rib', 'bow-quarter'),
         ('golden', 'row', 'side-low'), ('dusk', 'sail', 'bow-quarter'), ('morning', 'ferry', 'side-low')]

if sys.argv[1] == 'make':
    src, out = sys.argv[2], sys.argv[3]
    os.makedirs(out, exist_ok=True)
    rng = random.SystemRandom()
    key = {}
    for i, (mood, kind, view) in enumerate(PAIRS, 1):
        a = Image.open(f'{src}/r34-{mood}-{kind}-{view}.jpg').convert('RGB')
        b = Image.open(f'{src}/r35-{mood}-{kind}-{view}.jpg').convert('RGB')
        new_left = rng.random() < 0.5
        l, r = (b, a) if new_left else (a, b)
        w, h = l.size
        sheet = Image.new('RGB', (w * 2 + 16, h), (20, 20, 20))
        sheet.paste(l, (0, 0)); sheet.paste(r, (w + 16, 0))
        sheet.resize(((w * 2 + 16) * 3 // 4, h * 3 // 4)).save(f'{out}/pair-{i}.jpg', quality=85)
        key[i] = {'new': 'L' if new_left else 'R', 'mood': mood, 'kind': kind, 'view': view}
    json.dump(key, open(f'{out}/ab35-key.json', 'w'), indent=1)
    print('made', len(key), 'pairs; key written before judging')
else:
    out, picks = sys.argv[2], sys.argv[3].split(',')
    key = json.load(open(f'{out}/ab35-key.json'))
    wins = 0
    for i, p in enumerate(picks, 1):
        k = key[str(i)]
        won = p == k['new']
        wins += won
        print(i, k['mood'], k['kind'], k['view'], 'picked', p, 'new was', k['new'], 'NEW WINS' if won else 'old wins')
    print(f'new wins {wins} of {len(picks)}')
