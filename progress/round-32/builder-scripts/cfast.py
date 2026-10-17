import sys, numpy as np
from PIL import Image
from numpy.lib.stride_tricks import sliding_window_view as sw
C = sys.argv[1] if len(sys.argv) > 1 else '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/round-32/builder-scripts/out/fast/'
def fine(fn, box):
    a = np.asarray(Image.open(fn).convert('L'), dtype=float)[box[1]:box[3], box[0]:box[2]]
    b = sw(np.pad(a, 4, mode='edge'), (9, 9)).mean(axis=(2, 3)); return (a - b).std()
for s in ['130', '22', '33', '58']:
    cr, lo = fine(f'{C}water31-r31-{s}-g-cruise.jpg', (0, 0, 1280, 200)), fine(f'{C}water31-r31-{s}-g-low.jpg', (0, 170, 1280, 400))
    print(s, 'cruise %.1f low %.1f ratio %.2f' % (cr, lo, cr / lo))
