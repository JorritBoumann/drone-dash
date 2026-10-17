# Round 29 builder: before (round 28 build, art28b-*) / after (art29-*) pairs of the art27 spots, side by side, labelled.
import os
from PIL import Image, ImageDraw
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'builder-shots') + '/'
n = 0
for dev in 'dm':
  for mood in ['hour-130', 'morning-22']:
    for v in ['street', 'shopfront', 'facade-mid', 'mid', 'cruise', 'cruise-down', 'people-close-f0']:
      a, b = f'{D}art28b-{dev}-{mood}-{v}.jpg', f'{D}art29-{dev}-{mood}-{v}.jpg'
      if not (os.path.exists(a) and os.path.exists(b)): print('MISSING', dev, mood, v); continue
      A, B = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
      w, h = A.width, A.height
      c = Image.new('RGB', (w * 2 + 20, h + 40), (20, 20, 20)); c.paste(A, (0, 40)); c.paste(B, (w + 20, 40))
      d = ImageDraw.Draw(c); d.text((10, 10), 'before (round 28)', fill=(255, 255, 255)); d.text((w + 30, 10), 'after (round 29)', fill=(255, 255, 255))
      c.save(f'{D}ab/ba29-{dev}-{mood}-{v}.jpg', quality=80); n += 1
print('pairs', n)
