# Round 31 critic: fine-grain contrast of the water in the game-camera shots from water31.mjs (desktop 1280x720).
# Metric: std of (luminance minus a 9x9 box blur) over the water band: top 200 rows for g-cruise (drone at 24 m facing the
# sea), rows 170-400 for g-low (drone at 2 m). High = busy fine chop. Usage: python3 contrast31.py [tag ...] (r30 r31).
import sys, numpy as np
from PIL import Image
from numpy.lib.stride_tricks import sliding_window_view as sw
import os; C = os.environ.get('CDIR', '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c39/shots/')
def fine(fn, box):
    a = np.asarray(Image.open(fn).convert('L'), dtype=float)[box[1]:box[3], box[0]:box[2]]
    b = sw(np.pad(a, 4, mode='edge'), (9, 9)).mean(axis=(2, 3)); return (a - b).std()
for t in (sys.argv[1:] or ['r30', 'r31']):
    for s in ['130', '22', '33', '58']:
        cr, lo = fine(f'{C}water31-{t}-{s}-g-cruise.jpg', (0, 0, 1280, 200)), fine(f'{C}water31-{t}-{s}-g-low.jpg', (0, 170, 1280, 400))
        print(t, s, 'cruise %.1f low %.1f ratio %.2f' % (cr, lo, cr / lo))
