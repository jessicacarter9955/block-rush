(async () => {
  const inp = Array.from(document.querySelectorAll('input[type=file]'))
    .find(e => e.accept.startsWith('image/') && e.closest('aside, [class*=panel], [class*=Panel]'));
  if (!inp) return 'input non trovato';
  const res = await fetch('/textures/sfondo-demo.png');
  const blob = await res.blob();
  const f = new File([blob], 'sfondo-demo.png', { type: 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(f);
  inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 800));
  // leggi lo stato dal localStorage (persist zustand)
  const raw = localStorage.getItem('bb-studio');
  const s = raw ? JSON.parse(raw) : null;
  const skin = s?.state?.skin ?? s?.skin;
  return 'bg.img=' + (skin?.background?.img || 'null') + ' fit=' + skin?.background?.imgFit + ' dim=' + skin?.background?.imgDim;
})()