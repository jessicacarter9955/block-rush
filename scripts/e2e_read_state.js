(() => {
  const raw = localStorage.getItem('bb-skin-studio');
  if (!raw) return 'no state';
  const s = JSON.parse(raw);
  const skin = s?.state?.skin ?? s?.skin;
  return JSON.stringify({
    topKeys: Object.keys(s),
    bg: skin?.background ? { img: skin.background.img ? String(skin.background.img).slice(0, 40) : null, fit: skin.background.imgFit, dim: skin.background.imgDim } : null,
  });
})()