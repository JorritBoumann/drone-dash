# Round 42 critic (new): from the canvas-only recordings (rec42c.mjs): (1) the last frame of the recording (game-over card),
# (2) a strip of frames over the first 400 ms of a centre message (the fade-in), cropped to the label box, to see that
# the label keeps its size. Usage: python3 fade42.py <RECDIR> <TAG> <OUTDIR> [event index]
import json, subprocess, sys, os
from PIL import Image
rec, tag, out = sys.argv[1], sys.argv[2], sys.argv[3]; k = int(sys.argv[4]) if len(sys.argv) > 4 else 0
S = json.load(open(f'{rec}{tag}-samples.json'))
info = S['info']; scale = info['cw'] / info['css'][0]
segs = sorted([f for f in os.listdir(rec) if f.startswith(tag + '-seg') and f.endswith('.webm')], key=lambda f: int(f.split('seg')[1].split('.')[0]))
def dur(f): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', rec + f]).decode().strip() or 0)
# the last frame of the last non-empty segment
last = segs[-1]
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-sseof', '-0.3', '-i', rec + last, '-frames:v', '1', '-q:v', '3', f'{out}rec42-{tag}-lastframe.jpg'])
print('LAST', tag, last, f'{out}rec42-{tag}-lastframe.jpg')
# event fade-in strip: segment by cumulative duration (MediaRecorder segments are back to back)
evs = S.get('evStarts', [])
if evs:
    e = evs[min(k, len(evs) - 1)]; t = e['t']; b = e['box']
    # segment start times from the recorder log (t0 per segment, recording timeline); MediaRecorder WebM has no duration
    import re
    t0s = {m.group(1): float(m.group(2)) for m in re.finditer(r'"f":"[^"]*/(%s-seg\d+\.webm)","t0":([\d.]+)' % tag, open(os.path.dirname(os.path.abspath(__file__)) + '/rec42c.log').read())}
    f = max((g for g in segs if t0s.get(g, 1e9) <= t), key=lambda g: t0s[g])
    off = t - t0s[f]
    m = 30
    x0, y0 = max(0, int((b['x'] - m) * scale)), max(0, int((b['y'] - m) * scale)); w, h = int((b['w'] + 2 * m) * scale), int((b['h'] + 2 * m) * scale)
    tiles = []
    for i, dt in enumerate([-0.1, 0.0, 0.033, 0.067, 0.1, 0.133, 0.167, 0.2, 0.3, 0.6]):
        p = f'/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c42/fade42-{tag}-{i}.png'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{max(0, off + dt):.3f}', '-i', rec + f, '-frames:v', '1', '-vf', f'crop={w}:{h}:{x0}:{y0}', p])
        if os.path.exists(p): tiles.append(Image.open(p).convert('RGB'))
    if tiles:
        W = max(t.width for t in tiles); H = sum(t.height for t in tiles)
        st = Image.new('RGB', (W, H), (0, 0, 0)); y = 0
        for tt in tiles: st.paste(tt, (0, y)); y += tt.height
        if st.width > 900: st = st.resize((900, int(st.height * 900 / st.width)))
        st.save(f'{out}rec42-{tag}-fadein-strip.jpg', quality=80)
        print('STRIP', tag, e['k'], 't', round(t, 2), 'seg', f, 'off', round(off, 2), f'{out}rec42-{tag}-fadein-strip.jpg')
