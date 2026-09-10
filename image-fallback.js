// Keep unavailable legacy photos readable while their originals are recovered.
document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  const placeholder = document.createElement('div');
  placeholder.className = 'ph';
  placeholder.textContent = 'Foto en actualización';
  placeholder.setAttribute('role', 'img');
  placeholder.setAttribute('aria-label', image.alt + ' · foto en actualización');
  image.replaceWith(placeholder);
}, true);

