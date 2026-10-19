# Round 37 critic: wake arm continuity and trail brightness in the straight-down wake views (wake36.mjs "top").
# Per image row above the boat: the brightest pixel in the left and right arm bands (outside the central trail band)
# against the row's median. A row is an arm "gap" when that peak is under half the arm's median peak contrast.
# Reports the longest run of gap rows per arm (px, image 1280x720) and trail core vs arm peak (luminance over the median).
import sys, numpy as np
from PIL import Image
S = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c38/shots/'
for tag in sys.argv[1:]:
    for v in ['golden-sail', 'golden-rib', 'morning-rib', 'morning-sail', 'dusk-sail', 'dusk-rib', 'golden-ferry', 'morning-ferry']:
        try: a = np.asarray(Image.open(f'{S}wake36-{tag}-{v}-top.jpg').convert('L'), dtype=float)
        except FileNotFoundError: continue
        H, W = a.shape
        # boat column: brightest column mean in the bottom quarter is the hull; use image centre
        cx = W // 2
        rows = range(int(H * 0.05), int(H * 0.55))
        res = {}
        for side, sl in (('L', slice(0, cx - 30)), ('R', slice(cx + 30, W))):
            con = np.array([a[y, sl].max() - np.median(a[y]) for y in rows])
            thr = np.median(con) * 0.5; gap = con < thr
            run = best = 0
            for g in gap: run = run + 1 if g else 0; best = max(best, run)
            res[side] = (round(float(np.median(con)), 1), best)
        trail = np.median([a[y, cx - 25:cx + 25].max() - np.median(a[y]) for y in rows])
        arm = (res['L'][0] + res['R'][0]) / 2
        print(tag, v, 'arm contrast L %.1f R %.1f | longest gap L %d R %d px | trail %.1f, trail/arm %.2f' % (res['L'][0], res['R'][0], res['L'][1], res['R'][1], trail, trail / arm))
