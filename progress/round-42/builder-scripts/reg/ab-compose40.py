# Round 40 critic: blind pair images. For pair P the key says which build is A and which is B. Writes
# ab/P.jpg (minimap crops, A left, B right) and ab/P-full.jpg (full frames, A top, B bottom). Prints nothing about the key.
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
raw, keyf, out = sys.argv[1], sys.argv[2], sys.argv[3]
key = json.load(open(keyf))
meta = {m['name']: m for t in ('bm', 'bw') for m in json.load(open(f'{raw}/meta-{t}.json'))}
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22)
def crop(name):
    m = meta[name]; im = Image.open(f'{raw}/{name}.png').convert('RGB'); s = im.width / m['vw']
    size = 110 if m['dev'] == 'phone' else 160; mg = 16
    b = m['box']
    l, t, r, bb = b['l'] - mg, b['t'] - mg, b['r'] + mg, b['b'] + mg
    if m['onScreen'] < 0.05:  # map not on screen: show where it would sit (bottom-right corner)
        r, bb = m['vw'], m['vh']; l, t = r - size - 2 * mg - 12, bb - size - 2 * mg - 12
    l, t, r, bb = max(0, l), max(0, t), min(m['vw'], r), min(m['vh'], bb)
    return im.crop((int(l * s), int(t * s), int(r * s), int(bb * s))), im
for p, (a, b) in key.items():
    ca, fa = crop(f'{a}-{p}'); cb, fb = crop(f'{b}-{p}')
    W = ca.width + cb.width + 60; H = max(ca.height, cb.height) + 40
    img = Image.new('RGB', (W, H), (40, 40, 40)); d = ImageDraw.Draw(img)
    img.paste(ca, (20, 36)); img.paste(cb, (40 + ca.width, 36))
    d.text((20, 6), 'A', fill=(255, 255, 255), font=font); d.text((40 + ca.width, 6), 'B', fill=(255, 255, 255), font=font)
    img.save(f'{out}/{p}.jpg', quality=80)
    fw = 960
    ra = fa.resize((fw, round(fa.height * fw / fa.width))); rb = fb.resize((fw, round(fb.height * fw / fb.width)))
    full = Image.new('RGB', (fw + 40, ra.height + rb.height + 30), (40, 40, 40)); d = ImageDraw.Draw(full)
    full.paste(ra, (40, 0)); full.paste(rb, (40, ra.height + 30)); d.text((8, 8), 'A', fill=(255, 255, 255), font=font); d.text((8, ra.height + 38), 'B', fill=(255, 255, 255), font=font)
    full.save(f'{out}/{p}-full.jpg', quality=80)
print('composed', len(key))
