// Usage: node tests/backupMultiSelect.browser.mjs <playwright module path> [frontend URL]
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
let backups = [
  { name: 'manual-1.zip', date: '2026-09-25 08:00', size: 1024 },
  { name: 'auto-2.zip', date: '2026-09-24 20:00', size: 2048 },
  { name: 'manual-3.zip', date: '2026-09-23 08:00', size: 4096 },
];
const deleted = [];

await context.addInitScript(() => {
  localStorage.setItem('pos_token', 'mock-browser-test-token');
  localStorage.setItem('pos_user', JSON.stringify({ role: 'admin' }));
});

await page.route('**/api/**', async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;

  if (request.method() === 'GET' && path.endsWith('/backups')) {
    return route.fulfill({ json: backups });
  }
  if (request.method() === 'DELETE' && path.endsWith('/backup/delete')) {
    const name = request.postDataJSON().file_name;
    deleted.push(name);
    backups = backups.filter((backup) => backup.name !== name);
    return route.fulfill({ json: { success: true } });
  }
  throw new Error(`Unexpected API request: ${request.method()} ${path}`);
});

page.on('dialog', async (dialog) => dialog.accept('DELETE'));

try {
  await page.goto(`${process.argv[3] || 'http://127.0.0.1:5174'}/backup`);
  await page.getByText('manual-1.zip', { exact: true }).waitFor();

  await page.getByLabel('Select manual-1.zip').check();
  await page.getByLabel('Select auto-2.zip').check();
  assert.equal(await page.getByText('2 selected', { exact: true }).isVisible(), true);
  assert.equal(await page.locator('.bm-card.selected').count(), 2);

  await page.getByRole('button', { name: 'Delete selected' }).click();
  const toast = page.locator('.bm-toast');
  await toast.waitFor();
  assert.match(await toast.textContent(), /2 backups deleted/);
  assert.deepEqual(deleted.sort(), ['auto-2.zip', 'manual-1.zip']);
  assert.equal(await page.locator('.bm-card').count(), 1);
  assert.equal(await page.getByText('2 selected', { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  console.log('PASS: backup files support responsive multi-select and confirmed bulk deletion.');
} finally {
  await browser.close();
}
