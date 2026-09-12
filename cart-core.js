/* Lógica pura compartida por el catálogo y sus pruebas. */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.GLAM_CART = core;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const key = (product, variant = '') => product.sku + '::' + variant;
  function resolve(cartKey, products) {
    if (typeof cartKey !== 'string') return null;
    const separator = cartKey.indexOf('::');
    if (separator < 0) return null;
    const sku = cartKey.slice(0, separator), variant = cartKey.slice(separator + 2);
    const product = products.find(p => p.sku === sku);
    if (!product || !Number.isSafeInteger(product.price) || product.price <= 0) return null;
    if (product.groupSkus?.length && !product.groupSkus.includes(sku)) return null;
    const variants = product.variants || [];
    if (variants.length ? !variants.includes(variant) : variant !== '') return null;
    return {product, variant};
  }
  function sanitize(input, products, maxQuantity = 99) {
    const result = Object.create(null);
    if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
    for (const [cartKey, quantity] of Object.entries(input)) {
      if (!resolve(cartKey, products) || !Number.isSafeInteger(quantity) || quantity <= 0) continue;
      result[cartKey] = Math.min(quantity, maxQuantity);
    }
    return result;
  }
  function read(storage, products, maxQuantity = 99) {
    try {
      const raw = storage.getItem('glamcart');
      if (raw === null) return {cart: Object.create(null), recovered: false};
      const parsed = JSON.parse(raw), cart = sanitize(parsed, products, maxQuantity);
      return {cart, recovered: JSON.stringify(cart) !== JSON.stringify(parsed)};
    } catch (_) {return {cart: Object.create(null), recovered: true};}
  }
  function discountedPrice(product, rate) {
    if (!Number.isSafeInteger(product.price) || product.price <= 0) throw new Error('Precio inválido');
    if (!Number.isFinite(rate) || rate < 0 || rate >= 1) throw new Error('Descuento inválido');
    return Math.round(product.price * (1 - rate));
  }
  function summarize(input, products, rate, maxQuantity = 99) {
    const cart = sanitize(input, products, maxQuantity);
    const lines = Object.entries(cart).map(([cartKey, quantity]) => {
      const {product, variant} = resolve(cartKey, products);
      const unitPrice = discountedPrice(product, rate);
      return {cartKey, product, variant, quantity, unitPrice, total: unitPrice * quantity};
    });
    const subtotal = lines.reduce((n, line) => n + line.product.price * line.quantity, 0);
    const total = lines.reduce((n, line) => n + line.total, 0);
    return {lines, subtotal, total, savings: subtotal - total, count: lines.reduce((n, line) => n + line.quantity, 0)};
  }
  function message(summary, form, rate, formatMoney) {
    if (!summary.lines.length || summary.total <= 0) throw new Error('Carrito vacío');
    const singleLine = value => String(value || '').replace(/[\r\n\t]+/g, ' ').trim();
    const lines = ['Hola Glam Joyas ✨', 'Quiero realizar este pedido:', '',
      ...summary.lines.map(line => `• ${line.quantity} × ${line.product.name}${line.variant ? ' — ' + line.variant : ''} (${line.product.sku}) — ${formatMoney(line.total)}`),
      '', 'Subtotal de joyas: ' + formatMoney(summary.subtotal),
      `Descuento de inauguración (${Math.round(rate * 100)}%): −${formatMoney(summary.savings)}`,
      'Total de joyas con descuento: ' + formatMoney(summary.total), 'Envío, si corresponde: a confirmar.',
      '', 'A nombre de: ' + singleLine(form.name), 'Entrega: ' + singleLine(form.delivery)];
    if (form.invoice) {
      lines.push('Factura: Sí', 'Nombre / Razón social: ' + singleLine(form.billName), 'RUC: ' + singleLine(form.ruc));
      if (form.phone) lines.push('Teléfono: ' + singleLine(form.phone));
      if (form.email) lines.push('Correo: ' + singleLine(form.email));
    } else lines.push('Factura: No');
    if (form.promoConsent) lines.push('', 'Promociones: sí, quiero recibirlas por WhatsApp. Puedo solicitar la baja cuando quiera.');
    lines.push('', '¿Me confirman disponibilidad, entrega y forma de pago?');
    return lines.join('\n');
  }
  return Object.freeze({key, resolve, sanitize, read, discountedPrice, summarize, message});
});
