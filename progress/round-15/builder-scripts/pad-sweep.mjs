// Round 15 builder: generator sweep. Builds N cities through the padAudit hook (no rendering) and reports every pad
// that is buried, under an overhang, outside the city, or a city taller than the flight ceiling. Seeds: the 8 test
// seeds plus N random ones (SEEDS env overrides).
import { chromium } from '@playwright/test';
const N = Number(process.env.N || 40);
const fixed = [11, 22, 33, 44, 7, 58, 91, 130];
const rand = Array.from({ length: N }, () => 10000 + Math.floor(Math.random() * 90000));
const seeds = process.env.SEEDS ? process.env.SEEDS.split(',').map(Number) : [...fixed, ...rand];
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
await page.goto('http://127.0.0.1:5188/?seed=7', { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
const res = await page.evaluate((s) => window.__GAME__.padAudit(s), seeds);
let bad = 0, pads = 0;
for (const r of res) { pads += r.sites; if (r.issues.length) { bad++; console.log('SEED ' + r.seed + ' sites ' + r.sites + ' ISSUES ' + JSON.stringify(r.issues)); } }
console.log(JSON.stringify({ seeds: res.length, pads, seedsWithIssues: bad, issues: res.reduce((a, r) => a + r.issues.length, 0), seedList: seeds }));
await browser.close();
