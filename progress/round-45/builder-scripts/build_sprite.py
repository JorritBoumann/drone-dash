# Round 45 audio builder: cut the CC0 Kenney picks into one mono sound sprite (public/assets/audio/sfx.mp3) and write the
# offset table (src/systems/sfxSprite.ts). Every pick is decoded with ffmpeg, trimmed, peak-normalised, faded at both
# ends (no clicks), and placed after a 0.12 s gap. Loops get a baked equal-power crossfade so loopStart..loopEnd is
# seamless. A 2 ms sync click at 0.05 s lets the game measure the decoder's start delay (MP3 priming differs by browser).
# It also prints a short envelope / spectrum summary per pick (the "listening" pass).
# usage: python3 -I build_sprite.py <project root>
import sys, subprocess, json, os
import numpy as np
root = sys.argv[1]
K = root + '/asset-src/kenney-audio/'
SR = 48000
# name, file, start s, length s (None = all), target peak dBFS, loop
PICKS = [
    ('crunch', 'kenney_sci-fi-sounds/Audio/explosionCrunch_000.ogg', 0, None, -1.5, False),
    ('plate', 'kenney_impact-sounds/Audio/impactPlate_heavy_000.ogg', 0, None, -1.5, False),
    ('knock0', 'kenney_impact-sounds/Audio/impactMetal_medium_000.ogg', 0, None, -3, False),
    ('knock1', 'kenney_impact-sounds/Audio/impactMetal_medium_001.ogg', 0, None, -3, False),
    ('knock2', 'kenney_impact-sounds/Audio/impactMetal_medium_003.ogg', 0, None, -3, False),
    ('scrape0', 'kenney_impact-sounds/Audio/impactMetal_light_000.ogg', 0, None, -3, False),
    ('scrape1', 'kenney_impact-sounds/Audio/impactMetal_light_001.ogg', 0, None, -3, False),
    ('scrape2', 'kenney_impact-sounds/Audio/impactMetal_light_003.ogg', 0, None, -3, False),
    ('grit0', 'kenney_interface-sounds/Audio/scratch_004.ogg', 0, None, -3, False),
    ('grit1', 'kenney_interface-sounds/Audio/scratch_001.ogg', 0, None, -3, False),
    ('ignite', 'kenney_sci-fi-sounds/Audio/thrusterFire_004.ogg', 1.15, 0.5, -3, False),
    ('thrust', 'kenney_sci-fi-sounds/Audio/thrusterFire_002.ogg', 1.3, 2.4, -3, True),
    ('latch', 'kenney_ui-audio/Audio/switch12.ogg', 0, None, -3, False),
    ('clunk', 'kenney_impact-sounds/Audio/impactTin_medium_000.ogg', 0, None, -3, False),
    ('unlatch', 'kenney_ui-audio/Audio/switch14.ogg', 0, None, -3, False),
    ('thud', 'kenney_impact-sounds/Audio/impactSoft_medium_001.ogg', 0, None, -3, False),
    ('box', 'kenney_impact-sounds/Audio/impactWood_light_000.ogg', 0, None, -3, False),
    ('tick0', 'kenney_interface-sounds/Audio/tick_002.ogg', 0, None, -3, False),
    ('tick1', 'kenney_interface-sounds/Audio/tick_001.ogg', 0, None, -3, False),
    ('select', 'kenney_interface-sounds/Audio/select_001.ogg', 0, None, -3, False),
    ('back', 'kenney_interface-sounds/Audio/back_001.ogg', 0, None, -3, False),
    ('toggle', 'kenney_interface-sounds/Audio/toggle_002.ogg', 0, None, -3, False),
    ('error', 'kenney_interface-sounds/Audio/error_004.ogg', 0, None, -3, False),
    ('cityLow', 'kenney_sci-fi-sounds/Audio/spaceEngineLow_001.ogg', 1.6, 3.0, -3, True),
]
GAP = 0.12
XF = 0.3  # loop crossfade (s)

