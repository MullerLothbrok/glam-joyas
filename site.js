(() => {
  const percent = Math.round(window.GLAM_CONFIG.promotionRate * 100);
  document.querySelectorAll('[data-promotion-percent]').forEach(element => {element.textContent = percent + '%';});
  document.querySelectorAll('[data-promotion-number]').forEach(element => {element.textContent = percent;});
  document.querySelectorAll('[data-whatsapp]').forEach(element => {element.href = 'https://wa.me/' + window.GLAM_CONFIG.whatsapp;});
})();
