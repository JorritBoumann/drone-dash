# Round 43 critic: summary of play43c.log (one block per full run)
import json
for l in open('play43c.log'):
    if not l.startswith('PLAY43C'): print(l[:300]); continue
    tag, js = l.split(' ',2)[1], l.split(' ',2)[2]
    d=json.loads(js)
    print(tag, 'over',d['over'],'frames',d['frames'],'corner',d['cornerFrames'],d['byName'],'overF',d['overFrames'],'overCorner',d['overCorner'],'card',d['overCard'],'ups',d['overUploads'],d['uploadsIdle1s'], 'cb', d['cornerBox'])
    print('  mk n',d['mk']['n'],'off',d['mk']['off'],'ctl',d['mk']['ctl'],'btn',d['mk']['btn'],d['mk']['offEx'][:2],d['mk']['ctlEx'][:2],'| lab',d['lab']['n'],d['lab']['off'],d['lab']['offEx'][:2],'| ov',d['ovFrames'],d['ov'],'touch',d['touch2px'],'| scale',d['scale']['n'],d['scale']['bad'],d['scale'].get('fitN'),'errs',d['errs'],'sec',round(d['runSec']))
