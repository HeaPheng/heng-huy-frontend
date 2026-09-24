// Usage: node tests/datePickers.browser.mjs <playwright module path> [frontend URL]
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

await context.addInitScript(() => {
  localStorage.setItem('pos_token', 'mock-browser-test-token');
  localStorage.setItem('pos_user', JSON.stringify({ role: 'admin' }));
  localStorage.setItem('theme', 'dark');
});

await page.route('**/api/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path.endsWith('/sales') || path.endsWith('/products')) {
    return route.fulfill({ json: [] });
  }
  throw new Error(`Unexpected API request: ${path}`);
});

try {
  await page.goto(`${process.argv[3] || 'http://127.0.0.1:5174'}/sales`);

  const fromInput = page.getByLabel('ចាប់ពីថ្ងៃ');
  const toInput = page.getByLabel('ដល់ថ្ងៃ');
  await fromInput.waitFor();
  assert.equal(await toInput.isVisible(), true);
  assert.equal(await fromInput.evaluate((input) => getComputedStyle(input).opacity), '0');
  const fromBox = await fromInput.boundingBox();
  const toBox = await toInput.boundingBox();
  assert.equal(Math.round(fromBox.y), Math.round(toBox.y));
  const invoiceTypeSelect = page.getByLabel('ប្រភេទវិក្កយបត្រ');
  assert.equal(await toInput.evaluate((input, select) => (
    Boolean(input.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING)
  ), await invoiceTypeSelect.elementHandle()), true);
  assert.equal(await page.getByText('ចាប់ពីថ្ងៃ', { exact: true }).isVisible(), true);
  assert.equal(await page.getByText('ដល់ថ្ងៃ', { exact: true }).isVisible(), true);

  await fromInput.fill('2026-09-24');
  const visibleDate = page.getByText('24/09/2026', { exact: true });
  await visibleDate.waitFor();
  const darkColor = await visibleDate.evaluate((element) => getComputedStyle(element).color);
  assert.equal(darkColor, 'rgb(255, 255, 255)');

  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  const lightColor = await visibleDate.evaluate((element) => getComputedStyle(element).color);
  assert.notEqual(lightColor, darkColor);
  assert.notEqual(lightColor, 'rgba(0, 0, 0, 0)');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  console.log('PASS: shared date pickers stay visible on mobile invoice history in both themes.');
} finally {
  await browser.close();
}
