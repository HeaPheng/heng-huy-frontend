export const TYPE_LABELS = {
  A: "ការ៉ុត",
  B: "បាកាន",
  C: "សំបកក្រហមស",
};

export function formatKg(kg) {
  const value = Number(kg || 0);
  if (value >= 1000) return `${(value / 1000).toLocaleString()} តោន`;
  return `${value.toLocaleString()} គីឡូ`;
}

export function formatRiel(value) {
  return `${Number(value || 0).toLocaleString()} រៀល`;
}

export function paymentLabel(method) {
  return method === "qr" ? "QR" : "សាច់ប្រាក់";
}

export function productKhmer(product) {
  if (!product) return "—";
  return `${TYPE_LABELS[product.type] || product.type} លេខ ${product.grade}`;
}

export function itemProductKhmer(item) {
  const product = item?.product || item;
  return productKhmer(product);
}