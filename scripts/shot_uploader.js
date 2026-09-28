// Screenshot di verifica della pagina /uploader (mobile + desktop)
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  try {
    // mobile (l'utente è su telefono)
    const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await m.goto('http://localhost:3000/uploader', { waitUntil: 'networkidle' });
    await m.screenshot({ path: '/home/z/my-project/download/uploader-mobile.png', fullPage: true });
    // console error check
    const errors = [];
    m.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    // desktop
    const d = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const dErrors = [];
    d.on('console', (msg) => { if (msg.type() === 'error') dErrors.push(msg.text()); });
    await d.goto('http://localhost:3000/uploader', { waitUntil: 'networkidle' });
    await d.screenshot({ path: '/home/z/my-project/download/uploader-desktop.png', fullPage: true });

    // studio TopBar: link presente?
    await d.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    const hasLink = await d.locator('a[href="/uploader"]').count();
    await d.screenshot({ path: '/home/z/my-project/download/uploader-link-studio.png' });
    console.log(JSON.stringify({ hasLink, errors: [...errors, ...dErrors] }));
  } finally {
    await browser.close();
  }
})();
