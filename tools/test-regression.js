import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const logs = new URL('../.artifacts/regression/', import.meta.url);
fs.mkdirSync(logs, { recursive: true });
const suites = fs
  .readdirSync(new URL('../test/', import.meta.url))
  .filter((name) => /^(?:v\d+|sim|fuzz|balance)\.js$/.test(name))
  .sort();
let failed = 0;
for (const name of suites) {
  const result = spawnSync(
    process.execPath,
    ['--import', './test/seed-random.js', `test/${name}`],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, RIFT_TEST_SEED: process.env.RIFT_TEST_SEED || '123456789' },
    },
  );
  const output = (result.stdout || '') + (result.stderr || '') + (result.error?.stack || '');
  fs.writeFileSync(new URL(name + '.log', logs), output);
  const passed = result.status === 0;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${path.basename(name)}`);
  if (!passed) {
    failed++;
    console.error(output);
  }
}
console.log(`${suites.length - failed}/${suites.length} regression suites passed`);
process.exitCode = failed ? 1 : 0;
