function showAdded(product, variant = '') {
  let toast = document.querySelector('#cartToast');
  if (!toast) {
    toast = document.createElement('div'); toast.id = 'cartToast'; toast.className = 'cart-toast';
    toast.innerHTML = '<div class="toast-check" aria-hidden="true">✓</div><div class="toast-copy"><b>Agregado al carrito</b><small></small></div><button type="button">Ver carrito</button>';
    document.body.append(toast); toast.querySelector('button').onclick = () => openD();
  }
  toast.querySelector('small').textContent = product.name + (variant ? ' · ' + variant : '');
  toast.inert = false; toast.classList.add('on');
  announce('Agregado al carrito: ' + product.name + (variant ? ', ' + variant : ''));
  clearTimeout(window.__glamToastTimer);
  window.__glamToastTimer = setTimeout(() => {toast.classList.remove('on'); toast.inert = true;}, 3500);
}
