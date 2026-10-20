# Round 46 builder: one table per soundtrack from audio-measurements.json (loudness, true peak, bands, clicks).
import sys, json
for tr in sys.argv[1:]:
    d = json.load(open(f'../builder-audio/{tr}/audio-measurements.json'))['clips']
    print(f'\n{tr}: clip | LUFS | true peak | <100 Hz | 150 Hz-3 kHz | >3 kHz | clicks master / music bus')
    for k, c in d.items():
        L = c['loudness']; b = c['bands_pct']
        print(f"{k[:2]} | {L['I']} | {L['TP']} | {b['<100']}% | {b['150-3k']}% | {b['>3k']}% | {c['clicks_master']['n']} / {c['clicks_music_bus']['n']}")
    print('max true peak', max(c['loudness']['TP'] for c in d.values()))
    if '11-breakbeat-90s-continuous' in d:
        r = d['11-breakbeat-90s-continuous'].get('repetition_all', [])
        print('clip 11 music-bus similarity at whole-bar lags (top 5):', sorted(r, key=lambda x: -x[2])[:5])
