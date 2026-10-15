// Start a disposable real server, run one integration lane, and always clean up.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const lane = process.argv[2];
if (!['network', 'browser', 'status'].includes(lane))
  throw new Error('Expected network, browser, or status');
const root = process.env.RIFT_PACKAGE_ROOT || new URL('../', import.meta.url);
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'rift-ci-'));
const artifacts = path.resolve('.artifacts', lane);
fs.mkdirSync(artifacts, { recursive: true });
const portProbe = net.createServer();
await new Promise((resolve) => portProbe.listen(0, '127.0.0.1', resolve));
const port = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
const url = `http://127.0.0.1:${port}`;
const log = fs.createWriteStream(path.join(artifacts, 'server.log'));
let serverLog = '';
let serverError;
const server = spawn(process.execPath, ['server/main.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), DATA_DIR: data, SEEDS_FILE: '/nonexistent', SOLO: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.on('error', (error) => {
  serverError = error;
  serverLog += error.stack;
});
for (const stream of [server.stdout, server.stderr])
  stream.on('data', (chunk) => {
    serverLog += chunk;
    log.write(chunk);
  });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (serverError) throw serverError;
    if (server.exitCode !== null) throw new Error(`Server exited: ${serverLog}`);
    try {
      const response = await fetch(url + '/api/status', { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).version) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Server readiness timed out');
  if (lane !== 'status') {
    const args =
      lane === 'network'
        ? ['test/bot.js', url.replace('http:', 'ws:') + '/ws']
        : ['test/browser-smoke.js', url, artifacts];
    const child = spawn(process.execPath, args, { stdio: 'inherit' });
    const timer = setTimeout(() => child.kill('SIGKILL'), 150_000);
    try {
      const [code] = await once(child, 'exit');
      if (code !== 0) throw new Error(`${lane} checks failed (${code})`);
    } finally {
      clearTimeout(timer);
    }
  } else {
    const response = await fetch(url + '/');
    if (!response.ok || !(await response.text()).includes('Quantum Rift'))
      throw new Error('Packaged client did not load');
    console.log('Packaged HTTP server and client passed');
  }
  if (/uncaught|unhandled rejection/i.test(serverLog)) throw new Error(serverLog);
} finally {
  if (server.pid && server.exitCode === null && server.signalCode === null) {
    const stopped = once(server, 'exit');
    server.kill('SIGTERM');
    const timer = setTimeout(() => server.kill('SIGKILL'), 5000);
    await stopped;
    clearTimeout(timer);
  }
  log.end();
  fs.rmSync(data, { recursive: true, force: true });
}
