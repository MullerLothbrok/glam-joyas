(() => {
  const tools = document.querySelector('.tools');
  const category = document.querySelector('#c');
  const panel = document.querySelector('.catalog-filters');
  const filters = document.createElement('details');
  filters.className = 'optional-filters';
  const summary = document.createElement('summary');
  summary.textContent = 'Filtros y orden';
  filters.append(summary);
  tools.after(filters);
  const order = document.createElement('label');
  order.className = 'order-control';
  order.append('Ordenar por', document.querySelector('#sort'));
  filters.append(order, panel);
  const categories = document.createElement('nav');
  categories.className = 'category-tabs';
  categories.setAttribute('aria-label', 'Categorías de joyas');
  for (const option of category.options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option.value || 'Todas';
    button.dataset.category = option.value;
    button.onclick = () => { category.value = option.value; category.dispatchEvent(new Event('change')); syncCategories(); };
    categories.append(button);
  }
  tools.before(categories);
  category.hidden = true;
  function syncCategories() {
    for (const button of categories.children) button.setAttribute('aria-pressed', String(button.dataset.category === category.value));
  }
  category.addEventListener('change', syncCategories);
  document.querySelector('#clearFilters').addEventListener('click', syncCategories);
  function syncFilterLabel() {
    const count = Number(!!document.querySelector('#priceMin').value) + Number(!!document.querySelector('#priceMax').value) + Number(!document.querySelector('[data-finish="all"]').classList.contains('active')) + Number(document.querySelector('#sort').value !== 'name');
    summary.textContent = 'Filtros y orden' + (count ? ' · ' + count + ' activos' : '');
  }
  filters.addEventListener('input', syncFilterLabel);
  filters.addEventListener('change', syncFilterLabel);
  filters.addEventListener('click', syncFilterLabel);
  syncCategories();

  const modal = document.querySelector('#m');
  const bar = document.createElement('div');
  bar.className = 'product-navigation';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'back-to-catalog';
  back.textContent = '← Volver al catálogo';
  back.onclick = closeM;
  const close = document.querySelector('#xm');
  close.classList.remove('modal-close');
  close.setAttribute('aria-label', 'Cerrar joya y volver al catálogo');
  bar.append(back, close);
  modal.prepend(bar);
  const originalDetail = detail;
  detail = function(sku) { originalDetail(sku); modal.scrollTop = 0; back.focus({preventScroll:true}); };
})();

