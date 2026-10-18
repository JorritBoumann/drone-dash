# Round 36 builder: blind A/B, round 35 (control, port 5193) against round 36 (5190), from boatshots36.mjs frames
# (same seed, time and pose relative to the boat). Left / right is random (SystemRandom); the key is written to
# <out>/ab36-<set>-key.json BEFORE judging and the pair images carry no build label. Usage:
#   python3 ab36.py make <set> <shots folder> <out folder>   (set: boats or wakes)
#   python3 ab36.py score <set> <out folder> L,R,...
import json, os, random, sys
from PIL import Image

SETS = {
    # (file stem after the tag: [-m]-<seed>-<view>)
    'boats': ['130-sail-moored-close', '130-row-into-hull', '22-rib-quarter', '33-sail-quarter', '130-ferry-quarter', 'm-130-sail-quarter'],
    'wakes': ['130-sail-above', '22-sail-cruise', '33-rib-cruise', '130-rib-above', '22-ferry-above', '130-ferry-stern'],
}

def path(src, tag, stem):
    return f'{src}/{tag}-{stem}.jpg'

if sys.argv[1] == 'make':
    st, src, out = sys.argv[2], sys.argv[3], sys.argv[4]
    os.makedirs(out, exist_ok=True)
    rng = random.SystemRandom()
    key = {}
    for i, stem in enumerate(SETS[st], 1):
        a = Image.open(path(src, 'r35', stem)).convert('RGB')
        b = Image.open(path(src, 'r36', stem)).convert('RGB').resize(a.size)
        new_top = rng.random() < 0.5
        t, u = (b, a) if new_top else (a, b)
        w, h = t.size
        sheet = Image.new('RGB', (w, h * 2 + 12), (20, 20, 20))
        sheet.paste(t, (0, 0)); sheet.paste(u, (0, h + 12))
        sheet.resize((w * 3 // 4, (h * 2 + 12) * 3 // 4)).save(f'{out}/{st}-{i}.jpg', quality=85)
        key[i] = {'new': 'T' if new_top else 'B', 'view': stem}
    json.dump(key, open(f'{out}/ab36-{st}-key.json', 'w'), indent=1)
    print('made', len(key), st, 'pairs; key written before judging')
else:
    st, out, picks = sys.argv[2], sys.argv[3], sys.argv[4].split(',')
    key = json.load(open(f'{out}/ab36-{st}-key.json'))
    wins = 0
    for i, p in enumerate(picks, 1):
        k = key[str(i)]
        won = p == k['new']
        wins += won
        print(i, k['view'], 'picked', p, 'new was', k['new'], 'NEW WINS' if won else 'old wins')
    print(f'{st}: new wins {wins} of {len(picks)}')
