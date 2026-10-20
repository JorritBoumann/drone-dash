# Round 46 builder: do the adaptive layers change at the right game events? From the 25 Hz diagnostics log of each
# session: every chain-level change (0..3), rush hour, the last 10 s, overtime and game over, and how long the music took
# to report the matching layer / section (Classic switches at once with a 0.12 s glide, Breakbeat on the next downbeat,
# at most one bar = 1.43 s). usage: python3 layers46.py <rawdir>
import sys, json
raw = sys.argv[1]
want_bb = {0: 'base', 1: 'hats', 2: 'ghosts-arp', 3: 'lead-ride'}
for tag in ('main-s22', 'ot-s22'):
    EV = json.load(open(f'{raw}/{tag}-timeline.json'))['EV']
    track = EV[-1].get('soundtrack'); lags = []; misses = 0; notes = []
    for i in range(1, len(EV)):
        p, e = EV[i - 1], EV[i]
        if e['state'] != 'playing' or p['state'] != 'playing' or e['track'] != 'run': continue
        c0, c1 = min(3, p['chain'] or 0), min(3, e['chain'] or 0)
        if c0 == c1: continue
        # time until the music reports layer 1 + c1 (or a newer chain change comes first)
        t0 = e['ct']; hit = None
        for q in EV[i:]:
            if min(3, q['chain'] or 0) != c1 or q['state'] != 'playing' or q['track'] != 'run': break
            if q['layer'] == 1 + c1: hit = q['ct'] - t0; break
        if hit is None: misses += 1
        else: lags.append(hit)
    def first(cond, after=None):
        return next((e for e in EV if cond(e) and (after is None or e['ct'] >= after)), None)
    rush = first(lambda e: e['rush'] and e['state'] == 'playing')
    stabs = first(lambda e: '+stabs' in (e['section'] or ''), rush['ct'] if rush else None) if rush else None
    fin = first(lambda e: e['track'] == 'final')
    t10 = first(lambda e: e['state'] == 'playing' and e['tl'] is not None and e['tl'] <= 10)
    ot = first(lambda e: e['ot'])
    drop = first(lambda e: e['section'] == 'drop')
    over = first(lambda e: e['state'] == 'over'); mover = first(lambda e: e['track'] == 'over')
    f = lambda a, b: f"{(b['ct'] - a['ct']):+.2f} s" if a and b else 'n/a'
    lags.sort()
    print(f"{tag} [{track}] chain changes {len(lags) + misses}: layer followed in {len(lags)} (median {lags[len(lags)//2]:.2f} s, max {max(lags):.2f} s), "
          f"superseded before the next downbeat {misses}" if lags else f"{tag} no chain changes")
    print(f"   rush hour -> stabs reported {f(rush, stabs) if track == 'breakbeat' else '(Classic has no rush layer)'};"
          f" clock 10 s -> last-10-s section {f(t10, fin)}; overtime -> drop {f(ot, drop) if track == 'breakbeat' else '(Classic: lead joins)'}; game over -> over loop {f(over, mover)}")
