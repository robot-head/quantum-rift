import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.argv[2];
const out = process.argv[3];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(20_000);
const errors = [];
const checks = [];
page.on('pageerror', (error) => errors.push(error.stack));
try {
  await page.goto(url);
  await page.fill('#lname', 'Browser CI');
  await page.fill('#lpass', 'local-test-only');
  await page.click('#lbtn');
  await page.waitForFunction(() => window.G?.you && window.G.landed);
  checks.push('fresh captain login and landing');
  for (let i = 0; i < 5 && (await page.locator('#storyok').isVisible()); i++)
    await page.locator('#storyok').click();
  await page.locator('#ltabs button[data-lt="jobs"]').click();
  assert.ok((await page.locator('#landbody').innerText()).trim().length);
  checks.push('jobs render');
  await page.locator('#ltabs button[data-lt="trade"]').click();
  assert.ok((await page.locator('#landbody').innerText()).trim().length);
  checks.push('market renders');
  await page.screenshot({ path: path.join(out, 'landed.png') });
  await page.keyboard.press('KeyL');
  await page.waitForFunction(() => !G.landed && G.view);
  checks.push('departure and live snapshots');
  await page.keyboard.press('KeyH');
  await page.waitForFunction(() => G.order === 'hold');
  await page.keyboard.press('KeyH');
  await page.waitForFunction(() => G.order === 'gather');
  checks.push('fleet command and cancellation');
  await page.keyboard.press('KeyI');
  await page.waitForFunction(
    () => !document.querySelector('#infobox').classList.contains('hidden'),
  );
  await page.keyboard.press('Escape');
  checks.push('ship info');
  await page.screenshot({ path: path.join(out, 'space.png') });
  assert.deepEqual(errors, [], 'browser page errors');
} catch (error) {
  await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
console.log(`${checks.length} browser checks passed`);
