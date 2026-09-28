// Fresh generation for the 2 flat tiles that image-edit failed to flatten
// (latte, caramello). Same approach that produced the original 6 flat tiles.
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const JOBS = [
  {
    out: 'raw_edit/gen-flat-3-latte.png',
    prompt: `Flat lay product photograph taken from DIRECTLY ABOVE, perfect orthographic top-down view with zero perspective: a single milk chocolate praline candy, square shape with rounded corners (squircle), embossed woven basket-weave pattern pressed into its glossy milk-chocolate top surface, warm medium brown color, soft specular highlight on the upper-left, gentle soft shadow directly under the candy, perfectly centered on a pure white seamless background, candy fills about 85% of the frame, photorealistic studio product shot, no other objects, no props, no visible side faces, no 3D thickness, it must look like a flat sticker seen straight from above.`,
  },
  {
    out: 'raw_edit/gen-flat-7-caramello.png',
    prompt: `Flat lay product photograph taken from DIRECTLY ABOVE, perfect orthographic top-down view with zero perspective: a single soft caramel toffee candy, square shape with rounded corners (squircle), quilted diamond lattice pattern embossed on its glossy golden caramel top surface, warm golden tan color, soft specular highlight on the upper-left, gentle soft shadow directly under the candy, perfectly centered on a pure white seamless background, candy fills about 85% of the frame, photorealistic studio product shot, no other objects, no props, no visible side faces, no 3D thickness, no cake base, it must look like a flat sticker seen straight from above.`,
  },
];

async function main() {
  const zai = await ZAI.create();
  for (const j of JOBS) {
    for (let a = 1; a <= 3; a++) {
      try {
        const res = await zai.images.generations.create({ prompt: j.prompt, size: '1024x1024' });
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
