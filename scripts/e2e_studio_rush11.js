// Verifica studio: preset rush 1:1 applicato + campi editor visibili
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('http://localhost:3000/?preset=rush', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/home/z/my-project/download/rush11-studio-game.png' });

    // apri l'elemento Logo nella sidebar e verifica i campi immagine
    const clicked = await page.getByText('Logo', { exact: true }).first().click().then(() => true).catch(() => false);
    await page.waitForTimeout(600);
    if (clicked) await page.screenshot({ path: '/home/z/my-project/download/rush11-studio-logo-editor.png' });

    // home screen preview
    const homeTab = page.locator('button', { hasText: /home/i }).first();
    if (await homeTab.count()) {
      await homeTab.click().catch(() => {});
      await page.waitForTimeout(800);
      await page.screenshot({ path: '/home/z/my-project/download/rush11-studio-home.png' });
    }
    console.log('ERRORS:', JSON.stringify(errors.slice(0, 5)));
  } finally {
    await browser.close();
  }
})();
