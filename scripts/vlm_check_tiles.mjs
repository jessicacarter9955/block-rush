// VLM check — which demo tiles are top-down vs isometric, and style reference.
// Usage: node scripts/vlm_check_tiles.mjs <image.png> <question>
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const [,, imgPath, question] = process.argv;
if (!imgPath || !question) {
  console.error('Usage: node vlm_check_tiles.mjs <image.png> <question>');
  process.exit(1);
}

const b64 = fs.readFileSync(imgPath).toString('base64');
const zai = await ZAI.create();
const res = await zai.chat.completions.createVision({
  model: 'glm-4.6v',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
        { type: 'text', text: question },
      ],
    },
  ],
  thinking: { type: 'disabled' },
});
console.log(res.choices[0].message.content);
