// Round 41 critic (new): which GL renderer the headless browser gets (hardware or SwiftShader), for reading perf numbers.
import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chromium' }); const p = await (await b.newContext()).newPage();
await p.goto('about:blank');
console.log('GPU', await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); }));
await b.close();
