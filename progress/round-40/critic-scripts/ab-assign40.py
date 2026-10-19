# Round 40 critic: random A/B sides per pair. Writes the key to a file that is not opened until judging is done.
import json, random, sys
pairs = sys.argv[2].split(',')
rng = random.SystemRandom()
key = {p: rng.choice([['bm', 'bw'], ['bw', 'bm']]) for p in pairs}
json.dump(key, open(sys.argv[1], 'w'))
print('wrote key for', len(key), 'pairs (not printed)')
