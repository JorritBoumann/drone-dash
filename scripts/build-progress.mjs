// Rebuilds progress.html from progress/round-*/: critic and builder notes plus critic screenshots.
// Run after every round: node scripts/build-progress.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const progressDir = join(root, 'progress');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const rounds = readdirSync(progressDir)
  .filter((d) => /^round-\d+$/.test(d))
  .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));

const sections = rounds.map((round) => {
  const dir = join(progressDir, round);
  const note = (name) => {
    const file = join(dir, name);
    return existsSync(file)
      ? `<details${name === 'critic.md' ? ' open' : ''}><summary>${name}</summary><pre>${esc(readFileSync(file, 'utf8'))}</pre></details>`
      : '';
  };
  const shotDir = join(dir, 'critic');
  const shots = existsSync(shotDir) ? readdirSync(shotDir).filter((f) => f.endsWith('.png')).sort() : [];
  const grid = shots
    .map((f) => `<figure><a href="progress/${round}/critic/${f}"><img loading="lazy" src="progress/${round}/critic/${f}" alt="${f}"></a><figcaption>${f}</figcaption></figure>`)
    .join('\n');
  return `<section><h2>${round.replace('-', ' ')}</h2>${note('critic.md')}${note('builder.md')}<div class="grid">${grid}</div></section>`;
});

writeFileSync(
  join(root, 'progress.html'),
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Drone Dash progress</title>
<style>
:root { --bg: #f7f4ee; --fg: #1d1d1f; --muted: #6b6b70; --card: #fff; }
@media (prefers-color-scheme: dark) { :root { --bg: #151517; --fg: #ececf0; --muted: #9a9aa2; --card: #202024; } }
body { margin: 0; padding: 24px 16px; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; }
main { max-width: 1100px; margin: 0 auto; }
h1 { margin: 0 0 4px; } p.sub { color: var(--muted); margin: 0 0 24px; }
section { background: var(--card); border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; }
h2 { text-transform: capitalize; margin-top: 0; }
pre { white-space: pre-wrap; font-size: 13px; max-height: 480px; overflow: auto; }
summary { cursor: pointer; font-weight: 600; margin: 8px 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-top: 12px; }
figure { margin: 0; } img { width: 100%; border-radius: 6px; display: block; }
figcaption { font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
</style></head>
<body><main><h1>Drone Dash progress</h1>
<p class="sub">Builder and critic loop, newest round first. Updated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.</p>
${sections.join('\n')}
</main></body></html>
`,
);
console.log(`progress.html: ${rounds.length} rounds`);