def decode(path):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).astype(np.float64)

def summary(x):
    env = np.sqrt(np.convolve(x * x, np.ones(240) / 240, mode='same'))
    pk = np.argmax(env); thr = env[pk] * 10 ** (-30 / 20)
    tail = np.where(env[pk:] < thr)[0]; dec = (tail[0] / SR * 1000) if len(tail) else len(x) / SR * 1000
    X = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2; f = np.fft.rfftfreq(len(x), 1 / SR); t = X.sum() + 1e-20
    b = lambda a, c: X[(f >= a) & (f < c)].sum() / t * 100
    cent = (X * f).sum() / t
    return f'dur {len(x)/SR:.2f}s attack {pk/SR*1000:.0f}ms decay-30dB {dec:.0f}ms centroid {cent:.0f}Hz <100 {b(0,100):.0f}% 100-3k {b(100,3000):.0f}% 3-8k {b(3000,8000):.0f}% >8k {b(8000,24000):.1f}%'

out = [np.zeros(int(0.05 * SR))]
click = np.zeros(int(0.002 * SR)); click[:] = 0.5 * np.hanning(len(click))
out.append(click); out.append(np.zeros(int(0.1 * SR)))
pos = sum(len(a) for a in out)
table = {}
for name, f, start, length, peak_db, loop in PICKS:
    x = decode(K + f)
    a = int(start * SR); x = x[a:] if length is None else x[a:a + int((length + (XF if loop else 0)) * SR)]
    # trim trailing silence (-60 dB)
    if not loop:
        nz = np.where(np.abs(x) > 10 ** (-60 / 20) * np.max(np.abs(x)))[0]
        x = x[:nz[-1] + 1] if len(nz) else x
    if loop:
        n = int(XF * SR); body = x[:-n].copy(); tailx = x[-n:]
        r = np.linspace(0, np.pi / 2, n)
        body[:n] = body[:n] * np.sin(r) + tailx * np.cos(r)  # the loop end flows into its start
        x = body
    x = x - np.mean(x)
    fi = int(0.002 * SR) if not loop else 0
    fo = int(min(0.02, len(x) / SR * 0.2) * SR) if not loop else 0
    if fi: x[:fi] *= np.linspace(0, 1, fi)
    if fo: x[-fo:] *= np.linspace(1, 0, fo)
    x *= 10 ** (peak_db / 20) / (np.max(np.abs(x)) + 1e-12)
    print(f'{name:8} {f.split("/")[-1]:28} {summary(x)}')
    table[name] = dict(o=round(pos / SR, 5), d=round(len(x) / SR, 5), loop=loop)
    out.append(x); pos += len(x)
    g = np.zeros(int(GAP * SR)); out.append(g); pos += len(g)
y = np.concatenate(out).astype(np.float32)
os.makedirs(root + '/public/assets/audio', exist_ok=True)
wav = os.environ.get('SCRATCH', '/tmp') + '/sfx-sprite.wav'
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'pcm_s16le', wav], input=y.tobytes(), check=True)
mp3 = root + '/public/assets/audio/sfx.mp3'
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '96k', '-ac', '1', '-ar', str(SR), mp3], check=True)
print('sprite', round(len(y) / SR, 2), 's', os.path.getsize(mp3), 'bytes')
ts = ['// Generated by progress/round-45/builder-scripts/build_sprite.py. CC0 Kenney samples, see ASSETS.md.',
      '/** Sound sprite: offset and length (s) of every sample in public/assets/audio/sfx.mp3; `loop` = seamless loop body. */',
      'export const SPRITE_SYNC = 0.05; // the 2 ms sync click: the decoder delay is measured against it',
      'export const SPRITE: Record<string, { o: number; d: number; loop: boolean }> = ' + json.dumps(table, indent=2).replace('true', 'true').replace('false', 'false') + ';', '']
open(root + '/src/systems/sfxSprite.ts', 'w').write('\n'.join(ts))
