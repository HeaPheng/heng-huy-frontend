import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOcrCartItems, productForGrade, recalculateCartItem, updateQuantityParts } from '../src/utils/ocrCart.js';

const products = [
  { id: 1, name: 'A-1', type: 'A', grade: 1 },
  { id: 4, name: 'B-1', type: 'B', grade: 1 },
  { id: 5, name: 'B-2', type: 'B', grade: 2 },
];

test('every exact OCR line becomes a separate cart item with a stable generated id', () => {
  const result = buildOcrCartItems(
    [
      { product_code: 'B', quantity_parts: [100, 200], quantity: 300, unit: 'គីឡូ' },
      { product_code: 'A', quantity_parts: [100, 50], quantity: 150, unit: 'គីឡូ' },
    ],
    [
      { status: 'exact_code', product: { id: 4 } },
      { status: 'exact_code', product: { id: 1 } },
    ],
    products,
    (index) => `ocr-item-${index}`
  );

  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items.map((item) => item.client_id), ['ocr-item-0', 'ocr-item-1']);
  assert.deepEqual(result.items.map((item) => item.quantity_kg), [300, 150]);
  assert.deepEqual(result.items[0].quantity_parts, ['100', '200']);
  assert.equal(result.items[0].price_per_kg, '');
  assert.deepEqual(result.unresolvedIndexes, []);
});

test('uncertain matches remain unresolved instead of selecting a product', () => {
  const result = buildOcrCartItems(
    [{ quantity: 100, unit: 'គីឡូ' }],
    [{ status: 'possible_match', suggestions: [{ id: 4 }] }],
    products,
    () => 'unused'
  );

  assert.deepEqual(result.items, []);
  assert.deepEqual(result.unresolvedIndexes, [0]);
});

test('quantity parts, price, and grade recalculate the normal cart fields', () => {
  const base = buildOcrCartItems(
    [{ quantity_parts: [100, 200], quantity: 300, unit: 'គីឡូ' }],
    [{ status: 'exact_code', product: { id: 4 } }],
    products,
    () => 'ocr-item'
  ).items[0];

  const quantityEdited = updateQuantityParts(base, ['100', '250']);
  const priced = recalculateCartItem(quantityEdited, { price_per_kg: '800' });

  assert.equal(priced.quantity_kg, 350);
  assert.equal(priced.subtotal, 280000);
  assert.equal(productForGrade(priced, 2, products)?.id, 5);
});
