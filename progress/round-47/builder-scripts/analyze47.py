# Round 47 builder: copy of round 46 analyze46b.py (same clip plan and measures; writes WAV + MP3). usage: python3 analyze47.py <rawdir> <outdir> <track>
# Round 46 audio BUILDER: copy of round 45's analyze45b.py (same clip plan and measures), run once per soundtrack; for
# Breakbeat it also cuts 11-breakbeat-90s-continuous. usage: python3 analyze46b.py <rawdir> <outdir> <track>
# Round 45 audio BUILDER (copy of the critic's analyze45.py; adds the ambience bus channel and per-clip <100 Hz / >8 kHz bands): cut the clips from the rec45b.mjs captures, write WAV (48 kHz stereo 24-bit) and MP3 (192 kbps),
# measure them and write the per-clip timelines.
# usage: python3 analyze45.py <rawdir> <outdir>
# Channels: L, R = master output (after limiter + trim). music = music bus after the duck. sfx = cue bus (dry).
# bed = rotor + wind + slipstream air (summed). rev = reverb return. The buses are before the master gain (x3.1),
# the glue compressor, the limiter and the trim (x0.8), so they are compared with each other, not with the master.
import sys, json, subprocess, os
import numpy as np
raw, outdir = sys.argv[1], sys.argv[2]
TRACK = sys.argv[3] if len(sys.argv) > 3 else 'classic'
os.makedirs(outdir, exist_ok=True)
NAMES = ['L', 'R', 'music', 'sfx', 'bed', 'amb', 'rev']

def load(tag):
    tl = json.load(open(f'{raw}/{tag}-timeline.json'))
    ch = {n: np.fromfile(f'{raw}/{tag}-{n}.f32', dtype=np.float32).astype(np.float64) for n in NAMES}
    sr, t0, calT = tl['sr'], tl['t0'], tl['calT']
    # capture latency from the calibration burst (into the master tap only)
    n = round(sr * 0.01); x = 12345.0; burst = np.zeros(n)
    for i in range(n):
        x = (x * 1103515245.0 + 12345.0) % 2147483648.0
        burst[i] = (x / 2147483648.0 * 2 - 1) * 0.6
    e = int((calT - t0) * sr); a = max(0, e - int(0.3 * sr)); b = e + int(0.6 * sr)
    c = np.correlate(ch['L'][a:b], burst, mode='valid'); i = int(np.argmax(c))
    off = (t0 + (a + i) / sr) - calT
    return dict(tag=tag, tl=tl, ch=ch, sr=sr, t0=t0, off=off, match=float(c[i] / np.dot(burst, burst)), calT=calT)

def idx(S, ct):
    return int(round((ct - S['t0'] + S['off']) * S['sr']))

