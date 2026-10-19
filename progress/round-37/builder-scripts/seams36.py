# Round 36 copy: the probe paints its own in-browser leaks green in -M frames, so green counts as sea here too (round 35 missed them).
# Round 35 critic: water through gaps inside a hull, offline, from the probe's magenta frames (caps on = -M, caps off =
# -M0). Writes 0/1 magenta masks; seams35.mjs labels them. A leak is an enclosed (not touching the frame border) magenta
# component in the caps-on frame whose pixels belong to a component at least 3x larger in the caps-off frame: water the
# cap should have covered (seams under thwarts, gaps the lid misses). Water seen between pier posts or over a far
# gunwale is the same with and without caps and is not counted.
import sys, glob, os, numpy as np
from PIL import Image
S = sys.argv[1]; D = sys.argv[2]
for f in sorted(glob.glob(S + 'hw35-*-M.jpg')):
    g = f[:-6] + '-M0.jpg'
    if not os.path.exists(g): continue
    for src, suf in ((f, 'M'), (g, 'M0')):
        x = np.asarray(Image.open(src).convert('RGB')).astype(int)
        m = (((x[:, :, 0] > 110) & (x[:, :, 2] > 110) & (x[:, :, 1] < 60)) | ((x[:, :, 1] > 180) & (x[:, :, 0] < 70) & (x[:, :, 2] < 70))).astype(np.uint8)
        h, w = m.shape
        with open(D + os.path.basename(f[:-6]) + '.' + suf, 'wb') as o: o.write(np.array([w, h], dtype=np.int32).tobytes()); o.write(m.tobytes())
