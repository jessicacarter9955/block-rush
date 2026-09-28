import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

async function main() {
  const zai = await ZAI.create();
  const img = fs.readFileSync(process.argv[2]).toString('base64');
  const r = await zai.chat.completions.create({
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/png;base64,${img}` } },
        { type: 'text', text: process.argv[3] || 'Descrivi questo screenshot in italiano, in modo sintetico e tecnico.' },
      ],
    }],
    max_tokens: 400,
  });
  console.log(r.choices[0]?.message?.content);
}
main().catch((e) => { console.error('ERRORE:', e.message); process.exit(1); });
