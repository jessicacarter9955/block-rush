// Color-accuracy fixes via recolor-edit (view/shape inherited from input):
//  - flat lime: currently orange -> bright lime green
//  - iso lime:  currently orange -> bright lime green
//  - flat caramello: too dark/burnt -> light golden caramel
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import { execFileSync } from 'child_process';

function tileOnWhite(src, out) {
  execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open('${src}').convert('RGBA')
im = im.resize((820, 820), Image.LANCZOS)
c = Image.new('RGB', (1024, 1024), (255, 255, 255))
c.paste(im, ((1024-820)//2, (1024-820)//2), im)
c.save('${out}')
`]);
}

const KEEP = 'Keep this candy EXACTLY as it is — same view, same silhouette, same motif pattern, same lighting, same shadow, same white background, same framing.';

const JOBS = [
  {
    base: 'public/textures/praline-2-lime.png',
    out: 'raw_edit/reclor-lime-flat.png',
    prompt: `${KEEP} Change ONLY the color: instead of orange, make it bright lime green (vivid yellow-green, like a lime candy). Keep highlights and shadows natural.`,
  },
  {
    base: 'public/textures/praline-iso-2-lime.png',
    out: 'raw_edit/reclor-lime-iso.png',
    prompt: `${KEEP} Change ONLY the color: instead of orange, make it bright lime green (vivid yellow-green, like a lime candy). Keep highlights and shadows natural.`,
  },
  {
    base: 'public/textures/praline-1-limone.png',
    out: 'raw_edit/reclor-caramello.png',
    prompt: `${KEEP} Change ONLY the color: make it light golden caramel — the warm pale amber-brown of soft milk caramel / caramel sauce (like hex C98A4B), NOT dark, NOT burnt. Keep highlights and shadows natural.`,
  },
];

async function main() {
  const zai = await ZAI.create();
  for (const j of JOBS) {
    if (fs.existsSync(j.out)) { console.log(`SKIP ${j.out} (exists)`); continue; }
    const inW = j.out.replace('.png', '-in.png');
    tileOnWhite(j.base, inW);
    for (let a = 1; a <= 3; a++) {
      try {
        const b64 = fs.readFileSync(inW).toString('base64');
        const res = await zai.images.generations.edit({
          prompt: j.prompt,
          images: [{ url: `data:image/png;base64,${b64}` }],
          size: '1024x1024',
        });
        const data = res?.data?.[0]?.base64;
        if (!data) throw new Error('empty response');
        fs.writeFileSync(j.out, Buffer.from(data, 'base64'));
        console.log(`OK ${j.out}`);
        break;
      } catch (e) {
        console.error(`  attempt ${a}: ${e.message}`);
        if (a === 3) process.exitCode = 2;
        else await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
}
main();
