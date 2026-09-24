function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function recalculateCartItem(item, changes = {}) {
  const next = { ...item, ...changes };
  const quantity = numeric(next.quantity);
  const quantityKg = next.unit === "ton" ? quantity * 1000 : quantity;
  const price = numeric(next.price_per_kg);

  return {
    ...next,
    quantity,
    quantity_kg: quantityKg,
    subtotal: quantityKg * price,
  };
}

export function updateQuantityParts(item, parts) {
  const quantityParts = parts.map((part) => String(part));
  const quantity = quantityParts.reduce((sum, part) => sum + numeric(part), 0);

  return recalculateCartItem(item, {
    quantity_parts: quantityParts,
    quantity,
    unit: "kg",
  });
}

export function productForGrade(item, grade, products) {
  const matches = products.filter((product) => (
    String(product.type) === String(item.product?.type)
    && Number(product.grade) === Number(grade)
  ));

  return matches.length === 1 ? matches[0] : null;
}

export function buildOcrCartItems(parsedItems, productMatches, products, createId) {
  const items = [];
  const unresolvedIndexes = [];

  parsedItems.forEach((parsedItem, index) => {
    const match = productMatches[index];
    const confirmed = ["exact_code", "exact"].includes(match?.status);
    const product = confirmed
      ? products.find((candidate) => String(candidate.id) === String(match.product?.id))
      : null;

    if (!product) {
      unresolvedIndexes.push(index);
      return;
    }

    const parts = Array.isArray(parsedItem.quantity_parts)
      ? parsedItem.quantity_parts.map((part) => String(part))
      : [];
    const partsTotal = parts.reduce((sum, part) => sum + numeric(part), 0);
    const parsedQuantity = parsedItem.quantity == null ? partsTotal : numeric(parsedItem.quantity);
    const unit = ["ton", "តោន"].includes(String(parsedItem.unit).toLowerCase()) ? "ton" : "kg";

    items.push(recalculateCartItem({
      client_id: createId(index),
      product_id: product.id,
      product,
      quantity: parsedQuantity,
      unit,
      price_per_kg: "",
      customBoxValue: "",
      source: "ocr",
      quantity_parts: parts,
    }));
  });

  return { items, unresolvedIndexes };
}
