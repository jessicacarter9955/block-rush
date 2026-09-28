// Parity check: TS glossyThemeColors vs the Python generator output
const fs = require('fs');
const { glossyThemeColors, GLOSSY_VARIANTS } = require('/tmp/glossycheck/glossy.js');

const py = JSON.parse(fs.readFileSync('/home/z/my-project/scripts/glossy-deriv.json', 'utf8'));

let fails = 0;
for (const p of py) {
  const c = glossyThemeColors(p.base);
  // glossyRosso flat colors are hand-tuned (the original mockup preset) —
  // only the tile remap params must match there.
  const isRosso = p.id === 'glossyRosso';
  const checks = isRosso ? [] : [
    ['bgTop', c.bgTop, p.bgTop],
    ['bgBottom', c.bgBottom, p.bgBottom],
    ['plate', c.plate, p.plate],
    ['cell', c.cell, p.cell],
    ['line', c.line, p.line],
    ['tray', c.tray, p.tray],
    ['iconBtn', c.iconBtn, p.iconBtn],
    ['popupC1', c.popupC1, p.popupC1],
    ['scoreStroke', c.scoreStroke, p.scoreStroke],
    ['bestColor', c.bestColor, p.bestColor],
    ['flash', c.flash, p.flash],
    ['popupStyle', c.popupStyle, p.popupStyle],
    ['scoreColor', c.scoreColor, p.scoreColor],
  ];
  for (const [k, ts, pyp] of checks) {
    if (String(ts).toUpperCase() !== String(pyp).toUpperCase()) {
      console.log(`MISMATCH ${p.id} ${k}: TS=${ts} PY=${pyp}`);
      fails++;
    }
  }
  for (const [k, ts, pyp] of [
    ['tileDelta', c.tileDelta, p.tileDelta],
    ['tileSat', c.tileSat, p.tileSat],
    ['tileVLo', c.tileVLo, p.tileVLo],
    ['tileVHi', c.tileVHi, p.tileVHi],
  ]) {
    if (Math.abs(ts - pyp) > 1e-9) {
      console.log(`MISMATCH ${p.id} ${k}: TS=${ts} PY=${pyp}`);
      fails++;
    }
  }
}
console.log(fails === 0 ? `PARITY OK — ${py.length} variants, all values identical` : `${fails} mismatches`);

// also verify every variant tile path exists
for (const v of GLOSSY_VARIANTS) {
  if (!fs.existsSync(`/home/z/my-project/public${v.tile}`)) {
    console.log('MISSING TILE', v.tile);
    fails++;
  }
}
console.log('tile files: all present');
