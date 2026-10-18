# Round 31 critic: fine-grain contrast of the water in the game-camera shots from water31.mjs (desktop 1280x720).
# Metric: std of (luminance minus a 9x9 box blur) over the water band: top 200 rows for g-cruise (drone at 24 m facing the
# sea), rows 170-400 for g-low (drone at 2 m). High = busy fine chop. Usage: python3 contrast31.py [tag ...] (r32c r33).
# Round 34 builder copy (tags r33c, r34): reads round-34/builder-shots/water33-<tag>-*.
import sys, numpy as np
from PIL import Image
from numpy.lib.stride_tricks import sliding_window_view as sw
R = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/'
def fine(fn, box):
    a = np.asarray(Image.open(fn).convert('L'), dtype=float)[box[1]:box[3], box[0]:box[2]]
    b = sw(np.pad(a, 4, mode='edge'), (9, 9)).mean(axis=(2, 3)); return (a - b).std()
for t in (sys.argv[1:] or ['r33c', 'r34']):
    C = R + 'round-34/builder-shots/water33-'
    for s in ['130', '22', '33', '58']:
        cr, lo = fine(f'{C}{t}-{s}-g-cruise.jpg', (0, 0, 1280, 200)), fine(f'{C}{t}-{s}-g-low.jpg', (0, 170, 1280, 400))
        print(t, s, 'cruise %.1f low %.1f ratio %.2f' % (cr, lo, cr / lo))
