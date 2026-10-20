// Round 45 audio builder: own dev server (port from argv, default 5197), own Vite cache, no HMR. Never 5188 (the owner's).
import { createServer } from 'vite';
const port = Number(process.argv[2] || 5197);
if (port === 5188) throw new Error('5188 belongs to the owner');
const root = new URL('../../../', import.meta.url).pathname;
const s = await createServer({ root, configFile: root + 'vite.config.ts', cacheDir: '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/b45/vite-cache', server: { port, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
await s.listen();
console.log('dev up', port);
