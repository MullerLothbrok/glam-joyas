document.querySelectorAll('.load-map').forEach(button => button.addEventListener('click', () => {
  const box=button.closest('.map-box');
  const iframe=document.createElement('iframe');
  iframe.title='Mapa de referencia de Glam Joyas en Encarnación';
  iframe.src='https://www.google.com/maps?q='+box.dataset.mapQuery+'&output=embed';
  iframe.referrerPolicy='no-referrer-when-downgrade';
  iframe.loading='eager';
  iframe.allowFullscreen=true;
  const cover=box.querySelector('.map-cover');
  const link=document.createElement('a');
  link.href='https://www.google.com/maps/search/?api=1&query='+box.dataset.mapQuery;
  link.target='_blank';
  link.rel='noopener';
  link.textContent='Abrir ubicación en Google Maps ↗';
  button.replaceWith(link);
  iframe.addEventListener('load',()=>{cover.hidden=true;iframe.style.visibility='visible';});
  iframe.style.visibility='hidden';
  box.append(iframe);
}));