def events(S):
    """Game events from the 25 Hz diagnostics log, at audio-clock time (ducked cues use the duck's own exact time)."""
    EV = S['tl']['EV']; out = []; prev = None; lastDuckAt = None
    for e in EV:
        ct = e['ct']
        ld = e.get('lastDuck')
        if ld and ld['at'] != lastDuckAt:
            lastDuckAt = ld['at']; out.append((ld['at'], 'duck:' + ld['reason'], f"music ducked to {ld['depth']}"))
        if prev and prev['state'] == 'playing':
            if e['pay'] is not None and prev['pay'] is not None and e['pay'] > prev['pay']: out.append((ct, 'payout', f"slipstream payout, chain x{e['chain']}"))
            if e['chain'] is not None and prev['chain'] is not None and e['chain'] < prev['chain']: out.append((ct, 'chain-reset', f"chain x{prev['chain']} -> x{e['chain']}"))
            if prev['phase'] == 'pickup' and e['phase'] == 'deliver': out.append((ct, 'pickup', 'parcel picked up'))
            if e['del'] > prev['del']: out.append((ct, 'delivery', f"delivery {e['del']} (score {e['score']})"))
            if e['passes'] > prev['passes']: out.append((ct, 'medal', f"medal tier {e['tier']}"))
            if e.get('px', 0) > prev.get('px', 0): out.append((ct, 'passby' if e.get('pn', 0) < 0.6 else 'passby-close', f"Doppler pass-by (closeness {e.get('pn', 0)})"))
            if e['crashes'] > prev['crashes']: out.append((ct, 'crash', 'crash charged (time penalty)'))
            if e['impacts'] > prev['impacts']: out.append((ct, 'impact', 'head-on impact (hit-stop + slow motion)'))
            if e['scrapes'] > prev['scrapes']: out.append((ct, 'scrape', 'wall scrape'))
            if e['light'] > prev['light']: out.append((ct, 'light-hit', 'hard knock, not a crash'))
            if e['boosting'] and not prev['boosting']: out.append((ct, 'boost-on', 'boost on'))
            if prev['boosting'] and not e['boosting']: out.append((ct, 'boost-off', 'boost off'))
            if e['rush'] and not prev['rush']: out.append((ct, 'rush', 'rush hour starts'))
            if e['rushOrders'] > prev['rushOrders']: out.append((ct, 'rush-order', 'rush order'))
            if e['ot'] and not prev['ot']: out.append((ct, 'overtime', 'overtime starts'))
            if e['tl'] <= 10 and np.ceil(e['tl']) != np.ceil(prev['tl']) and e['tl'] > 0 and prev['tl'] > e['tl']: out.append((ct, 'tick', f"clock tick {int(np.ceil(e['tl']))} s"))
        if prev and (e['track'], e['section'], e['layer']) != (prev['track'], prev['section'], prev['layer']):
            out.append((ct, 'music', f"music {e['track']}/{e['section']} layer {e['layer']}"))
        if prev and prev['state'] == 'playing' and e.get('chord') and e.get('chord') != prev.get('chord'):
            pass
        if prev and e['state'] != prev['state']: out.append((ct, 'state', f"state {prev['state']} -> {e['state']}"))
        prev = e
    for m in S['tl']['marks']: out.append((m['ct'], 'mark', m['label']))
    return sorted(out, key=lambda r: r[0])

def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x * x)) + 1e-12)

def ebur(stereo, sr):
    """ffmpeg ebur128: integrated, LRA, true peak, short-term (3 s) range from the per-frame log."""
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-v', 'verbose', '-f', 'f32le', '-ar', str(sr), '-ac', '2', '-i', '-', '-af', 'ebur128=peak=true:framelog=verbose', '-f', 'null', '-'], input=stereo.astype(np.float32).tobytes(), capture_output=True)
    txt = p.stderr.decode(); S = []
    for line in txt.splitlines():
        if ' S:' in line and 'TARGET' in line:
            try: S.append(float(line.split(' S:')[1].split()[0]))
            except ValueError: pass
    summ = txt[txt.rfind('Summary:'):]
    def g(k):
        try: return float(summ.split(k)[1].split()[0])
        except Exception: return None
    St = [s for s in S[30:] if s > -70]
    return dict(I=g('I:'), LRA=g('LRA:'), TP=g('Peak:'), Smin=round(min(St), 1) if St else None, Smax=round(max(St), 1) if St else None)

def bands(x, sr):
    X = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2; f = np.fft.rfftfreq(len(x), 1 / sr); t = X.sum() + 1e-20
    b = lambda a, c: round(float(X[(f >= a) & (f < c)].sum() / t * 100), 1)
    return {'<100': b(0, 100), '<150': b(0, 150), '150-3k': b(150, 3000), '3k-6k': b(3000, 6000), '>3k': b(3000, sr / 2), '>6k': b(6000, sr / 2), '>8k': b(8000, sr / 2)}

