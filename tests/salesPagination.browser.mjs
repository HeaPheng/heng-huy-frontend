// Usage: node tests/salesPagination.browser.mjs <playwright module path> [frontend URL]
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
const requests = [];
let failedPrefetches = 0;

const product = { id: 1, name: 'A-1', type: 'A', grade: 1 };
const invoices = Array.from({ length: 65 }, (_, index) => {
  const id = 65 - index;
  return {
    id,
    invoice_no: `INV-${String(id).padStart(4, '0')}`,
    customer_id: id,
    customer: { id, name: id === 1 ? 'Target Customer' : 'Customer', phone: id === 1 ? '0977773346' : '085395026' },
    items: [{ id, product_id: 1, product, quantity_kg: '1.00', subtotal: '100.00' }],
    payments: [],
    total_amount: '100.00',
    paid_amount: '0.00',
    balance_amount: '100.00',
    payment_status: 'unpaid',
    payment_method: 'cash',
    created_at: new Date(Date.UTC(2026, 8, 25, 12, 0, id)).toISOString(),
  };
});

await context.addInitScript(() => {
  localStorage.setItem('pos_token', 'mock-browser-test-token');
  localStorage.setItem('pos_user', JSON.stringify({ role: 'admin' }));
});

page.on('pageerror', (error) => errors.push(error.message));
await page.route('**/api/**', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.pathname.endsWith('/products')) return route.fulfill({ json: [product] });
  if (!url.pathname.endsWith('/sales') || request.method() !== 'GET') {
    throw new Error(`Unexpected API request: ${request.method()} ${url.pathname}`);
  }

  const search = url.searchParams.get('search') || '';
  const cursor = url.searchParams.get('cursor');
  const perPage = Number(url.searchParams.get('per_page'));
  assert.equal(perPage, 20);
  requests.push({ search, cursor });

  if (search === 'fail' && cursor === '20' && failedPrefetches++ === 0) {
    return route.fulfill({ status: 500, json: { error: 'Temporary failure' } });
  }
  if (search === 'slow' && cursor === '20') {
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  const matches = search === 'target'
    ? invoices.filter((invoice) => invoice.id === 1)
    : search === 'slow' || search === 'fail' ? invoices.slice(0, 45) : invoices;
  const start = Number(cursor || 0);
  const data = matches.slice(start, start + perPage);
  const next = start + perPage < matches.length ? String(start + perPage) : null;
  try {
    await route.fulfill({ json: { data, cursor, next_cursor: next, has_more: next !== null, total: matches.length, per_page: perPage } });
  } catch {
    // A superseded request may have been aborted while the mock delayed it.
  }
});

async function until(predicate, timeoutMs = 3000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for API request');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

const rows = page.locator('table').first().locator('tbody tr');

try {
  await page.goto(`${process.argv[3] || 'http://127.0.0.1:5174'}/sales`);
  await rows.first().getByText('INV-0065').waitFor();
  assert.equal(await rows.count(), 20);
  await until(() => requests.some((request) => request.search === '' && request.cursor === '20'));
  assert.equal(await rows.count(), 20, 'prefetched invoices must remain hidden');
  assert.equal(requests.some((request) => request.search === '' && request.cursor === '40'), false);

  await page.getByRole('button', { name: 'មើលបន្ថែម 20' }).click();
  await rows.nth(39).waitFor();
  assert.equal(await rows.count(), 40);
  assert.equal(requests.filter((request) => request.search === '' && request.cursor === '20').length, 1);
  await until(() => requests.some((request) => request.search === '' && request.cursor === '40'));

  await page.getByRole('button', { name: 'មើលបន្ថែម 20' }).click();
  await rows.nth(59).waitFor();
  await until(() => requests.some((request) => request.search === '' && request.cursor === '60'));
  await page.getByRole('button', { name: 'មើលបន្ថែម 20' }).click();
  await rows.nth(64).waitFor();
  assert.equal(await rows.count(), 65);
  assert.equal(await page.getByRole('button', { name: 'មើលបន្ថែម 20' }).count(), 0);
  const numbers = await rows.locator('td:nth-child(3)').allTextContents();
  assert.equal(new Set(numbers).size, 65, 'no invoice may be appended twice');

  const searchInput = page.getByPlaceholder('ស្វែងរកតាមឈ្មោះ លេខទូរស័ព្ទ ឬលេខវិក្កយបត្រ...');
  await searchInput.fill('slow');
  await until(() => requests.some((request) => request.search === 'slow' && request.cursor === '20'));
  await searchInput.fill('target');
  await rows.first().getByText('INV-0001').waitFor();
  assert.equal(await rows.count(), 1);
  await page.waitForTimeout(750);
  assert.equal(await rows.count(), 1, 'an old prefetch must not append after search changes');

  await searchInput.fill('fail');
  await rows.nth(19).waitFor();
  await until(() => failedPrefetches === 1);
  assert.equal(await rows.count(), 20);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find((candidate) => candidate.textContent.includes('មើលបន្ថែម 20'));
    button.click();
    button.click();
  });
  await rows.nth(39).waitFor();
  assert.equal(await rows.count(), 40, 'See More retries a failed prefetch without double-appending');

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  assert.deepEqual(errors, []);
  console.log('PASS: 20-row cursor pages, one-page prefetch, See More, filter reset, stale cancellation, retry, and mobile layout.');
} finally {
  await browser.close();
}
