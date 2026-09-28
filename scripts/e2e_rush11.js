// E2E Block Rush 1:1 — /play con preset rush (asset estratti), home + gameplay
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));

    // pulisce lo stato salvato e forza la versione rush
    await page.goto('http://localhost:3000/play?version=rush', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.removeItem('bb-play-version');
      localStorage.removeItem('bb-skin-v1');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // HOME (dovrebbe essere la vista iniziale)
    await page.screenshot({ path: '/home/z/my-project/download/rush11-e2e-home.png' });

    // clicca PLAY (bottone della home del gioco)
    const play = page.locator('div[style*="cursor: pointer"] img[alt="play"]').first();
    if (await play.count()) {
      await play.click({ position: { x: 312, y: 108 } });
    } else {
      // fallback: click al centro dell'area play (pos 540, 1380 ca.)
      await page.mouse.click(540, 1390);
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/home/z/my-project/download/rush11-e2e-game.png' });

    // screenshot con blocchi piazzati: aspetta che il bot/pieces appaiano
    const state = await page.evaluate(() => {
      const bb = window.__BB__;
      return bb ? { tray: bb.getTray().filter(Boolean).length, board: bb.getBoard().filter(Boolean).length } : null;
    });
    console.log('STATE:', JSON.stringify(state));
    console.log('ERRORS:', JSON.stringify(errors));
  } finally {
    await browser.close();
  }
})();