def clicks(x, sr):
    """Step clicks: a second difference over 8x its local RMS (5 ms, centre left out) and over 0.01 (full scale 1)."""
    d2 = np.abs(np.diff(x, 2)); w = int(sr * 0.005)
    k = np.ones(2 * w + 1); k[w - 1:w + 2] = 0; k /= k.sum()
    loc = np.sqrt(np.convolve(d2 * d2, k, mode='same')) + 1e-9
    hits = np.where((d2 > 8 * loc) & (d2 > 0.01))[0]
    if len(hits) == 0: return []
    keep = [hits[0]]
    for h in hits[1:]:
        if h - keep[-1] > sr * 0.02: keep.append(h)
    return [round(h / sr, 3) for h in keep]

def win_db(x, sr, a, b):
    a = max(0, int(a * sr)); b = min(len(x), int(b * sr))
    return rms_db(x[a:b]) if b > a else None

def repetition(m, sr, bar=1.92):
    """Music bus: mean cosine similarity of the magnitude spectrogram (one frame per 16th) at whole-bar lags."""
    hop = int(sr * 0.12); nf = 4096; fr = []
    for i in range(0, len(m) - nf, hop):
        s = np.abs(np.fft.rfft(m[i:i + nf] * np.hanning(nf)))[:700]; fr.append(np.log1p(s * 50))
    F = np.array(fr); F = F - F.mean(1, keepdims=True); F /= np.linalg.norm(F, axis=1, keepdims=True) + 1e-9
    res = []
    for k in range(1, int(len(F) * 0.12 / bar) - 2):
        L = int(round(k * bar / 0.12))
        if len(F) - L < 40: break
        sim = float(np.mean(np.sum(F[:-L] * F[L:], 1)))
        res.append((k, round(k * bar, 2), round(sim, 3)))
    return res

S_main = load('main-s22'); S_fx = load('fx-s22'); S_ot = load('ot-s22')
E_main = events(S_main); E_fx = events(S_fx); E_ot = events(S_ot)
def first(E, kind, after=-1e9, before=1e9):
    return next((r for r in E if r[1] == kind and after <= r[0] <= before), None)
def mark(S, label):
    return next(m['ct'] for m in S['tl']['marks'] if m['label'].startswith(label))

# ---------- clip plan (start ct, length) per source; a list of segments joins with a 0.3 s crossfade ----------
enter = mark(S_main, 'enter'); runEnd = mark(S_main, 'run-end')
pays = [r for r in E_main if r[1] == 'duck:slip']
# clip 03: the 25 s window with the most audible payouts whose chain reaches x3+
best = None
EVm = S_main['tl']['EV']
for r in pays:
    a = r[0] - 4; b = a + 25
    if any(e['tl'] is not None and e['tl'] < 12 for e in EVm if a <= e['ct'] <= b and e['state'] == 'playing'): continue
    n = sum(1 for q in pays if a <= q[0] <= b); mx = max([e['chain'] or 0 for e in EVm if a <= e['ct'] <= b] or [0])
    sc = n + (100 if mx >= 3 else 0)
    if not best or sc > best[0]: best = (sc, a, n, mx)
boosts = [r for r in E_main if r[1] == 'boost-on']
def boost_len(r):
    off = first(E_main, 'boost-off', r[0]); return (off[0] if off else r[0]) - r[0]
bst = max(boosts, key=boost_len) if boosts else None
medal = first(E_main, 'duck:medal') or first(E_main, 'medal')
pick_before = [r for r in E_main if r[1] == 'duck:pickup' and medal and r[0] < medal[0]]
rush = first(E_main, 'duck:rush') or first(E_main, 'rush')
final = first(E_main, 'music', enter + 20, runEnd) if False else next((r for r in E_main if r[1] == 'music' and '/final' in r[2]), None)
plan = {}
plan['01-title-music'] = ('main', [(S_main['calT'] + 0.1, 20)])
plan['02-takeoff-calm-flight-chain0'] = ('main', [(enter - 0.5, 20)])
if best: plan['03-slipstream-chain-x3-payouts'] = ('main', [(best[1], 25)])
if bst: plan['04-boost-and-tail-off'] = ('main', [(bst[0] - 2, 10)])
sc = mark(S_fx, 'scrape-setup'); plan['05-wall-scrape-and-head-on-crash'] = ('fx', [(sc - 0.8, 10)])
if medal:
    a = medal[0] - 11
    if pick_before and medal[0] - pick_before[-1][0] < 30:
        p = pick_before[-1][0]
        plan['06-pickup-delivery-medal'] = ('main', [(p - 1.5, 5), (medal[0] - 6, 10)]) if medal[0] - p > 13 else ('main', [(p - 1.5, max(15, medal[0] + 4 - p + 1.5))])
    else: plan['06-pickup-delivery-medal'] = ('main', [(a, 15)])
