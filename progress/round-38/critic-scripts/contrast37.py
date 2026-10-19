# Round 37 critic: contrast31.py metric, plus the same metric with the HUD masked out (HUD boxes dilated by 6 px so the
# 9x9 blur bleed is excluded too). Also the low band split into rows 170-300 (far) and 300-400 (near).
import sys, os, numpy as np
from PIL import Image
from numpy.lib.stride_tricks import sliding_window_view as sw
C = os.environ.get('CDIR', '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c38/shots/')
HUD = [(0, 0, 85, 80), (545, 5, 735, 68), (470, 66, 810, 112), (1140, 8, 1272, 68)]  # 1280x720 desktop
def detail(fn):
    a = np.asarray(Image.open(fn).convert('L'), dtype=float)
    b = sw(np.pad(a, 4, mode='edge'), (9, 9)).mean(axis=(2, 3)); return a - b
def std(d, box, mask=False):
    m = np.zeros(d.shape, bool); m[box[1]:box[3], box[0]:box[2]] = True
    if mask:
        for x0, y0, x1, y1 in HUD: m[max(0, y0 - 6):y1 + 6, max(0, x0 - 6):x1 + 6] = False
    return d[m].std()
for t in (sys.argv[1:] or ['r31', 'r30']):
    for s in ['130', '22', '33', '58']:
        dc, dl = detail(f'{C}water31-{t}-{s}-g-cruise.jpg'), detail(f'{C}water31-{t}-{s}-g-low.jpg')
        cr, lo = std(dc, (0, 0, 1280, 200)), std(dl, (0, 170, 1280, 400)); crm = std(dc, (0, 0, 1280, 200), True)
        print(t, s, 'cruise %.2f low %.2f ratio %.3f | HUD masked: cruise %.2f ratio %.3f | low far %.1f near %.1f' % (cr, lo, cr / lo, crm, crm / lo, std(dl, (0, 170, 1280, 300)), std(dl, (0, 300, 1280, 400))))
