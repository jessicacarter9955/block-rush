// Debug slot-mask profile: band + regions structure.
(async () => {
  const im = document.querySelector('img[alt="screenshot"]');
  if (!im) return 'no img';
  const MAX = 480;
  const k = Math.min(1, MAX / Math.max(im.naturalWidth, im.naturalHeight));
  const w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(im, 0, 0, w, h);
  const D = ctx.getImageData(0, 0, w, h).data;
  const slot = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const r = D[p*4], g = D[p*4+1], b = D[p*4+2];
    if (b > r + 60 && b >= g && (r + g + b) / 3 < 55) slot[p] = 1;
  }
  const rowSlot = new Float32Array(h), colSlot = new Float32Array(w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (slot[y*w+x]) { rowSlot[y]++; colSlot[x]++; }
  const band = (prof, len, cover) => {
    const thr = cover * len; let best = null, s = -1;
    for (let i = 0; i <= len; i++) {
      const v = i < len ? prof[i] : 0;
      if (v > thr && s < 0) s = i;
      else if (v <= thr && s >= 0) { if (!best || i - s > best[1]-best[0]) best = [s, i]; s = -1; }
    }
    return best;
  };
  const rb = band(rowSlot, h, 0.22), cb = band(colSlot, w, 0.22);
  const regions = (prof, a, b, thrFrac) => {
    let mx = 0; for (let i = a; i < b; i++) mx = Math.max(mx, prof[i]);
    const thr = mx * thrFrac; const rs = []; let s = -1;
    for (let i = a; i <= b; i++) {
      const v = i < b ? prof[i] : 0;
      if (v > thr && s < 0) s = i;
      else if (v <= thr && s >= 0) { rs.push([s, i]); s = -1; }
    }
    if (s >= 0) rs.push([s, b]);
    return rs;
  };
  const rRegions = regions(rowSlot, rb[0], rb[1], 0.45).map(r => [r[0], r[1], Math.round(r[1]-r[0])]);
  const cRegions = regions(colSlot, cb[0], cb[1], 0.45).map(r => [r[0], r[1], Math.round(r[1]-r[0])]);
  return JSON.stringify({
    rowBand: [rb[0], rb[1]], colBand: [cb[0], cb[1]],
    rowCount: rRegions.length, rowRegions: rRegions,
    colCount: cRegions.length, colRegions: cRegions,
  });
})()
