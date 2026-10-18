// Shared catalog/order rules; legacy products keep fixed pricing and stock control.
export function normalizeProduct(input, previous = {}) {
  const product = {...previous, ...input};
  product.priceMode = product.priceMode === 'negotiated' ? 'negotiated' : 'fixed';
  product.kind = product.kind === 'digital-service' ? 'digital-service' : 'physical';
  product.trackStock = product.trackStock !== false;
  if (product.priceMode === 'negotiated') { product.price = null; product.promoPrice = null; }
  else {
    if (product.price === null || product.price === '' || !Number.isFinite(product.price) || product.price < 0) throw Error('Informe um preço fixo válido ou escolha Preço a definir.');
    if (product.promoPrice != null && (!Number.isFinite(product.promoPrice) || product.promoPrice < 0)) throw Error('Preço promocional inválido.');
  }
  if (!product.trackStock) product.stock = null;
  else if (!Number.isInteger(product.stock) || product.stock < 0) throw Error('Informe uma quantidade de estoque válida.');
  return product;
}
export function prepareOrder(input, product) {
  const order = {...input, quantity: input.quantity ?? 1};
  if (!Number.isInteger(order.quantity) || order.quantity < 1 || order.quantity > 100000) throw Error('Informe uma quantidade válida.');
  if (!Number.isFinite(order.amount) || order.amount < 0) throw Error('Total do pedido inválido.');
  if (product?.priceMode === 'negotiated' && (!Number.isFinite(order.unitPrice) || order.unitPrice < 0)) throw Error('Informe o valor combinado para esta venda.');
  return order;
}
export function applyOrderStock(product, order) {
  if (product && product.trackStock !== false && product.stock > 0) product.stock = Math.max(0, product.stock - order.quantity);
}
