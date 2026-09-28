// Generate the two demo tile sets (flat top-down + isometric) from the
// existing praline tiles via image-edit, so each candy keeps its identity.
//
//   Set A "Dall'alto":  latte + caramello re-rendered from directly above.
//   Set B "Isometrica": the other 6 re-rendered from a 35° elevated angle.
//
// Input tiles are composited onto white (edit model works better on full
// images); outputs land in raw_edit/ and are keyed later by
// make_praline_tiles.py.
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// sharp not needed — use pure buffer ops via child_process python later.
import { execFileSync } from 'child_process';

const FLAVORS = [
  { i: 0, name: 'lampone' }, { i: 1, name: 'limone' },
  { i: 2, name: 'lime' }, { i: 3, name: 'latte' },
  { i: 4, name: 'arancio' }, { i: 5, name: 'menta' },
  { i: 6, name: 'fondente' }, { i: 7, name: 'caramello' },
];

const FLAT_FIX = [3, 7];      // currently angled -> re-render from above
const ISO_FIX = [0, 1, 2, 4, 5, 6]; // currently flat -> re-render angled

const PROMPT_FLAT = (name) =>
  `Re-render this exact ${name} candy photographed from DIRECTLY ABOVE, a perfect top-down orthographic flat-lay view. Only the top surface is visible: no side faces, no visible thickness or height, the rounded-square outline stays perfectly symmetric like a sticker seen straight down. Keep the identical candy: same color, same embossed motif, same glossy chocolate finish, same soft specular highlight from the top-left. Single candy perfectly centered on a pure white background, filling about 85% of the frame, no props, no other objects, photorealistic studio product shot.`;

const PROMPT_ISO = (name) =>
  `Re-render this exact ${name} candy photographed from an elevated three-quarter angle about 35 degrees above it, an isometric view where the top surface is slightly foreshortened and the front and side faces are clearly visible, showing the candy's substantial 3D thickness like a chocolate bonbon lifted from a gift box. Keep the identical candy: same color, same embossed motif on top, same glossy finish. Strong directional studio light from the top-left, side faces falling into soft shadow. Single candy perfectly centered on a pure white background, filling about 85% of the frame, no props, no other objects, photorealistic product shot.`;

function tileOnWhite(src) {
  // composite transparent 256 tile onto 1024 white canvas via python/PIL
  const out = src.replace(/\.png$/, '-onwhite.png').replace('public/textures/', 'raw_edit/in-');
  execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open('${src}').convert('RGBA')
im = im.resize((820, 820), Image.LANCZOS)
c = Image.new('RGB', (1024, 1024), (255, 255, 255))
c.paste(im, ((1024-820)//2, (1024-820)//2), im)
c.save('${out}')
`]);
  return out;
}

async function edit(zai, prompt, imgPath, outPath, tries = 3) {
  for (let a = 1; a <= tries; a++) {
    try {
      const b64 = fs.readFileSync(imgPath).toString('base64');
      const res = await zai.images.generations.edit({
        prompt,
        images: [{ url: `data:image/png;base64,${b64}` }],
        size: '1024x1024',
      });
      const data = res?.data?.[0]?.base64;
      if (!data) throw new Error('empty response');
      fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
      console.log(`OK ${outPath}`);
      return true;
    } catch (e) {
      console.error(`  attempt ${a} failed: ${e.message}`);
      if (a < tries) await new Promise((r) => setTimeout(r, 1500 * a));
    }
  }
  return false;
}

async function main() {
  fs.mkdirSync('raw_edit', { recursive: true });
  const zai = await ZAI.create();
  const jobs = [];
  for (const f of FLAVORS) {
    const src = `public/textures/praline-${f.i}-${f.name}.png`;
    if (FLAT_FIX.includes(f.i)) {
      jobs.push({ src, prompt: PROMPT_FLAT(f.name), out: `raw_edit/flat-${f.i}-${f.name}.png` });
    }
    if (ISO_FIX.includes(f.i)) {
      jobs.push({ src, prompt: PROMPT_ISO(f.name), out: `raw_edit/iso-${f.i}-${f.name}.png` });
    }
  }
  let done = 0;
  for (const j of jobs) {
    const inW = tileOnWhite(j.src);
    if (await edit(zai, j.prompt, inW, j.out)) done++;
    else console.error(`FAILED ${j.out}`);
  }
  console.log(`\n${done}/${jobs.length} edits succeeded`);
  if (done < jobs.length) process.exitCode = 2;
}

main();
