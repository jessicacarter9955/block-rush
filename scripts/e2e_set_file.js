// E2E helper: set a File on the extractor's hidden input via DataTransfer,
// then read back state. Run with: agent-browser eval "$(cat scripts/e2e_set_file.js)"
(async () => {
  const inp = document.getElementById('extractor-file-input');
  if (!inp) return 'input not found';
  // fetch the real screenshot from the uploads folder is not served — use a
  // data URL built from the page's own bundled tile as fallback? No: the E2E
  // needs the FULL screenshot. It is not in /public. Instead we synthesize a
  // screenshot-like canvas: 8x8 grid of the 8 candy colors with blue bg.
  const colors = ['#C42E49','#ECB020','#636F02','#4D1902','#E15202','#3A1302','#02A07E','#C23C54'];
  const cell = 144, W = cell*8+200, H = cell*8+400;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#253064'; ctx.fillRect(0,0,W,H);
  // empty cells dark blue
  ctx.fillStyle = '#061B55';
  for (let j=0;j<8;j++) for (let i=0;i<8;i++) ctx.fillRect(100+i*cell, 200+j*cell, cell-4, cell-4);
  // candies: a 3-wide strip at cols 4-6 with the 8 colors (like the real shot)
  for (let j=0;j<8;j++) {
    const c = colors[j % colors.length];
    ctx.fillStyle = c;
    for (let i=3;i<6;i++) {
      ctx.beginPath();
      ctx.roundRect(100+i*cell+4, 200+j*cell+4, cell-12, cell-12, 14);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.roundRect(100+i*cell+14, 200+j*cell+12, cell-60, cell-70, 10);
      ctx.fill();
      ctx.fillStyle = c;
    }
  }
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const f = new File([blob], 'synth-shot.png', {type:'image/png'});
  const dt = new DataTransfer();
  dt.items.add(f);
  inp.files = dt.files;
  inp.dispatchEvent(new Event('change', {bubbles:true}));
  return 'file set, size ' + blob.size;
})()
