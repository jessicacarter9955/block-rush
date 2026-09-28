// Debug detectGrid on the loaded screenshot: replicate the analysis with logs.
(async () => {
  const im = document.querySelector('img[alt="screenshot"]');
  if (!im) return 'no screenshot img in modal';
  const MAX = 480;
  const k = Math.min(1, MAX / Math.max(im.naturalWidth, im.naturalHeight));
  const w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(im, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  const D = id.data;
  const mask = (i) => {
    const r = D[i], g = D[i+1], b = D[i+2];
    const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
    if (mx - mn <= 55 || (r+g+b)/3 <= 45) return false;
    const gold = r-b>70 && g-b>30 && b<120 && r>150;
    const blue = b >= r-5;
    return !gold && !blue;
  };
  const yA = Math.floor(h*0.08), yB = Math.ceil(h*0.92);
  const rowProf = new Float32Array(h);
  for (let y=yA;y<yB;y++) for (let x=0;x<w;x++) if (mask((y*w+x)*4)) rowProf[y]++;
  const maxRow = Math.max(...rowProf.slice(yA,yB));
  const thr = maxRow*0.2;
  const bands = [];
  let s=-1, cnt=0;
  for (let y=yA;y<yB;y++) {
    if (rowProf[y]>thr) { if (s<0){s=y;cnt=0;} cnt+=rowProf[y]; }
    else if (s>=0) { bands.push([s,y,cnt]); s=-1; }
  }
  if (s>=0) bands.push([s,yB,cnt]);
  return JSON.stringify({w,h,yA,yB,maxRow:Math.round(maxRow),thr:Math.round(thr),
    bands: bands.map(b=>[b[0],b[1],b[1]-b[0],Math.round(b[2])])}, null, 1);
})()
