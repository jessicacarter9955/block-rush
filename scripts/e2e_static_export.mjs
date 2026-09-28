// E2E static export game-only servito su subpath (come GitHub Pages)
const { chromium } = await import('/home/z/.npm-global/lib/node_modules/playwright/index.mjs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errors = [];
  const failed = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes('localhost:3010') && r.status() >= 400 && !u.includes('favicon')) failed.push(`${r.status()} ${u.split('3010')[1]}`);
  });

  // 1) home del gioco
  await page.goto('http://localhost:3010/block-rush/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const playBtn = await page.locator('text=PLAY').count();
  const botPanel = await page.locator('text=BOT · Block Rush 1:1').count();
  const recBtn = await page.locator('text=REGISTRA IL GIOCO').count();
  const noVersions = await page.locator('text=Versioni').count();
  console.log('home: PLAY=', playBtn > 0, '| pannello BOT=', botPanel > 0, '| RECORDER=', recBtn > 0, '| senza selettore versioni=', noVersions === 0);

  // screenshot home
  await page.screenshot({ path: '/home/z/my-project/download/e2e-recorder/static-home.png' });

  // 2) gioca + bot (il bottone FALLO GIOCARE avvia anche la partita)
  await page.waitForTimeout(600);
  await page.locator('text=FALLO GIOCARE').click();
  let score = 0;
  for (let i = 0; i < 25; i++) {
    score = await page.evaluate(() => window.__BB__?.getScore?.() ?? 0);
    if (score > 0) break;
    await page.waitForTimeout(1000);
  }
  console.log('bot su static export: score =', score, score > 0 ? 'OK' : 'FAIL');
  await page.screenshot({ path: '/home/z/my-project/download/e2e-recorder/static-game.png' });

  // 3) asset chiave del preset rush nel DOM
  const imgs = await page.evaluate(() => Array.from(document.images).map((i) => i.src).filter((s) => s.includes('/textures/rush/')).length);
  const bg = await page.evaluate(() => {
    const el = document.querySelector('[data-bb-design]');
    return el ? getComputedStyle(el.querySelector('div') ?? el).backgroundImage.slice(0, 60) : '';
  });
  console.log('img rush nel DOM:', imgs, '| bg primo layer:', bg);

  console.log('richieste fallite:', failed.length === 0 ? 'ZERO' : failed.slice(0, 6));
  console.log('errori console:', errors.length === 0 ? 'ZERO' : errors.slice(0, 5));
  await browser.close();
  process.exit(errors.length === 0 && failed.length === 0 && score > 0 ? 0 : 1);
})();
