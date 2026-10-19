# Round 37 builder: wake texture test on the straight-down wake views (wake36.mjs "top"). The arms are found per row as
# the brightest pixel in a window that follows each arm; the trail core is the centre column band behind the transom.
# Reports: longest run of rows (px) where an arm's peak falls below half way between the sea and the arm's median
# peak (a dotted gap), and core / arm brightness (median per-row max). Usage: python3 wakecheck37.py <files...>
import sys, numpy as np
from PIL import Image
for fn in sys.argv[1:]:
    a = np.asarray(Image.open(fn).convert('L'), dtype=float)
    H, W = a.shape
    # boat: the rows where the centre band is red/dark hull; arms: per row, two brightest local maxima left/right of centre
    sea = np.median(a[:, :200])
    rows = range(40, 400)
    cx = 640
    L, R, C = [], [], []
    for y in rows:
        r = a[y]
        # the trail core: +-45 px round the centre
        C.append(r[cx - 45:cx + 45].max())
        L.append(r[200:cx - 50].max()); R.append(r[cx + 50:W - 200].max())
    L, R, C = map(np.array, (L, R, C))
    def gap(p):
        thr = sea + 0.5 * (np.median(p) - sea); run = best = 0
        for v in p:
            run = run + 1 if v < thr else 0; best = max(best, run)
        return best
    arm = np.median(np.r_[L, R])
    print(fn.split('/')[-1], 'sea %.0f arm %.0f core %.0f core/arm %.2f gapL %d gapR %d' % (sea, arm, np.median(C), np.median(C) / arm, gap(L), gap(R)))
