# Round 45 critic (after the audio round): cut the ten clips from my own rec45c.mjs captures, write WAV + MP3 and a
# timeline, and measure them. The same metrics run on the baseline captures (scratchpad a45/raw, 6 channels) so the
# before / after numbers come from one code path.
# usage: python3 analyze45c.py <rawdir_after> <rawdir_before> <outdir>
# After channels: L, R (master after limiter + trim), music bus, effects bus, drone bus (rotor, air, slipstream, boost
# burner; after its duck), ambience bus (after its duck), effects return (reverb + slapback + ping-pong).
# Before channels: L, R, music, sfx, bed (rotor + wind + draft), rev (reverb return).
import sys, json, subprocess, os
import numpy as np
RAW_A, RAW_B, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
NA = ['L', 'R', 'music', 'sfx', 'bed', 'amb', 'rev']
NB = ['L', 'R', 'music', 'sfx', 'bed', 'rev']

def load(raw, tag, names):
    tl = json.load(open(f'{raw}/{tag}-timeline.json'))
    ch = {n: np.fromfile(f'{raw}/{tag}-{n}.f32', dtype=np.float32).astype(np.float64) for n in names}
    if 'amb' not in ch: ch['amb'] = np.zeros_like(ch['L'])
    sr, t0, calT = tl['sr'], tl['t0'], tl['calT']
    n = round(sr * 0.01); x = 12345.0; burst = np.zeros(n)
    for i in range(n):
        x = (x * 1103515245.0 + 12345.0) % 2147483648.0
        burst[i] = (x / 2147483648.0 * 2 - 1) * 0.6
    e = int((calT - t0) * sr); a = max(0, e - int(0.3 * sr)); b = e + int(0.6 * sr)
    c = np.correlate(ch['L'][a:b], burst, mode='valid'); i = int(np.argmax(c))
    off = (t0 + (a + i) / sr) - calT
    return dict(tag=tag, tl=tl, ch=ch, sr=sr, t0=t0, off=off, match=float(c[i] / np.dot(burst, burst)), calT=calT)

def idx(S, ct): return int(round((ct - S['t0'] + S['off']) * S['sr']))

def events(S):
    EV = S['tl']['EV']; out = []; prev = None; lastDuckAt = None
    for e in EV:
        ct = e['ct']; ld = e.get('lastDuck')
        if ld and ld['at'] != lastDuckAt:
            lastDuckAt = ld['at']; out.append((ld['at'], 'duck:' + ld['reason'], f"music ducked to {ld['depth']}"))
        if prev and prev['state'] == 'playing':
            if e['pay'] is not None and prev['pay'] is not None and e['pay'] > prev['pay']: out.append((ct, 'payout', f"slipstream payout, chain x{e['chain']}"))
            if e['chain'] is not None and prev['chain'] is not None and e['chain'] < prev['chain']: out.append((ct, 'chain-reset', f"chain x{prev['chain']} -> x{e['chain']}"))
            if prev['phase'] == 'pickup' and e['phase'] == 'deliver': out.append((ct, 'pickup', 'parcel picked up'))
            if e['del'] > prev['del']: out.append((ct, 'delivery', f"delivery {e['del']} (score {e['score']})"))
            if e['passes'] > prev['passes']: out.append((ct, 'medal', f"medal tier {e['tier']}"))
            if e['crashes'] > prev['crashes']: out.append((ct, 'crash', 'crash charged (time penalty)'))
            if e['impacts'] > prev['impacts']: out.append((ct, 'impact', 'head-on impact'))
            if e['scrapes'] > prev['scrapes']: out.append((ct, 'scrape', 'wall scrape'))
            if e['light'] > prev['light']: out.append((ct, 'light-hit', 'hard knock, not a crash'))
            if e['boosting'] and not prev['boosting']: out.append((ct, 'boost-on', 'boost on'))
            if prev['boosting'] and not e['boosting']: out.append((ct, 'boost-off', 'boost off'))
            if e['rush'] and not prev['rush']: out.append((ct, 'rush', 'rush hour starts'))
            if e['rushOrders'] > prev['rushOrders']: out.append((ct, 'rush-order', 'rush order'))
            if e['ot'] and not prev['ot']: out.append((ct, 'overtime', 'overtime starts'))
            if e['tl'] <= 10 and np.ceil(e['tl']) != np.ceil(prev['tl']) and e['tl'] > 0 and prev['tl'] > e['tl']: out.append((ct, 'tick', f"clock tick {int(np.ceil(e['tl']))} s"))
            sx, px = e.get('sx') or {}, prev.get('sx') or {}
            if sx.get('passes', 0) > px.get('passes', 0): out.append((ct, 'passby', 'Doppler pass-by'))
        if prev and (e['track'], e['section'], e['layer']) != (prev['track'], prev['section'], prev['layer']):
            out.append((ct, 'music', f"music {e['track']}/{e['section']} layer {e['layer']}"))
        if prev and e['state'] != prev['state']: out.append((ct, 'state', f"state {prev['state']} -> {e['state']}"))
        prev = e
    for m in S['tl']['marks']: out.append((m['ct'], 'mark', m['label']))
    return sorted(out, key=lambda r: r[0])

