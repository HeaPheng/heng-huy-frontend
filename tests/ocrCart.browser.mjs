// Usage: node tests/ocrCart.browser.mjs <playwright module path> [frontend URL]
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const products = [
  ...[1, 2, 3].map((grade) => ({ id: grade, name: `A-${grade}`, type: 'A', grade, ocr_code: 'A', stock_kg: 10000 })),
  ...[1, 2, 3].map((grade) => ({ id: grade + 3, name: `B-${grade}`, type: 'B', grade, ocr_code: 'B', stock_kg: 10000 })),
  ...[1, 2, 3].map((grade) => ({ id: grade + 6, name: `C-${grade}`, type: 'C', grade, ocr_code: 'C', stock_kg: 10000 })),
  ...[1, 2, 3].map((grade) => ({ id: grade + 9, name: `D-${grade}`, type: 'D', grade, ocr_code: 'D', stock_kg: 10000 })),
];
const writes = [];
const errors = [];
let failure = false;

page.on('pageerror', (error) => errors.push(error.message));
await context.addInitScript(() => {
  localStorage.setItem('pos_token', 'mock-browser-test-token');
  localStorage.setItem('pos_user', JSON.stringify({ role: 'admin' }));
});

await page.route('**/api/**', async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  if (request.method() !== 'GET') writes.push(path);

  if (path.endsWith('/products')) return route.fulfill({ json: products });
  if (path.endsWith('/ocr/test')) {
    assert.match(request.headers()['content-type'], /multipart\/form-data; boundary=/);
    assert.ok(request.postDataBuffer().includes(Buffer.from('name="image"')));
    if (failure) return route.fulfill({ status: 500, json: { success: false, error: 'OCR failed.' } });

    return route.fulfill({ json: {
      success: true,
      parsed: { items: [
        { product_code: 'B', grade: 'លេខ 1', quantity_parts: [100, 200], quantity: 300, unit: 'គីឡូ' },
        { product_code: 'A', grade: 'លេខ 1', quantity_parts: [100, 50], quantity: 150, unit: 'គីឡូ' },
      ] },
      customer_match: { status: 'exact_phone', customer: { id: 2, name: 'សេង', phone: '086458980' } },
      product_matches: [
        { status: 'exact_code', product: { id: 4 } },
        { status: 'exact_code', product: { id: 1 } },
      ],
    } });
  }

  throw new Error(`Unexpected API request: ${path}`);
});

try {
  await page.goto(`${process.argv[3] || 'http://127.0.0.1:5174'}/sell`);
  await page.getByRole('button', { name: 'ស្កេនវិក្កយបត្រ' }).waitFor();
  await page.getByRole('button', { name: 'ថតរូប' }).waitFor();
  const imageInputs = page.locator('input[type=file]');
  assert.equal(await imageInputs.count(), 2);
  assert.equal(await imageInputs.nth(0).getAttribute('capture'), null);
  assert.equal(await imageInputs.nth(1).getAttribute('capture'), 'environment');
  const form = page.locator('form');
  await form.getByLabel('បរិមាណ', { exact: true }).fill('25');
  await form.getByLabel('តម្លៃក្នុងមួយគីឡូ', { exact: true }).fill('1000');
  await form.getByRole('button', { name: 'បន្ថែមទំនិញមួយទៀត' }).click();
  assert.equal(await page.locator('aside').getByRole('button', { name: 'កែ' }).count(), 1);
  await imageInputs.nth(0).setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from('test-image') });

  await page.getByText('បានបន្ថែមទំនិញ 2 មុខទៅក្នុងវិក្កយបត្រ។', { exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.getByLabel('ឈ្មោះអតិថិជន').inputValue(), 'សេង');
  assert.equal(await page.getByLabel('លេខទូរស័ព្ទ').inputValue(), '086458980');

  const summary = page.locator('aside');
  await summary.getByText('បាកាន លេខ 1', { exact: true }).waitFor();
  await summary.getByText('ការ៉ុត លេខ 1', { exact: true }).first().waitFor();
  assert.equal(await summary.getByText('ការ៉ុត លេខ 1', { exact: true }).count(), 2);
  assert.equal(await summary.getByRole('button', { name: 'កែ' }).count(), 3);
  assert.equal(await summary.getByText('B-1', { exact: true }).count(), 0);
  assert.equal(await summary.getByText('A-1', { exact: true }).count(), 0);

  await page.setViewportSize({ width: 390, height: 844 });
  await summary.getByRole('button', { name: 'កែ' }).nth(1).click();
  const productSelect = summary.getByLabel('ទំនិញ');
  assert.deepEqual(await productSelect.locator('option').allTextContents(), ['ការ៉ុត', 'បាកាន', 'ជប៉ុន', 'ស្វាយ']);
  assert.equal((await productSelect.locator('option').allTextContents()).some((label) => label.includes('លេខ')), false);
  await summary.getByRole('textbox', { name: 'បរិមាណទី 2', exact: true }).fill('250');
  const itemPriceInput = summary.getByLabel('តម្លៃក្នុងមួយគីឡូ');
  assert.ok(Number.parseFloat(await itemPriceInput.evaluate((input) => getComputedStyle(input).fontSize)) >= 16);
  await itemPriceInput.fill('800');
  await summary.getByText('280,000 រៀល', { exact: true }).first().waitFor();
  await summary.getByRole('combobox').nth(1).selectOption('2');
  await summary.getByRole('paragraph').filter({ hasText: 'បាកាន លេខ 2' }).waitFor();
  await summary.getByRole('button', { name: 'រួចរាល់' }).click();

  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);

  failure = true;
  await imageInputs.nth(0).setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from('test-image') });
  await page.getByRole('alert').waitFor();
  assert.deepEqual(writes, ['/api/ocr/test', '/api/ocr/test']);
  assert.deepEqual(errors, []);
  console.log('PASS: OCR prefills customer and two cart rows, edits inline, stays responsive, and never saves automatically.');
} finally {
  await browser.close();
}
