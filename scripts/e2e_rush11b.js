// E2E Block Rush 1:1 — clean mode: home + gameplay con pezzi piazzati dal bot
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

    await page.goto('http://localhost:3000/play?version=rush&clean=1', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.removeItem('bb-play-version');
      localStorage.removeItem('bb-skin-v1');
    });
    await page.goto('http://localhost:3000/play?version=rush&clean=1', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // HOME pulita
    await page.screenshot({ path: '/home/z/my-project/download/rush11-e2e-home-clean.png' });

    // verifica DOM: bottoni circolari home con immagini
    const homeBtns = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('img')].map((i) => i.getAttribute('src'));
      return imgs.filter((s) => s && s.includes('/textures/rush/'));
    });
    console.log('RUSH ASSETS IN DOM (home):', JSON.stringify(homeBtns));

    // avvia il gioco (click sul play) e fai giocare il bot ~12s per piazzare pezzi
    await page.mouse.click(540, 1390);
    await page.waitForTimeout(800);
    const started = await page.evaluate(() => !!window.__BB__);
    if (started) {
      // bot via ?bot=1 non passato: guida manuale — usa bot interno se esposto
      // il /play ha il bot quando ?bot=1; qui simuliamo con drag semplici:
      // prendi il primo pezzo e trascinalo al centro della board
      const bb = await page.evaluate(() => {
        const b = window.__BB__;
        return { tray: b.getTray(), board: b.getBoard() };
      });
      console.log('tray pieces:', bb.tray.filter(Boolean).length);
    }
    await page.screenshot({ path: '/home/z/my-project/download/rush11-e2e-game-clean.png' });

    // con bot=1 in una seconda pagina per una board piena
    const page2 = await ctx.newPage();
    page2.on('pageerror', (e) => errors.push(String(e)));
    await page2.goto('http://localhost:3000/play?version=rush&clean=1&bot=1&speed=3', { waitUntil: 'networkidle' });
    await page2.evaluate(() => {
      localStorage.removeItem('bb-play-version');
      localStorage.removeItem('bb-skin-v1');
    });
    await page2.goto('http://localhost:3000/play?version=rush&clean=1&bot=1&speed=3', { waitUntil: 'networkidle' });
    await page2.waitForTimeout(1200);
    // clicca play per far partire il bot
    await page2.mouse.click(540, 1390);
    await page2.waitForTimeout(15000);
    const st = await page2.evaluate(() => {
      const b = window.__BB__;
      return { score: b.getScore(), board: b.getBoard().filter(Boolean).length };
    });
    console.log('BOT STATE:', JSON.stringify(st));
    await page2.screenshot({ path: '/home/z/my-project/download/rush11-e2e-game-bot.png' });
    console.log('ERRORS:', JSON.stringify(errors));
  } finally {
    await browser.close();
  }
})();