# clip 07: rush hour from the main run, then the last 10 s into overtime from the short-clock run (MODE=ot)
fin_ot = next(r for r in E_ot if r[1] == 'music' and '/final' in r[2]); end_ot = mark(S_ot, 'run-end')
plan['07-rush-hour-then-last-10s-into-overtime'] = ('mix', [('main', rush[0] - 3, 8), ('ot', fin_ot[0] - 1.5, end_ot - fin_ot[0] + 1.5 + 3.5)])
hb = mark(S_fx, 'harbour-start'); st = mark(S_fx, 'street-start')
plan['08-harbour-boats-bus-then-street-people-traffic'] = ('fx', [(hb + 1.0, 12), (st + 0.3, 10)])
plan['09-game-over-sting-and-loop'] = ('main', [(runEnd - 1.0, 21)])
plan['10-full-run-60s-unedited'] = ('main', [(enter - 0.5, 60)])
if TRACK == 'breakbeat': plan['11-breakbeat-90s-continuous'] = ('main', [(enter - 0.5, 90)])

SRC = {'main': (S_main, E_main), 'fx': (S_fx, E_fx), 'ot': (S_ot, E_ot)}
report = {'latency': {k: dict(ms=round(v[0]['off'] * 1000, 2), match=round(v[0]['match'], 3)) for k, v in SRC.items()}, 'clips': {}}
timeline_txt = []
for name, (src, segs) in plan.items():
    sr = 48000; parts = []; tparts = []; offset = 0.0
    segs = [((src,) + sg if len(sg) == 2 else sg) for sg in segs]
    for (sname, ct, L) in segs:
        S, E = SRC[sname]
        a, b = idx(S, ct), idx(S, ct + L)
        parts.append({n: S['ch'][n][a:b].copy() for n in NAMES}); tparts.append((ct, L, offset, sname)); offset += L - 0.3  # the 0.3 s crossfade overlaps the next segment
    # join with a 0.3 s crossfade
    xf = int(0.3 * sr); clip = parts[0]
    for p in parts[1:]:
        r = np.linspace(0, 1, xf)
        clip = {n: np.concatenate([clip[n][:-xf], clip[n][-xf:] * (1 - r) + p[n][:xf] * r, p[n][xf:]]) for n in NAMES}
    st = np.stack([clip['L'], clip['R']], 1)
    # files: WAV 48 kHz stereo 24-bit and MP3 192 kbps
    wav = f'{outdir}/{name}.wav'; mp3 = f'{outdir}/{name}.mp3'
    for args in (['-c:a', 'pcm_s24le', wav], ['-c:a', 'libmp3lame', '-b:a', '192k', mp3]):
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'f32le', '-ar', str(sr), '-ac', '2', '-i', '-'] + args, input=st.astype(np.float32).tobytes(), check=True)
    mono = (clip['L'] + clip['R']) / 2
    M = dict(src=src, segments=[dict(session=sn, start_ct=round(c, 2), len=L, at_clip_s=round(o, 2)) for c, L, o, sn in tparts], seconds=round(len(mono) / sr, 2))
    M['loudness'] = ebur(st, sr)
    M['sample_peak_dbfs'] = round(20 * np.log10(np.max(np.abs(st)) + 1e-12), 2)
    M['clipped_samples'] = int(np.sum(np.abs(st) >= 0.999))
    M['bands_pct'] = bands(mono, sr)
    M['bus_db'] = {n: round(rms_db(clip[n]), 1) for n in ['music', 'sfx', 'bed', 'amb', 'rev']}
    ck = clicks(mono, sr); M['clicks_master'] = dict(n=len(ck), per_min=round(len(ck) / (len(mono) / sr) * 60, 1), at=ck[:12])
    ckm = clicks(clip['music'], sr); M['clicks_music_bus'] = dict(n=len(ckm), at=ckm[:12])
    # events inside the clip, with per-cue levels: cue bus vs music bus in the cue window, and the music duck
    evs = []
    for (ct, L, o, sn) in tparts:
        E = SRC[sn][1]
        for (t, kind, desc) in E:
            if ct <= t < ct + L:
                rel = t - ct + o; row = dict(t=round(rel, 2), kind=kind, desc=desc)
                if kind.startswith('duck:') or kind in ('scrape', 'light-hit', 'boost-on', 'tick', 'payout', 'pickup', 'delivery', 'impact', 'rush-order'):
                    w0, wl = (rel, 0.5) if kind.startswith('duck:') else (rel - 0.1, 0.3)
                    c_db = win_db(clip['sfx'], sr, w0, w0 + wl); m_db = win_db(clip['music'], sr, w0, w0 + wl)
                    if c_db is not None and c_db < -100: row['desc'] += ' (no cue sound)'
                    m_pre = win_db(clip['music'], sr, rel - 1.0, rel - 0.05); bed_db = win_db(clip['bed'], sr, rel - 1.0, rel - 0.05)
                    if c_db is not None and m_db is not None:
                        row.update(cue_db=round(c_db, 1), music_in_win_db=round(m_db, 1), cue_over_music=round(c_db - m_db, 1))
                    if m_pre is not None and m_db is not None and kind.startswith('duck:'):
                        row['duck_measured_db'] = round(m_db - m_pre, 1)
                    if c_db is not None and bed_db is not None: row['cue_over_bed'] = round(c_db - bed_db, 1)
                evs.append(row)
    M['events'] = sorted(evs, key=lambda r: r['t'])
    if name.startswith('01') or name.startswith('10') or name.startswith('09') or name.startswith('11'):
        # round 46: whole-bar lags of the soundtrack that plays (Classic 1.92 s, Breakbeat 1.43 s)
        rep = repetition(clip['music'], sr, 1.92 if TRACK == 'classic' else 60 / 168 * 4); M['repetition_top'] = sorted(rep, key=lambda r: -r[2])[:5]
        if name.startswith('11'): M['repetition_all'] = rep
    report['clips'][name] = M
    timeline_txt.append(f'\n== {name}  ({M["seconds"]} s, from the {src} session; segments: ' + ', '.join(f'clip {o:.1f} s = {sn} session audio clock {c:.2f} s for {L:.1f} s' for c, L, o, sn in tparts) + ')')
    for r in M['events']:
        extra = ''
        if 'cue_over_music' in r: extra = f"   [cue {r['cue_over_music']:+.1f} dB vs music" + (f", duck {r['duck_measured_db']:+.1f} dB" if 'duck_measured_db' in r else '') + (f", cue {r['cue_over_bed']:+.1f} dB vs rotor+wind" if 'cue_over_bed' in r else '') + ']'
        timeline_txt.append(f"{r['t']:7.2f} s  {r['kind']:<14} {r['desc']}{extra}")
    print(name, M['seconds'], M['loudness'], M['bands_pct'], 'clicks', M['clicks_master']['n'])

# whole-session numbers: the run part of the main session and the fx session
for k, (S, E) in SRC.items():
    sr = S['sr']; ch = S['ch']
    report.setdefault('session', {})[k] = {n: round(rms_db(ch[n][int(S['sr'] * 2):]), 1) for n in ['music', 'sfx', 'bed', 'amb', 'rev']}
json.dump(report, open(f'{outdir}/audio-measurements.json', 'w'), indent=1)
open(f'{outdir}/timelines-raw.txt', 'w').write('\n'.join(timeline_txt) + '\n')
print('latency', report['latency'])
