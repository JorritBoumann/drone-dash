# Round 34 critic: from boattrace33 TRACE lines, the largest single-frame move beyond the drone's own speed:
# (effective speed from the position change - drone speed) / 60 Hz, in metres. Pass: at most 0.15 m.
import sys, json
for fn in sys.argv[1:]:
    for line in open(fn):
        if not line.startswith('TRACE') or ' [' not in line: continue
        i = line.index(' ['); p = line[:i].split(' '); tr = json.loads(line[i+1:])
        if not tr: print(fn.split('/')[-1], p[1], p[2], 'no contact'); continue
        ex = [(r[0], round((r[2] - r[1]) / 60, 3)) for r in tr]
        worst = max(ex, key=lambda e: e[1])
        print(fn.split('/')[-1], p[1], p[2], 'y', p[3], 'boat', p[5], 'peakV', p[7], '| worst excess step %.3f m at frame %d' % (worst[1], worst[0]), '| frames over 0.15 m:', sum(1 for e in ex if e[1] > 0.15), '| max v', max(r[1] for r in tr))