def rms_db(x): return 20 * np.log10(np.sqrt(np.mean(x * x)) + 1e-12) if len(x) else -240.0

def ebur(stereo, sr):
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
    b = lambda a, c: round(float(X[(f >= a) & (f < c)].sum() / t * 100), 2)
    return {'<100': b(0, 100), '<150': b(0, 150), '150-3k': b(150, 3000), '>3k': b(3000, sr / 2), '3k-6k': b(3000, 6000), '>6k': b(6000, sr / 2), '>8k': b(8000, sr / 2)}

def clicks(x, sr):
    d2 = np.abs(np.diff(x, 2)); w = int(sr * 0.005)
    k = np.ones(2 * w + 1); k[w - 1:w + 2] = 0; k /= k.sum()
    loc = np.sqrt(np.convolve(d2 * d2, k, mode='same')) + 1e-9
    hits = np.where((d2 > 8 * loc) & (d2 > 0.01))[0]
    if len(hits) == 0: return []
    keep = [hits[0]]
    for h in hits[1:]:
        if h - keep[-1] > sr * 0.02: keep.append(h)
    return [round(h / sr, 3) for h in keep]

def width(L, R):
    M = (L + R) / 2; S = (L - R) / 2
    return round(10 * np.log10((np.mean(S * S) + 1e-20) / (np.mean(M * M) + 1e-20)), 1)

def win_db(x, sr, a, b):
    a = max(0, int(a * sr)); b = min(len(x), int(b * sr))
    return rms_db(x[a:b]) if b > a else None

def mark(S, label): return next(m['ct'] for m in S['tl']['marks'] if m['label'].startswith(label))
def first(E, kind, after=-1e9, before=1e9): return next((r for r in E if r[1] == kind and after <= r[0] <= before), None)

def plan_for(Sm, Em, Sf, Ef, So, Eo, real_fx):
    enter = mark(Sm, 'enter'); runEnd = mark(Sm, 'run-end')
    pays = [r for r in Em if r[1] == 'duck:slip']; EVm = Sm['tl']['EV']; best = None
    for r in pays:
        a = r[0] - 4; b = a + 25
        if any(e['tl'] is not None and e['tl'] < 12 for e in EVm if a <= e['ct'] <= b and e['state'] == 'playing'): continue
        n = sum(1 for q in pays if a <= q[0] <= b); mx = max([e['chain'] or 0 for e in EVm if a <= e['ct'] <= b] or [0])
        sc = n + (100 if mx >= 3 else 0)
        if not best or sc > best[0]: best = (sc, a, n, mx)
    boosts = [r for r in Em if r[1] == 'boost-on']
    def blen(r):
        off = first(Em, 'boost-off', r[0]); return (off[0] if off else r[0]) - r[0]
    bst = max(boosts, key=blen) if boosts else None
    medal = first(Em, 'duck:medal') or first(Em, 'medal')
    pick_before = [r for r in Em if r[1] == 'duck:pickup' and medal and r[0] < medal[0]]
    rush = first(Em, 'duck:rush') or first(Em, 'rush')
    P = {}
    P['01-title-music'] = ('main', [(Sm['calT'] + 0.1, 20)])
    P['02-takeoff-calm-flight-chain0'] = ('main', [(enter - 0.5, 20)])
    if best: P['03-slipstream-chain-x3-payouts'] = ('main', [(best[1], 25)])
    if bst: P['04-boost-and-tail-off'] = ('main', [(bst[0] - 2, 10)])
    if real_fx:
        sc = first(Ef, 'scrape') or first(Ef, 'light-hit') or (mark(Sf, 'scrape-setup') + 2, )
        im = first(Ef, 'impact')
        P['05-wall-scrape-and-head-on-crash'] = ('fx', [(sc[0] - 1.5, 5), (im[0] - 2.5, 5.3)])
    else:
        P['05-wall-scrape-and-head-on-crash'] = ('fx', [(mark(Sf, 'scrape-setup') - 0.8, 10)])
    if medal:
        if pick_before and medal[0] - pick_before[-1][0] < 30:
            p = pick_before[-1][0]
            P['06-pickup-delivery-medal'] = ('main', [(p - 1.5, 5), (medal[0] - 6, 10)]) if medal[0] - p > 13 else ('main', [(p - 1.5, max(15, medal[0] + 4 - p + 1.5))])
        else: P['06-pickup-delivery-medal'] = ('main', [(medal[0] - 11, 15)])
    fin_ot = next(r for r in Eo if r[1] == 'music' and '/final' in r[2]); end_ot = mark(So, 'run-end')
    if rush: P['07-rush-hour-then-last-10s-into-overtime'] = ('mix', [('main', rush[0] - 3, 8), ('ot', fin_ot[0] - 1.5, end_ot - fin_ot[0] + 1.5 + 3.5)])
    else: P['07-rush-hour-then-last-10s-into-overtime'] = ('ot', [(fin_ot[0] - 1.5, end_ot - fin_ot[0] + 1.5 + 3.5)])
    hb = mark(Sf, 'harbour-start'); st = mark(Sf, 'street-start')
    P['08-harbour-boats-bus-then-street-people-traffic'] = ('fx', [(hb + 1.0, 12), (st + 0.3, 10)])
    P['09-game-over-sting-and-loop'] = ('main', [(runEnd - 1.0, 21)])
    P['10-full-run-60s-unedited'] = ('main', [(enter - 0.5, 60)])
    return P

