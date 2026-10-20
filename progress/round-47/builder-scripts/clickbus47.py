# Round 47 builder: which bus carries each master click (same detector as analyze47.py), per clip segment.
# usage: python3 clickbus47.py <rawdir> <track>
import sys, json
import numpy as np
raw, track = sys.argv[1], sys.argv[2]
src = open('measure47.py').read().split('out = {')[0]
sys.argv = [sys.argv[0], raw, track]
exec(src)
an = open('analyze47.py').read()
exec(an[an.index('def clicks'):an.index('def win_db')])
M = json.load(open(f'../builder-audio/{track}/audio-measurements.json'))['clips']
cache = {}
for name, c in M.items():
    for sg in c['segments']:
        tag = {'main': 'main-s22', 'fx': 'fx-s22', 'ot': 'ot-s22'}[sg['session']]
        if tag not in cache: cache[tag] = load(tag)
        S = cache[tag]; a = idx(S, sg['start_ct']); b = idx(S, sg['start_ct'] + sg['len'])
        res = {}
        for n in ['music', 'sfx', 'bed', 'amb', 'rev']:
            ck = clicks(S['ch'][n][a:b], S['sr'])
            if ck: res[n] = ck[:10]
        mono = (S['ch']['L'][a:b] + S['ch']['R'][a:b]) / 2
        mk = clicks(mono, S['sr'])
        if mk or res: print(name[:2], sg['session'], 'master', mk[:10], 'buses', res)
