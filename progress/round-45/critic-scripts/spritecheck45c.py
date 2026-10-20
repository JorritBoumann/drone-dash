# Round 45 critic: does every segment of public/assets/audio/sfx.mp3 match the Kenney file ASSETS.md names for it?
# Decode both at 48 kHz mono, take the sprite segment and the claimed source part, and report the peak normalised
# cross-correlation of their envelopes and waveforms (1.0 = identical shape; >0.8 = same sound after trim and gain).
import subprocess, json, re, numpy as np, sys
SR = 48000
def dec(path, ss=None, to=None):
    a = ['ffmpeg', '-v', 'error']
    if ss is not None: a += ['-ss', str(ss)]
    if to is not None: a += ['-to', str(to)]
    a += ['-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(a, capture_output=True, check=True).stdout, dtype=np.float32).astype(np.float64)
spr = dec('public/assets/audio/sfx.mp3')
txt = open('src/systems/sfxSprite.ts').read()
SP = json.loads('{' + txt.split('= {', 1)[1].rsplit('};', 1)[0] + '}')
# decoder delay from the sync click at 0.05 s
at = int(np.argmax(np.abs(spr[:int(0.3 * SR)]) > 0.1)); delay = at / SR - 0.05
K = 'asset-src/kenney-audio/'
src = {
 'crunch': (K + 'kenney_sci-fi-sounds/Audio/explosionCrunch_000.ogg',), 'plate': (K + 'kenney_impact-sounds/Audio/impactPlate_heavy_000.ogg',),
 'knock0': (K + 'kenney_impact-sounds/Audio/impactMetal_medium_000.ogg',), 'knock1': (K + 'kenney_impact-sounds/Audio/impactMetal_medium_001.ogg',), 'knock2': (K + 'kenney_impact-sounds/Audio/impactMetal_medium_003.ogg',),
 'scrape0': (K + 'kenney_impact-sounds/Audio/impactMetal_light_000.ogg',), 'scrape1': (K + 'kenney_impact-sounds/Audio/impactMetal_light_001.ogg',), 'scrape2': (K + 'kenney_impact-sounds/Audio/impactMetal_light_003.ogg',),
 'grit0': (K + 'kenney_interface-sounds/Audio/scratch_004.ogg',), 'grit1': (K + 'kenney_interface-sounds/Audio/scratch_001.ogg',),
 'ignite': (K + 'kenney_sci-fi-sounds/Audio/thrusterFire_004.ogg', 1.15, 1.65), 'thrust': (K + 'kenney_sci-fi-sounds/Audio/thrusterFire_002.ogg', 1.3, 4.0),
 'latch': (K + 'kenney_ui-audio/Audio/switch12.ogg',), 'clunk': (K + 'kenney_impact-sounds/Audio/impactTin_medium_000.ogg',), 'unlatch': (K + 'kenney_ui-audio/Audio/switch14.ogg',),
 'thud': (K + 'kenney_impact-sounds/Audio/impactSoft_medium_001.ogg',), 'box': (K + 'kenney_impact-sounds/Audio/impactWood_light_000.ogg',),
 'tick0': (K + 'kenney_interface-sounds/Audio/tick_002.ogg',), 'tick1': (K + 'kenney_interface-sounds/Audio/tick_001.ogg',),
 'select': (K + 'kenney_interface-sounds/Audio/select_001.ogg',), 'back': (K + 'kenney_interface-sounds/Audio/back_001.ogg',), 'toggle': (K + 'kenney_interface-sounds/Audio/toggle_002.ogg',),
 'error': (K + 'kenney_interface-sounds/Audio/error_004.ogg',), 'cityLow': (K + 'kenney_sci-fi-sounds/Audio/spaceEngineLow_001.ogg', 1.6, 4.9),
}
def env(x, w=96):
    e = np.sqrt(np.convolve(x * x, np.ones(w) / w, mode='same')); return e
def ncc(a, b):
    # best normalised cross-correlation of b inside a (with 30 ms of slack either side)
    n = len(b); best = 0
    for s in range(0, max(1, len(a) - n + 1), 24):
        seg = a[s:s + n]
        if len(seg) < n: break
        c = np.dot(seg - seg.mean(), b - b.mean()) / (np.linalg.norm(seg - seg.mean()) * np.linalg.norm(b - b.mean()) + 1e-12)
        best = max(best, c)
    return best
rows = []; ok = True
for name, s in SP.items():
    a0 = int((s['o'] + delay - 0.03) * SR); a1 = int((s['o'] + delay + s['d'] + 0.03) * SR)
    seg = spr[a0:a1]
    path, *part = src[name]
    x = dec(path, *(part if part else [None, None]))
    L = min(len(x), int(s['d'] * SR)) if not s['loop'] else int(min(1.0, s['d'] - 0.35) * SR)
    probe = x[int(0.002 * SR):int(0.002 * SR) + L] if not s['loop'] else x[int(0.35 * SR):int(0.35 * SR) + L]
    w = ncc(seg, probe); e = ncc(env(seg), env(probe))
    pk = 20 * np.log10(np.max(np.abs(seg)) + 1e-12)
    rows.append((name, path.split('/')[-1], round(float(w), 3), round(float(e), 3), round(pk, 1)))
    if e < 0.8: ok = False
print('decoder delay ms', round(delay * 1000, 1))
for r in rows: print('%-8s %-28s wave %.3f env %.3f peak %5.1f dBFS' % r)
print('ALL MATCH' if ok else 'SOME DO NOT MATCH')
