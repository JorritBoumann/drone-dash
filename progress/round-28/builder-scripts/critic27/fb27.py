# Round 27 critic: early-feedback, introductions and phone camera summary from FB27 lines.
import json, sys
for fn in sys.argv[1:]:
    fb = None; teach = None
    for l in open(fn):
        if l.startswith('FB27 '): fb = json.loads(l[5:])
        if l.startswith('TEACH '): teach = json.loads(l[6:])
    if not fb: print(fn, 'no FB27'); continue
    ev = fb['ev']; picks = [e['t'] for e in ev if e['k'] == 'pick']; drops = [e['t'] for e in ev if e['k'] == 'drop']
    fbt = sorted(set([0.0] + [e['t'] for e in ev]))
    gaps = [(round(b - a, 1), a) for a, b in zip(fbt, fbt[1:] + [60.0]) if a < 60]
    mg = max(gaps) if gaps else None
    meter = fb.get('meter', [])
    fbt2 = sorted(set(fbt + [round(x) for x in meter]))
    gaps2 = [(round(b - a, 1), a) for a, b in zip(fbt2, fbt2[1:] + [60.0]) if a < 60]
    pays = fb['pays']; silent = [p for p in pays if not p['shown']]; unexpl = [p for p in pays if p['shown'] and p['popAt'] is None]
    intro = fb['intros']; late = [i for i in intro if i['t'] >= 30]
    ig = [round(b['t'] - a['t'], 1) for a, b in zip(late, late[1:])]
    near = [(i['k'], i['t']) for i in late if i['k'] != 'medal' and any(abs(i['t'] - x) < 3 for x in picks + drops)]
    cam = fb['cam']; wall = [c for c in cam if c['wall']]
    big = [c for c in wall if c['hf'] >= 0.4]; bigall = [c for c in cam if c['hf'] >= 0.4]
    print(f"== {fn}\n first pick {picks[0] if picks else None} drops {drops} | max gap (pops/events, first 60 s) {mg} | with meter motion {max(gaps2)}")
    print(f" payouts {len(pays)}: silent before slip intro {len(silent)}, shown without slip pop {len(unexpl)} {[p['t'] for p in unexpl]} | medals {[(m['tier'], m['t']) for m in fb['medals']]}")
    ch = fb.get('chimes', []); chno = [c['t'] for c in ch if c['popAt'] is None]
    print(f" payout chimes played {len(ch)}, without their pop {len(chno)} {chno}")
    print(f" intros {[(i['k'], i['t']) for i in intro]} | gaps from 30 s {ig} | non-medal intros within 3 s of pick/drop {near}")
    for i in intro: print('   ', i['k'], i['t'], 'alt', i['alt'], 'hw', i['headwind'], 'draft', i['drafting'], 'lvl', i['level'], 'clk', i['clockGain'], 'gate', i['gate'])
    print(f" camera after pick/drop: samples {len(cam)}, beside wall {len(wall)}, drone >=40% of height: wall {len(big)} ({100*len(big)/max(1,len(wall)):.1f}%), all {len(bigall)}; max hf {max([c['hf'] for c in cam], default=0)} | pops on Fly {fb['flyHits']} of {fb['popSamples']} {fb['flyEx'][:3]}")
