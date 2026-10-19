# Round 39 critic (new): contact sheet from a video39c frame folder. Args: TAG OUT T1 T2 ... (s from the recording start).
import json, sys, bisect
from PIL import Image, ImageDraw
S = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c39/'
tag, out, ts = sys.argv[1], sys.argv[2], [float(x) for x in sys.argv[3:]]
J = json.load(open(S + f'frames-{tag}/frames.json')); rel = [t - J['tRec'] for t in J['frames']]
ims = []
for t in ts:
    i = max(0, bisect.bisect_right(rel, t) - 1); im = Image.open(S + f'frames-{tag}/{i:05d}.jpg').convert('RGB')
    w = 640; im = im.resize((w, int(im.height * w / im.width))); ImageDraw.Draw(im).text((8, 8), f'{t:.2f}s', fill=(255, 255, 0)); ims.append(im)
cols = 3; rows = (len(ims) + cols - 1) // cols; W, H = ims[0].size
sheet = Image.new('RGB', (W * cols, H * rows))
for k, im in enumerate(ims): sheet.paste(im, ((k % cols) * W, (k // cols) * H))
sheet.save(out, quality=80); print(out, sheet.size)
