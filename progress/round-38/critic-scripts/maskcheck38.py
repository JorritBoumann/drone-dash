# Round 38 critic (new): does the rect mask of contrast38.py cover every pixel where the HUD shot differs from the clean
# shot? Counts pixels in the cruise and low bands with |hud - clean| > T (luminance) that the dilated rect mask leaves in.
# Also the total HUD footprint in each band (pixels that differ at all).
import sys, os, json, numpy as np
from PIL import Image
C = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c38/shots/'
M = '-m' if os.environ.get('MOBILE') else ''
T = 12
CR, LO = (0, 200 / 720), (170 / 720, 400 / 720)
for t in sys.argv[1:]:
    for s in ['130', '22', '33', '58']:
        p = f'{C}water38-{t}{M}-{s}-'; rects = json.load(open(f'{C}rects38-{t}{M}-{s}.json'))
        for nm, band in (('g-cruise', CR), ('g-low', LO)):
            h = np.asarray(Image.open(p + nm + '-hud.jpg').convert('L'), float); c = np.asarray(Image.open(p + nm + '-clean.jpg').convert('L'), float)
            H, W = h.shape; band_m = np.zeros(h.shape, bool); band_m[int(band[0] * H):int(band[1] * H), :] = True
            keep = band_m.copy(); skipped = 0
            for x0, y0, x1, y1 in rects[nm]:
                if (x1 - x0) * (y1 - y0) > 0.2 * W * H: skipped += 1; continue
                keep[max(0, y0 - 6):max(0, y1 + 6), max(0, x0 - 6):max(0, x1 + 6)] = False
            d = np.abs(h - c) > T
            print(f'{t}{M} {s} {nm}: HUD pixels in band {int((d & band_m).sum())}, left in by the rect mask {int((d & keep).sum())}, big rects skipped {skipped}')
