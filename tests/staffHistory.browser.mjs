// Usage: node tests/staffHistory.browser.mjs <playwright module path> [frontend URL]
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const staff = {
  id: 1,
  name: 'សេង វែងណាស់សម្រាប់សាកល្បង',
  phone: '086458980',
  start_date: '2026-01-01',
  salary_per_month: 800000,
  daily_rate: 26667,
  pay_day: 1,
  balance: 987654321,
};
const transactions = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  type: index % 2 === 0 ? 'auto_deposit' : 'day_off',
  direction: index % 2 === 0 ? 'credit' : 'debit',
  amount: 123456789,
  days_off: index % 2 === 0 ? null : 12,
  note: 'ចំណាំសាកល្បងដែលមានអត្ថបទវែងសម្រាប់ពិនិត្យទំហំលើទូរស័ព្ទ',
  created_at: `2026-09-${String(20 - index).padStart(2, '0')}T08:00:00.000000Z`,
}));

await context.addInitScript(() => {
  localStorage.setItem('pos_token', 'mock-browser-test-token');
  localStorage.setItem('pos_user', JSON.stringify({ role: 'admin' }));
  localStorage.setItem('theme', 'dark');
});

await page.route('**/api/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path.endsWith('/staff')) return route.fulfill({ json: [staff] });
  if (path.endsWith('/staff/1/transactions')) return route.fulfill({ json: transactions });
  throw new Error(`Unexpected API request: ${path}`);
});

try {
  await page.goto(`${process.argv[3] || 'http://127.0.0.1:5174'}/staff`);
  await page.getByRole('button', { name: 'ប្រវត្តិ' }).click();

  const dialog = page.getByRole('dialog', { name: `ប្រវត្តិ — ${staff.name}` });
  await dialog.waitFor();
  assert.equal(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), true);
  assert.equal(await dialog.locator(':scope > div').nth(1).evaluate((element) => getComputedStyle(element).overflowY), 'visible');
  assert.equal(await dialog.locator('input[type="date"]').count(), 2);
  assert.equal(await dialog.getByText('ចាប់ពី', { exact: true }).isVisible(), true);
  assert.equal(await dialog.getByText('ដល់', { exact: true }).isVisible(), true);
  assert.equal(await dialog.getByText('ជ្រើសកាលបរិច្ឆេទ', { exact: true }).count(), 2);
  await dialog.getByLabel('ចាប់ពីកាលបរិច្ឆេទ').fill('2026-09-01');
  const visibleDate = dialog.getByText('01/09/2026', { exact: true });
  await visibleDate.waitFor();
  const darkDateColor = await visibleDate.evaluate((element) => getComputedStyle(element).color);
  assert.equal(darkDateColor, 'rgb(255, 255, 255)');
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  const lightDateColor = await visibleDate.evaluate((element) => getComputedStyle(element).color);
  assert.notEqual(lightDateColor, darkDateColor);
  assert.notEqual(lightDateColor, 'rgba(0, 0, 0, 0)');
  assert.equal(await dialog.getByText('ដល់', { exact: true }).isVisible(), true);
  assert.equal(await dialog.locator('input[type="date"]').evaluateAll((inputs) => (
    inputs.every((input) => input.getBoundingClientRect().right <= document.documentElement.clientWidth)
  )), true);
  assert.equal(await dialog.getByText('ចំនួន', { exact: true }).evaluateAll((elements) => (
    elements.filter((element) => element.getClientRects().length > 0).length
  )), 7);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  console.log('PASS: staff salary history is compact, single-scroll, and width-safe on mobile.');
} finally {
  await browser.close();
}
