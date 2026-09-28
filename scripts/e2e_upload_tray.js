(async () => {
  const inp = Array.from(document.querySelectorAll('input[type=file]'))
    .find(e => e.accept.startsWith('image/') && e.closest('aside, [class*=panel], [class*=Panel]'));
  if (!inp) return 'input non trovato';
  const res = await fetch('/textures/vassoio-demo.png');
  const blob = await res.blob();
  const f = new File([blob], 'vassoio-demo.png', { type: 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(f);
  inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 900));
  const raw = localStorage.getItem('bb-skin-studio');
  const s = JSON.parse(raw);
  const skin = s?.state?.skin ?? s?.skin;
  return 'tray.img=' + (skin?.tray?.img ? String(skin.tray.img).slice(0, 40) : 'null');
})()