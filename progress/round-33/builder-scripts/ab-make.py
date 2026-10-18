# Round 29 critic: ab-make.py with round 28 (old) against round 29 (new). Round 28 critic: blind A/B pairs. For every art27 view (6 views x 2 moods x 2 devices) put the round 27 image and the
# round 28 image side by side in random order (A left, B right), shuffle pair order, write pairs as ab/pair-NN.jpg with no
# names on them, and store the key in ab/.key.json (not opened until all picks are written).
import json, random, os
from PIL import Image, ImageDraw
R = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/'
old, new, out = R + 'round-28/critic/', R + 'round-29/critic/', R + 'round-29/critic/ab/'
rng = random.SystemRandom()
items = []
for dev in 'dm':
  for mood in ['hour-130', 'morning-22']:
    for v in ['street', 'shopfront', 'facade-mid', 'mid', 'cruise', 'cruise-down']:
      o, n = f'{old}art28-{dev}-{mood}-{v}.jpg', f'{new}art29-{dev}-{mood}-{v}.jpg'
      if not (os.path.exists(o) and os.path.exists(n)): print('MISSING', dev, mood, v); continue
      items.append((dev, mood, v, o, n))
rng.shuffle(items)
key = {}
for i, (dev, mood, v, o, n) in enumerate(items, 1):
  newLeft = rng.random() < 0.5
  L, Rr = (n, o) if newLeft else (o, n)
  a, b = Image.open(L).convert('RGB'), Image.open(Rr).convert('RGB')
  w = max(a.width, b.width); h = max(a.height, b.height)
  c = Image.new('RGB', (w * 2 + 20, h + 40), (20, 20, 20))
  c.paste(a, (0, 40)); c.paste(b, (w + 20, 40))
  d = ImageDraw.Draw(c); d.text((10, 10), 'A', fill=(255, 255, 255)); d.text((w + 30, 10), 'B', fill=(255, 255, 255))
  c.save(f'{out}pair-{i:02d}.jpg', quality=85)
  key[f'{i:02d}'] = {'dev': dev, 'mood': mood, 'view': v, 'new': 'A' if newLeft else 'B'}
json.dump(key, open(out + '.key.json', 'w'))
print('pairs', len(items))
