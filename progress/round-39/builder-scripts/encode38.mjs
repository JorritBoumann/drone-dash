// Round 38 critic (new): frames from video38.mjs -> constant 30 fps VP8 WebM (Playwright's ffmpeg). Each output frame
// shows the newest screencast frame at that time. CUT="a-b,c-d" drops those spans (s from the recording start).
// Env: TAG, OUT (file), FROM, TO (s from the recording start), BITRATE (default 3.2M).
import fs from 'node:fs'; import os from 'node:os'; import { spawn } from 'node:child_process';
const S = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c38/';
const TAG = process.env.TAG || 'desktop'; const FR = S + `frames-${TAG}/`; const J = JSON.parse(fs.readFileSync(FR + 'frames.json'));
const ts = J.frames.map((t) => t - J.tRec); const FROM = Number(process.env.FROM || 0); const TO = Number(process.env.TO || ts[ts.length - 1]);
const cuts = (process.env.CUT || '').split(',').filter(Boolean).map((c) => c.split('-').map(Number));
const ff = os.homedir() + '/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac';
const out = process.env.OUT || S + `video-${TAG}.webm`;
const p = spawn(ff, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '30', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', process.env.BITRATE || '3.2M', '-maxrate', process.env.MAXRATE || '3.6M', '-bufsize', '4M', '-crf', process.env.CRF || '28', '-qmin', '10', '-qmax', '50', '-deadline', 'good', '-cpu-used', '4', '-auto-alt-ref', '0', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
let i = 0, n = 0; const kept = [];
for (let t = FROM; t <= TO; t += 1 / 30) {
  if (cuts.some(([a, b]) => t >= a && t < b)) continue;
  while (i + 1 < ts.length && ts[i + 1] <= t) i++;
  const buf = fs.readFileSync(FR + String(i).padStart(5, '0') + '.jpg');
  if (!p.stdin.write(buf)) await new Promise((r) => p.stdin.once('drain', r));
  n++; if (n % 30 === 0) kept.push(+t.toFixed(1));
}
p.stdin.end(); await new Promise((r) => p.on('close', r));
console.log('ENCODED', out, n, 'frames', (n / 30).toFixed(1), 's', (fs.statSync(out).size / 1e6).toFixed(1), 'MB', 'source frames', ts.length, 'gapMax', Math.max(...ts.slice(1).map((t, k) => t - ts[k])).toFixed(3));