def cut(SRC, src, segs, names=('L', 'R', 'music', 'sfx', 'bed', 'amb', 'rev')):
    sr = 48000; parts = []; tparts = []; offset = 0.0
    segs = [((src,) + sg if len(sg) == 2 else sg) for sg in segs]
    for (sname, ct, L) in segs:
        S, E = SRC[sname]; a, b = idx(S, ct), idx(S, ct + L)
        parts.append({n: S['ch'][n][a:b].copy() for n in names}); tparts.append((ct, L, offset, sname)); offset += L - 0.3
    xf = int(0.3 * sr); clip = parts[0]
    for p in parts[1:]:
        r = np.linspace(0, 1, xf)
        clip = {n: np.concatenate([clip[n][:-xf], clip[n][-xf:] * (1 - r) + p[n][:xf] * r, p[n][xf:]]) for n in names}
    return clip, tparts

def chain_balance(S):
    """Drone bus minus music bus (dB), per 1 s window in flight, grouped by chain level; windows within 1.5 s of any duck
    are left out (cruise, not cue moments)."""
    EV = S['tl']['EV']; sr = S['sr']; out = {}
    ducks = [e['lastDuck']['at'] for e in EV if e.get('lastDuck')]
    ducks = sorted(set(ducks))
    for e in EV[::25]:
        if e['state'] != 'playing' or e['chain'] is None or (e['tl'] is not None and e['tl'] < 10.5): continue
        t = e['ct']
        if any(abs(t - u) < 1.5 or (0 < t - u < 2.2) for u in ducks): continue
        a, b = idx(S, t - 0.5), idx(S, t + 0.5)
        dm = rms_db(S['ch']['music'][a:b]); db = rms_db(S['ch']['bed'][a:b])
        if dm < -80: continue
        k = min(3, e['chain']); out.setdefault(k, []).append(db - dm)
    return {f'x{k}' + ('+' if k == 3 else ''): (round(float(np.median(v)), 1), len(v)) for k, v in sorted(out.items())}

def loop_corr(x, sr, lag_s, seg=None):
    """Waveform correlation of a bus with itself `lag_s` later (1.0 = the same samples repeat exactly)."""
    L = int(round(lag_s * sr)); x = x if seg is None else x[seg[0]:seg[1]]
    if len(x) < L + sr: return None
    a, b = x[:-L], x[L:]
    return round(float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12)), 3)

