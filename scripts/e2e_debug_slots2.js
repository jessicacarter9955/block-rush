// Debug v2: replicate the smoothed slot-band + hump logic with full logging.
(async () => {
  const im = document.querySelector('img[alt="screenshot"]');
  if (!im) return 'no img';
  const k = Math.min(1, 480 / Math.max(im.naturalWidth, im.naturalHeight));
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
  const smooth = (prof, box) => {
    const out = new Float32Array(prof.length);
    for (let i = 0; i < prof.length; i++) {
      let s = 0;
      for (let j = i - box; j <= i + box; j++) s += prof[Math.max(0, Math.min(prof.length-1, j))];
      out[i] = s / (2*box+1);
    }
    return out;
  };
  const band = (prof, len, thr) => {
    let best = null, s = -1;
    for (let i = 0; i <= len; i++) {
      const v = i < len ? prof[i] : 0;
      if (v > thr && s < 0) s = i;
      else if (v <= thr && s >= 0) { if (!best || i-s > best[1]-best[0]) best = [s, i]; s = -1; }
    }
    return best;
  };
  const rowS = smooth(rowSlot, 6), colS = smooth(colSlot, 6);
  const rowBand = band(rowS, h, w*0.15), colBand = band(colS, w, h*0.15);
  // profile samples across the board zone
  const profAt = (y) => Math.round(rowSlot[y]) + '/' + Math.round(rowS[y]);
  const samples = {};
  for (const y of [115, 120, 130, 140, 160, 200, 223, 250, 300, 330]) samples['y'+y] = profAt(y);
  const colAt = (x) => Math.round(colSlot[x]) + '/' + Math.round(colS[x]);
  for (const x of [40, 46, 60, 100, 135, 180, 222, 240]) samples['x'+x] = colAt(x);
  return JSON.stringify({
    rowBand, colBand, rowThr: Math.round(w*0.15), colThr: Math.round(h*0.15),
    rowMax: Math.round(Math.max(...rowSlot)), colMax: Math.round(Math.max(...colSlot)),
    samples,
  });
})()
