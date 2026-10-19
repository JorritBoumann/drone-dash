# Round 38 builder: the contrast31.py water detail metric (std of luminance minus a 9x9 box blur), with every HUD and
# DOM overlay pixel masked out. Uses the water38.mjs shot pairs:
#   old   = contrast31.py exactly, on the shot with the HUD showing (what the critic measured up to round 37)
#   new   = the same on the "clean" shot (every DOM element hidden, only the game canvas drawn): the metric from now on
#   rmask = cross-check: the HUD shot with every visible DOM rect (rects38-*.json) dilated by 6 px masked out
# Bands as in round 31, as fractions of the frame height (1280x720: cruise rows 0-200, low rows 170-400), so the phone
# shots use the same part of the view. Usage: python3 contrast38.py TAG [TAG ...]   (MOBILE=1 for the -m shots)
import sys, os, json, numpy as np
from PIL import Image
from numpy.lib.stride_tricks import sliding_window_view as sw
C = os.environ.get('CDIR', '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c39/shots/')
M = '-m' if os.environ.get('MOBILE') else ''
SEEDS = os.environ.get('SEEDS', '130,22,33,58').split(',')
def detail(fn):
    a = np.asarray(Image.open(fn).convert('L'), dtype=float)
    b = sw(np.pad(a, 4, mode='edge'), (9, 9)).mean(axis=(2, 3)); return a - b
def std(d, rows, rects=()):
    h, w = d.shape; m = np.zeros(d.shape, bool); m[int(rows[0] * h):int(rows[1] * h), :] = True
    for x0, y0, x1, y1 in rects:
        if (x1 - x0) * (y1 - y0) > 0.2 * w * h: continue  # full-screen layers and containers (they paint nothing themselves)
        m[max(0, y0 - 6):max(0, y1 + 6), max(0, x0 - 6):max(0, x1 + 6)] = False
    return d[m].std()
CR, LO = (0, 200 / 720), (170 / 720, 400 / 720)
for t in sys.argv[1:]:
    for s in SEEDS:
        p = f'{C}water38-{t}{M}-{s}-'
        rects = json.load(open(f'{C}rects38-{t}{M}-{s}.json'))
        hc, hl, cc, cl = detail(p + 'g-cruise-hud.jpg'), detail(p + 'g-low-hud.jpg'), detail(p + 'g-cruise-clean.jpg'), detail(p + 'g-low-clean.jpg')
        o_cr, o_lo = std(hc, CR), std(hl, LO)
        n_cr, n_lo = std(cc, CR), std(cl, LO)
        r_cr, r_lo = std(hc, CR, rects['g-cruise']), std(hl, LO, rects['g-low'])
        print(f'{t}{M} {s} old: cruise {o_cr:.2f} low {o_lo:.2f} ratio {o_cr / o_lo:.3f} | new (HUD hidden): cruise {n_cr:.2f} low {n_lo:.2f} ratio {n_cr / n_lo:.3f} | rect-masked: cruise {r_cr:.2f} low {r_lo:.2f}')