def analyse(SRC, P, outdir, write_files, label):
    rep = {}
    tl_txt = []
    for name, (src, segs) in P.items():
        clip, tparts = cut(SRC, src, segs)
        sr = 48000; st = np.stack([clip['L'], clip['R']], 1); mono = (clip['L'] + clip['R']) / 2
        if write_files:
            for args in (['-c:a', 'pcm_s24le', f'{outdir}/{name}.wav'], ['-c:a', 'libmp3lame', '-b:a', '192k', f'{outdir}/{name}.mp3']):
                subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'f32le', '-ar', str(sr), '-ac', '2', '-i', '-'] + args, input=st.astype(np.float32).tobytes(), check=True)
        M = dict(seconds=round(len(mono) / sr, 2), segments=[dict(session=sn, start_ct=round(c, 2), len=L, at_clip_s=round(o, 2)) for c, L, o, sn in tparts])
        M['loudness'] = ebur(st, sr)
        M['clipped'] = int(np.sum(np.abs(st) >= 0.999))
        M['bands'] = bands(mono, sr)
        M['width_side_vs_mid_db'] = width(clip['L'], clip['R'])
        M['bus_db'] = {n: round(rms_db(clip[n]), 1) for n in ['music', 'sfx', 'bed', 'amb', 'rev']}
        ck = clicks(mono, sr); M['clicks'] = dict(n=len(ck), at=ck[:15])
        M['clicks_music'] = len(clicks(clip['music'], sr))
        evs = []
        for (ct, L, o, sn) in tparts:
            for (t, kind, desc) in SRC[sn][1]:
                if ct <= t < ct + L:
                    rel = t - ct + o; row = dict(t=round(rel, 2), kind=kind, desc=desc)
                    if kind.startswith('duck:'):
                        pre = (rel - 1.0, rel - 0.05); w = (rel + 0.08, rel + 0.35)
                        for bus in ('music', 'bed', 'amb'):
                            a0 = win_db(clip[bus], sr, *pre); a1 = win_db(clip[bus], sr, *w)
                            if a0 is not None and a1 is not None and a0 > -90: row[f'duck_{bus}'] = round(a1 - a0, 1)
                    evs.append(row)
        M['events'] = sorted(evs, key=lambda r: r['t'])
        rep[name] = M
        tl_txt.append(f'\n== {name}  ({M["seconds"]} s; ' + ', '.join(f'clip {o:.1f} s = {sn} session audio clock {c:.2f} s for {L:.1f} s' for c, L, o, sn in tparts) + ')')
        for r in M['events']:
            extra = ''.join(f"  {k[5:]} {v:+.1f} dB" for k, v in r.items() if k.startswith('duck_'))
            tl_txt.append(f"{r['t']:7.2f} s  {r['kind']:<14} {r['desc']}{('   [duck:' + extra + ']') if extra else ''}")
        print(label, name, M['seconds'], M['loudness'], M['bands'], 'w', M['width_side_vs_mid_db'], 'clicks', M['clicks']['n'], M['bus_db'])
    return rep, tl_txt

A = {k: load(RAW_A, f'{k}-s22', NA) for k in ('main', 'fx', 'ot')}
B = {k: load(RAW_B, f'{k}-s22', NB) for k in ('main', 'fx', 'ot')}
SA = {k: (v, events(v)) for k, v in A.items()}; SB = {k: (v, events(v)) for k, v in B.items()}
PA = plan_for(A['main'], SA['main'][1], A['fx'], SA['fx'][1], A['ot'], SA['ot'][1], True)
PB = plan_for(B['main'], SB['main'][1], B['fx'], SB['fx'][1], B['ot'], SB['ot'][1], False)
repA, tlA = analyse(SA, PA, OUT, True, 'AFTER ')
repB, _ = analyse(SB, PB, OUT, False, 'BEFORE')
res = dict(latency={k: dict(ms=round(v['off'] * 1000, 2), match=round(v['match'], 3)) for k, v in A.items()},
           after=repA, before=repB,
           chain_balance=dict(after=chain_balance(A['main']), before=chain_balance(B['main'])))
# loop repetition on the ambience and drone buses: in the after fx session (harbour, street, altitude) and cruise
fx = A['fx']; sr = fx['sr']
def segm(S, a, b): return (idx(S, mark(S, a)), idx(S, mark(S, b)))
loops = {}
for lab, (a, b) in {'altitude': ('altitude-cross', 'descend-harbour'), 'harbour': ('harbour-start', 'harbour-end'), 'street': ('street-start', 'fx-end')}.items():
    sg = segm(fx, a, b)
    loops[lab] = {f'amb@{lag}s': loop_corr(fx['ch']['amb'], sr, lag, sg) for lag in (1.0, 2.0, 2.4, 3.0, 6.0)}
    loops[lab].update({f'drone@{lag}s': loop_corr(fx['ch']['bed'], sr, lag, sg) for lag in (2.0, 3.0)})
    loops[lab]['amb_db'] = round(rms_db(fx['ch']['amb'][sg[0]:sg[1]]), 1); loops[lab]['drone_db'] = round(rms_db(fx['ch']['bed'][sg[0]:sg[1]]), 1); loops[lab]['music_db'] = round(rms_db(fx['ch']['music'][sg[0]:sg[1]]), 1)
    loops[lab]['amb_bands'] = bands(fx['ch']['amb'][sg[0]:sg[1]], sr)
res['loops'] = loops
# the title and the game-over screens: the ambience bed under them
m = A['main']; res['amb_title_db'] = round(rms_db(m['ch']['amb'][idx(m, m['calT'] + 1):idx(m, mark(m, 'enter'))]), 1)
json.dump(res, open(f'{OUT}/measurements.json', 'w'), indent=1)
open(f'{OUT}/timelines.txt', 'w').write('Round 45 critic clips (after the audio round). Times are seconds into each clip, corrected for the capture latency.\n' + '\n'.join(tlA) + '\n')
print(json.dumps(dict(latency=res['latency'], chain=res['chain_balance'], loops=loops, amb_title=res['amb_title_db']), indent=1))
