'use strict';
const P = window.GLAM_PRODUCTS;
const Q = selector => document.querySelector(selector);
const M = value => 'Gs. ' + new Intl.NumberFormat('es-PY').format(value);
const V = product => product.variants || [];
const G = product => (product.groupSkus || []).map(sku => P.find(p => p.sku === sku)).filter(Boolean);
const config = window.GLAM_CONFIG, core = window.GLAM_CART;
const sale = product => core.discountedPrice(product, config.promotionRate);
const key = core.key;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const percent = Math.round(config.promotionRate * 100);
let storage;
try { storage = window.localStorage; } catch (_) { storage = {getItem() {throw new Error('Storage unavailable');}}; }
const initial = core.read(storage, P, config.maxQuantity);
let cart = initial.cart, active = null, returnFocus = null, openPanel = null;
const backgroundState = new Map();
function announce(text) { Q('#status').textContent = text; Q('#cartNotice').textContent = text; }
function save() {
  cart = core.sanitize(cart, P, config.maxQuantity);
  try { storage.setItem('glamcart', JSON.stringify(cart)); }
  catch (_) { announce('Tu selección sigue disponible en esta página, pero este navegador no permite guardarla al salir.'); }
  draw();
}
function imageFor(product, variant) { return product.variantImages?.[variant] || product.image; }
function imageTag(src, alt, sizes = '(max-width: 850px) 45vw, 400px', lazy = true) {
  const info = window.GLAM_IMAGES[src];
  if (!info) return '<div class="ph">Foto en actualización</div>';
  return `<img src="${escapeHTML(src)}" srcset="${escapeHTML(info.srcset)}" sizes="${escapeHTML(sizes)}" width="${info.width}" height="${info.height}" alt="${escapeHTML(alt)}" ${lazy ? 'loading="lazy"' : ''} decoding="async">`;
}
function setPanel(panel) {
  const wasOpen = !!openPanel;
  if (panel && !wasOpen) returnFocus = document.activeElement;
  openPanel = panel;
  if (panel && !wasOpen) {
    for (const element of document.body.children) {
      if (['m','d','o','status'].includes(element.id) || element.tagName === 'SCRIPT') continue;
      backgroundState.set(element, element.inert); element.inert = true;
    }
  }
  for (const id of ['m', 'd']) {
    const element = Q('#' + id), shown = element === panel;
    element.classList.toggle('on', shown); element.inert = !shown;
    element.setAttribute('aria-hidden', String(!shown));
  }
  Q('#o').classList.toggle('on', !!panel);
  document.body.classList.toggle('ui-open', !!panel);
  Q('#bag').setAttribute('aria-expanded', String(panel === Q('#d')));
  const toast = Q('#cartToast');
  if (toast) { toast.classList.remove('on'); toast.inert = true; }
  if (panel) panel.querySelector('button:not([disabled]), input, select')?.focus({preventScroll: true});
  else if (wasOpen) {
    for (const [element, inert] of backgroundState) element.inert = inert;
    backgroundState.clear();
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll: true});
    else Q('#bag').focus({preventScroll: true});
  }
}
function openD() { setPanel(Q('#d')); }
function closeD() { setPanel(null); }
function closeM() { setPanel(null); }
function closeAll() { setPanel(null); }
function add(product, variant = '') {
  const cartKey = key(product, variant);
  if (!core.resolve(cartKey, P)) return;
  const current = cart[cartKey] || 0;
  if (current >= config.maxQuantity) return announce('Para más de ' + config.maxQuantity + ' unidades, consultanos por WhatsApp.');
  cart[cartKey] = current + 1;
  save(); closeM(); showAdded(product, variant);
}
function qty(cartKey, change) {
  if (!core.resolve(cartKey, P) || !Number.isSafeInteger(change)) return;
  const next = (cart[cartKey] || 0) + change;
  if (next > config.maxQuantity) return announce('Máximo ' + config.maxQuantity + ' unidades por opción.');
  if (next <= 0) delete cart[cartKey]; else cart[cartKey] = next;
  save();
}
function searchText(product) {
  return [product.name, product.sku, product.material, ...V(product), ...G(product).flatMap(p => [p.name, p.sku, p.material])].join(' ').toLowerCase();
}
function groupMin(product) { const members = G(product); return members.length ? Math.min(...members.map(p => p.price)) : product.price; }
function groupMax(product) { const members = G(product); return members.length ? Math.max(...members.map(p => p.price)) : product.price; }
function filt() {
  const query = Q('#s').value.toLowerCase(), category = Q('#c').value;
  const products = P.filter(p => !p.hidden && (!category || p.category === category || G(p).some(x => x.category === category)) && (!query || searchText(p).includes(query)));
  const order = Q('#sort').value;
  if (order === 'low') products.sort((a,b) => groupMin(a) - groupMin(b));
  else if (order === 'high') products.sort((a,b) => groupMax(b) - groupMax(a));
  else products.sort((a,b) => a.name.localeCompare(b.name, 'es'));
  return products;
}
function priceLabel(product, exact = false) {
  const grouped = !exact && G(product).length, base = grouped ? groupMin(product) : product.price;
  return (grouped ? 'Desde ' : '') + `<span class="sale-price">${M(sale({price:base}))}</span> <del>${M(base)}</del>`;
}
function cleanGroupName(product, member) {
  if (product.sku === 'GJ-W033A' && member.sku === product.sku) return 'Snake';
  return product.groupStrip ? member.name.replace(product.groupStrip, '') : member.name;
}
function optionLabel(product) {
  if (G(product).length) return product.groupLabel || G(product).map(p => cleanGroupName(product,p)).join(' / ');
  return product.variantSummary || V(product).join(' / ');
}
function render() {
  const products = filt();
  Q('#count').textContent = products.length + (products.length === 1 ? ' pieza' : ' piezas');
  Q('#grid').innerHTML = products.map(product => {
    const grouped = G(product).length, choices = grouped || V(product).length;
    return `<article class="card"><button class="pic" data-detail="${escapeHTML(product.sku)}" aria-label="Ver ${escapeHTML(product.name)}">${imageTag(product.image,product.name)}</button><div class="meta">${escapeHTML(product.category)}</div><div class="row"><h3>${escapeHTML(product.name)}</h3><div class="price">${priceLabel(product)}</div></div><div class="sku">${choices ? choices + (grouped ? ' modelos · ' : ' opciones · ') : escapeHTML(product.sku)}${escapeHTML(optionLabel(product))}</div><div class="buttons"><button class="add" data-add="${escapeHTML(product.sku)}">${choices ? 'Elegir opción' : 'Agregar al carrito'}</button><button class="view" data-detail="${escapeHTML(product.sku)}" aria-label="Ver ${escapeHTML(product.name)}">Ver</button></div></article>`;
  }).join('') || '<p class="empty-results">No encontramos piezas con esos filtros. Probá otra búsqueda.</p>';
}
function quickAdd(sku) {
  const product = P.find(p => p.sku === sku);
  if (!product) return;
  if (G(product).length || V(product).length) return detail(sku);
  add(product);
}
function setGroupChoice(product) {
  Q('#mpr').innerHTML = priceLabel(product, true);
  Q('#msku').textContent = product.sku;
  Q('#mmat').textContent = product.material || 'Consultar'; Q('#mst').textContent = product.stock || 'Consultar';
  Q('#mp').innerHTML = imageTag(product.image, product.name, '(max-width: 850px) 100vw, 50vw', false);
}
function detail(sku) {
  active = P.find(p => p.sku === sku); if (!active) return;
  Q('#stoneColorBlock')?.remove();
  const members = G(active), variants = V(active), selected = members.length ? members[0] : active;
  Q('#mcat').textContent = active.category; Q('#mn').textContent = active.name; setGroupChoice(selected);
  Q('#vb').hidden = !(members.length || variants.length);
  const select = Q('#v');
  if (members.length) {
    Q('#vb label').textContent = active.groupSelectLabel || 'Elegí el modelo';
    select.innerHTML = members.map(p => `<option value="${escapeHTML(p.sku)}">${escapeHTML(cleanGroupName(active,p))} — ${M(sale(p))}</option>`).join('');
    select.onchange = () => setGroupChoice(P.find(p => p.sku === select.value));
    Q('#ma').onclick = () => add(P.find(p => p.sku === select.value));
  } else {
    Q('#vb label').textContent = active.variantLabel || 'Elegí una opción';
    select.innerHTML = variants.map(v => `<option>${escapeHTML(v)}</option>`).join('');
    select.onchange = () => {Q('#mp').innerHTML = imageTag(imageFor(active,select.value), active.name, '(max-width: 850px) 100vw, 50vw', false);};
    Q('#ma').onclick = () => add(active, variants.length ? select.value : '');
  }
  if (active.stoneCollection) setupStones(active);
  setPanel(Q('#m')); Q('#m').scrollTop = 0;
}
function setupStones(collection) {
  const block = document.createElement('div'); block.id = 'stoneColorBlock'; block.className = 'variant-block';
  block.innerHTML = '<label for="stoneColor">Elegí el color</label><select id="stoneColor">' + collection.colors.map(c => `<option>${escapeHTML(c)}</option>`).join('') + '</select>';
  Q('#vb').before(block); Q('#vb label').textContent = 'Elegí la pieza';
  function choosePiece() {
    const product = P.find(p => p.sku === Q('#v').value); setGroupChoice(product);
    Q('#mp').innerHTML = imageTag(collection.colorPhotos[Q('#stoneColor').value], 'Colección de piedras · ' + Q('#stoneColor').value, '(max-width: 850px) 100vw, 50vw', false);
  }
  function chooseColor() {
    const color = Q('#stoneColor').value, previous = Q('#v').value;
    Q('#v').innerHTML = G(collection).filter(p => V(p).includes(color)).map(p => `<option value="${escapeHTML(p.sku)}">${escapeHTML(p.name)} — ${M(sale(p))}</option>`).join('');
    if ([...Q('#v').options].some(option => option.value === previous)) Q('#v').value = previous;
    choosePiece();
  }
  Q('#stoneColor').onchange = chooseColor; Q('#v').onchange = choosePiece;
  Q('#ma').onclick = () => add(P.find(p => p.sku === Q('#v').value), Q('#stoneColor').value); chooseColor();
}
function draw() {
  const summary = core.summarize(cart, P, config.promotionRate, config.maxQuantity);
  Q('#items').innerHTML = summary.lines.map(({cartKey, product, variant, quantity, unitPrice}) => `<div class="ci">${imageTag(imageFor(product,variant),product.name,'72px')}<div><div class="sku">${escapeHTML(product.sku)}</div><h4>${escapeHTML(product.name)}</h4>${variant ? `<div class="meta">${escapeHTML(variant)}</div>` : ''}<div class="price">${M(unitPrice)} <del>${M(product.price)}</del></div><div class="q"><button aria-label="Quitar uno" data-qty="-1" data-key="${escapeHTML(cartKey)}">−</button><span>${quantity}</span><button aria-label="Agregar uno" data-qty="1" data-key="${escapeHTML(cartKey)}" ${quantity >= config.maxQuantity ? 'disabled' : ''}>+</button></div></div><button class="x" aria-label="Eliminar ${escapeHTML(product.name)}" data-remove="${escapeHTML(cartKey)}">×</button></div>`).join('') || '<p class="empty-cart">Tu carrito está vacío. Agregá una pieza para comenzar.</p>';
  Q('#n').textContent = summary.count; Q('#total').textContent = M(summary.total); Q('#savings').textContent = M(summary.savings); Q('#wa').disabled = !summary.lines.length;
}
function checkout() {
  cart = core.sanitize(cart, P, config.maxQuantity);
  const summary = core.summarize(cart, P, config.promotionRate, config.maxQuantity);
  if (!summary.lines.length) {draw(); return announce('Agregá una pieza para preparar tu pedido.');}
  const name = Q('#orderName'), delivery = Q('input[name="delivery"]:checked'), invoice = Q('#invoice').checked;
  if (!name.value.trim()) {name.focus(); return announce('Ingresá a nombre de quién se realiza el pedido.');}
  if (!delivery) {Q('input[name="delivery"]').focus(); return announce('Elegí una forma de entrega.');}
  if (invoice) {
    for (const id of ['billName','ruc']) if (!Q('#' + id).value.trim()) {Q('#' + id).focus(); return announce('Para solicitar factura, ingresá nombre o razón social y RUC.');}
    if (!Q('#billEmail').checkValidity()) {Q('#billEmail').reportValidity(); return;}
  }
  const message = core.message(summary, {name:name.value, delivery:delivery.value, invoice, billName:Q('#billName').value, ruc:Q('#ruc').value, phone:Q('#billPhone').value, email:Q('#billEmail').value, promoConsent:Q('#promoConsent').checked}, config.promotionRate, M);
  window.open('https://wa.me/' + config.whatsapp + '?text=' + encodeURIComponent(message), '_blank', 'noopener,noreferrer');
}
Q('#grid').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button?.dataset.detail) detail(button.dataset.detail); else if (button?.dataset.add) quickAdd(button.dataset.add);
});
Q('#items').addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  const cartKey = button.dataset.key || button.dataset.remove, action = button.dataset.qty;
  if (action) qty(cartKey, Number(action)); else if (button.dataset.remove) {delete cart[cartKey]; save();}
  const replacement = [...Q('#items').querySelectorAll('button')].find(b => b.dataset.key === cartKey && b.dataset.qty === action && !b.disabled);
  (replacement || Q('#xd')).focus({preventScroll:true});
});
document.addEventListener('keydown', event => {
  if (!openPanel) return;
  if (event.key === 'Escape') {event.preventDefault(); closeAll(); return;}
  if (event.key !== 'Tab') return;
  const focusable = [...openPanel.querySelectorAll('button:not([disabled]), input:not([disabled]), select, a[href], [tabindex="0"]')].filter(el => el.getClientRects().length && !el.closest('[hidden]'));
  const first = focusable[0], last = focusable.at(-1);
  if (event.shiftKey && (document.activeElement === first || !openPanel.contains(document.activeElement))) {event.preventDefault(); last?.focus();}
  else if (!event.shiftKey && (document.activeElement === last || !openPanel.contains(document.activeElement))) {event.preventDefault(); first?.focus();}
});
[...new Set(P.filter(p => !p.hidden).map(p => p.category))].sort().forEach(category => {const option = document.createElement('option'); option.textContent = category; Q('#c').append(option);});
Q('#s').oninput = () => render(); Q('#c').onchange = () => render(); Q('#sort').onchange = () => render();
Q('#bag').onclick = openD; Q('#xd').onclick = closeD; Q('#xm').onclick = closeM; Q('#o').onclick = closeAll; Q('#wa').onclick = checkout;
Q('#invoice').onchange = event => {Q('#invoiceFields').classList.toggle('on',event.target.checked); Q('#invoiceFields').hidden = !event.target.checked;};
document.querySelectorAll('[data-promotion-percent]').forEach(element => {element.textContent = percent + '%';});
document.querySelectorAll('[data-whatsapp]').forEach(element => {element.href = 'https://wa.me/' + config.whatsapp;});
render(); draw();
if (initial.recovered) announce('Actualizamos tu carrito: se quitaron opciones antiguas o datos no válidos. Revisá tu selección antes de continuar.');
