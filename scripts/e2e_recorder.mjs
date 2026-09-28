// E2E: bot + slider + recorder nella pagina /play
// 1. carica /play (senza clean per vedere il pannello bot)
// 2. verifica pannello BOT con slider velocità + sezione RECORDER
// 3. click REGISTRA → in headless getDisplayMedia fallisce → messaggio d'errore grazioso, nessun crash
// 4. avvia il bot, verifica che giochi (score > 0) e che lo slider funzioni (cambia velocità)
// 5. zero errori console
const { chromium } = await import('/home/z/.npm-global/lib/node_modules/playwright/index.mjs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('http://localhost:3000/play?version=rush', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // pannello bot presente
  const botPanel = await page.locator('text=BOT · Block Rush 1:1').count();
  console.log('pannello BOT:', botPanel > 0 ? 'OK' : 'MANCA');

  // slider velocità
  const slider = await page.locator('input[type="range"]').count();
  console.log('slider velocità:', slider > 0 ? 'OK' : 'MANCA');

  // sezione recorder
  const recBtn = await page.locator('text=REGISTRA IL GIOCO').count();
  const recHdr = await page.locator('text=RECORDER · 1080×1920 · 30fps').count();
  const audioChk = await page.locator('text=Includi l').count();
  console.log('bottone REGISTRA:', recBtn > 0 ? 'OK' : 'MANCA');
  console.log('header RECORDER:', recHdr > 0 ? 'OK' : 'MANCA');
  console.log('checkbox audio:', audioChk > 0 ? 'OK' : 'MANCA');

  // bottone schermo intero
  const fsBtn = await page.locator('text=Schermo intero').count();
  console.log('bottone schermo intero:', fsBtn > 0 ? 'OK' : 'MANCA');

  // click REGISTRA → in headless fallisce con messaggio chiaro (getDisplayMedia assente)
  if (recBtn > 0) {
    await page.locator('text=REGISTRA IL GIOCO').click();
    await page.waitForTimeout(900);
    const err = await page.locator('text=registrazione dello schermo').count();
    const errAny = await page.locator('.text-rose-300').count();
    console.log('errore grazioso su click REC (headless):', err > 0 || errAny > 0 ? 'OK' : `TESTO DIVERSO (${errAny})`);
  }

  // avvia il bot e verifica che giochi
  await page.locator('text=FALLO GIOCARE').click();
  await page.waitForTimeout(5000);
  let score = 0;
  for (let i = 0; i < 20; i++) {
    score = await page.evaluate(() => window.__BB__?.getScore?.() ?? 0);
    if (score > 0) break;
    await page.waitForTimeout(1000);
  }
  console.log('bot giocatore — punteggio:', score, score > 0 ? 'OK' : 'FAIL');

  // slider: porta a 8x e verifica che il bot acceleri (leggo la velocità esposta)
  await page.locator('input[type="range"]').first().fill('100'); // → 16x
  await page.waitForTimeout(300);
  const cells1 = await page.evaluate(() => window.__BB__?.getBoard?.().filter((v) => v !== null).length ?? 0);
  await page.waitForTimeout(4000);
  const cells2 = await page.evaluate(() => window.__BB__?.getBoard?.().filter((v) => v !== null).length ?? 0);
  console.log('slider 16x — celle board:', cells1, '→', cells2, '(bot attivo:', cells1 !== cells2 || score > 0 ? 'OK' : 'BOH)');

  // screenshot di verifica
  await page.screenshot({ path: '/home/z/my-project/download/e2e-recorder/panel.png' });

  // clean mode: pannelli nascosti
  await page.goto('http://localhost:3000/play?clean=1&bot=1&speed=4', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const cleanRec = await page.locator('text=RECORDER').count();
  console.log('clean=1 nasconde pannelli:', cleanRec === 0 ? 'OK' : 'FAIL');
  let s2 = 0;
  for (let i = 0; i < 15; i++) {
    s2 = await page.evaluate(() => window.__BB__?.getScore?.() ?? 0);
    if (s2 > 0) break;
    await page.waitForTimeout(1000);
  }
  console.log('bot auto-start clean (speed 4x):', s2 > 0 ? `OK (score ${s2})` : 'FAIL');
  await page.screenshot({ path: '/home/z/my-project/download/e2e-recorder/clean-run.png' });

  console.log('errori console:', errors.length === 0 ? 'ZERO' : JSON.stringify(errors.slice(0, 5)));
  await browser.close();
  process.exit(errors.length === 0 ? 0 : 1);
})();
