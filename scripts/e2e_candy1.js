// E2E: apply candy-rosso preset → home screen → check premium gold icons + theme
const { agentBrowser } = require('agent-browser');

async function main() {
  const b = await agentBrowser.launch();
  const page = await b.newPage('http://localhost:3000');
  await page.waitFor(2500);

  // read current preset + apply candy-rosso via the store (robust vs UI refs)
  const applied = await page.evaluate(() => {
    const st = window.__bbStudio;
    return null;
  }).catch(() => null);

  // use the UI: click the preset chip named Rosso (title attr contains 'Rosso')
  const snap1 = await page.snapshot('-i -c');
  console.log('--- top bar buttons with Rosso/Viola titles:');
  const m = snap1.match(/@[0-9]+ button[^\n]*"(?:[^"]*Rosso[^"]*|Rosso)"/g);
  console.log(m ? m.slice(0, 5).join('\n') : 'no Rosso title match, searching by text...');

  await page.screenshot({ path: 'download/e2e-candy/00-start.png' });

  // find preset button by title text
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find((x) => (x.getAttribute('title') || '').startsWith('Caramella rosso'));
    if (b) { b.click(); return true; }
    return false;
  });
  console.log('clicked Rosso preset:', clicked);
  await page.waitFor(1200);
  await page.screenshot({ path: 'download/e2e-candy/01-rosso-home.png' });

  // verify store state
  const state = await page.evaluate(() => {
    const raw = localStorage.getItem('bb-skin-studio');
    const parsed = JSON.parse(raw);
    const s = parsed.state.skin;
    return {
      presetId: parsed.state.presetId,
      bgImg: s.background.img,
      bgFit: s.background.imgFit,
      cellImg: s.board.cellImg,
      trayImg: s.tray.img,
      iconVariants: s.iconBtn.variants,
      iconBg: s.iconBtn.bg,
      blockStyle: s.blocks.style,
      perColor0: s.blocks.img.perColor?.[0],
    };
  });
  console.log('STATE:', JSON.stringify(state, null, 1));

  // game screen
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find((x) => x.textContent.trim() === 'GIOCO');
    if (b) b.click();
  });
  await page.waitFor(900);
  await page.screenshot({ path: 'download/e2e-candy/02-rosso-game.png' });

  // console errors?
  const errors = await page.consoleErrors();
  console.log('console errors:', errors.length ? errors.slice(0, 5) : 'none');

  await b.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
