# Round 47 builder: is a detected click on a capture block boundary (the recorder's 4096-sample ScriptProcessor blocks)?
# A dropped block shows as a jump in every live bus at a multiple of 4096 samples from the capture start.
# usage: python3 blockcheck47.py <rawdir> <track> <clip-prefix> <clip time s> [...]
import sys, json
import numpy as np
raw, track = sys.argv[1], sys.argv[2]; args = sys.argv[3:]
sys.argv = [sys.argv[0], raw, track]
exec(open('measure47.py').read().split('out = {')[0])
M = json.load(open(f'../builder-audio/{track}/audio-measurements.json'))['clips']
for k in range(0, len(args), 2):
    pre, tt = args[k], float(args[k + 1])
    name = next(n for n in M if n.startswith(pre)); off = 0
    for sg in M[name]['segments']:
        if sg['at_clip_s'] <= tt: seg = sg
    tag = {'main': 'main-s22', 'fx': 'fx-s22', 'ot': 'ot-s22'}[seg['session']]
    S = load(tag); a = idx(S, seg['start_ct']) + int((tt - seg['at_clip_s']) * S['sr'])
    x = S['ch']['music']; w = int(0.004 * S['sr']); d2 = np.abs(np.diff(x[a - w:a + w], 2)); i = a - w + int(np.argmax(d2)) + 1
    print(name[:2], tt, 'sample', i, 'mod 4096 =', i % 4096, '| music', np.round(x[i - 2:i + 2], 4), '| L', np.round(S['ch']['L'][i - 2:i + 2], 4))
