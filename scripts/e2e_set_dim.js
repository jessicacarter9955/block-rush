(() => {
  const sliders = Array.from(document.querySelectorAll('input[type=range]'));
  const dim = sliders.find(s => (s.previousElementSibling?.textContent || '').includes('Scurisci') || true);
  if (!dim) return 'no slider';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(dim, '55');
  dim.dispatchEvent(new Event('input', { bubbles: true }));
  dim.dispatchEvent(new Event('change', { bubbles: true }));
  return 'dim set to ' + dim.value + ' (sliders: ' + sliders.length + ')';
})()