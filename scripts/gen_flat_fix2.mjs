// Plan B for flat latte + caramello: start from CONFIRMED-FLAT tiles
// (lampone / limone) and edit only surface attributes (color + motif),
// keeping view/shape/lighting identical. Flatness is inherited from input.
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

const JOBS = [
  {
    base: 'public/textures/praline-0-lampone.png',
    out: 'raw_edit/recolor-3-latte.png',
    prompt: `Keep this candy EXACTLY as it is — same perfect top-down flat view, same rounded-square silhouette, same lighting from top-left, same soft shadow, same glossy finish, same white background, same framing. Change ONLY the color and the surface pattern: make it warm milk-chocolate brown (medium brown, lighter than dark chocolate) and replace the raised bumps with an embossed woven basket-weave pattern pressed into the surface. Still a perfectly flat top-down view of a milk chocolate praline.`,
  },
  {
    base: 'public/textures/praline-1-limone.png',
    out: 'raw_edit/recolor-7-caramello.png',
    prompt: `Keep this candy EXACTLY as it is — same perfect top-down flat view, same rounded-square silhouette, same quilted diamond lattice pattern, same lighting from top-left, same soft shadow, same glossy finish, same white background, same framing. Change ONLY the color: make it warm golden caramel tan (soft caramel toffee color, like milk caramel) instead of yellow. Still a perfectly flat top-down view of a caramel candy.`,
  },
];

async function main() {
  const zai = await ZAI.create();
  for (const j of JOBS) {
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
