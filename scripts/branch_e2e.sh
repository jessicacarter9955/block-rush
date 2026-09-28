#!/bin/bash
# E2E test del branch retention/monetization (agent-browser CLI).
# Uso: bash scripts/branch_e2e.sh
set -e
cd /home/z/my-project
SHOT=download/branch-test
mkdir -p $SHOT

# helper: eval con output compatto
ev() { agent-browser eval "$1" 2>&1 | tail -1; }
wait_ms() { sleep $(awk "BEGIN{print $1/1000}"); }

# installa l'helper drag asincrono nel window (con attese tra gli eventi)
agent-browser eval "window.__drag = async (slot, r, c) => {
  const tray = window.__bbTest.getTray();
  const p = tray[slot];
  if (!p) return 'slot ' + slot + ' empty';
  const X = [196.5, 539.5, 883.5][slot];
  const dx = 60 + c * 120 + p.w * 60;
  const dy = 351 + r * 120 + 200 + p.h * 60;
  const el = [...document.querySelectorAll('div')].filter(d => d.style.width === '1080px').find(d => d.getBoundingClientRect().height > 300);
  const rect = el.getBoundingClientRect();
  const sx = rect.width / 1080, sy = rect.height / 1920;
  const cx = x => rect.left + x * sx, cy = y => rect.top + y * sy;
  const opts = (x, y) => ({ bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true });
  document.elementFromPoint(cx(X), cy(1626)).dispatchEvent(new PointerEvent('pointerdown', opts(cx(X), cy(1626))));
  await new Promise(res => setTimeout(res, 200));
  for (const k of [0.3, 0.6, 1]) {
    document.dispatchEvent(new PointerEvent('pointermove', opts(cx(X + (dx - X) * k), cy(1626 + (dy - 1626) * k))));
    await new Promise(res => setTimeout(res, 120));
  }
  document.dispatchEvent(new PointerEvent('pointerup', opts(cx(dx), cy(dy))));
  return 'placed w' + p.w + 'x' + p.h + ' at r' + r + 'c' + c;
};" >/dev/null 2>&1

echo "=== 1. Stato iniziale ==="
ev "JSON.stringify(window.__bbTest.debug())"

echo "=== 2. Piazza pezzo slot0 in r0c0 (drag async) ==="
ev "window.__drag(0, 0, 0)"
wait_ms 900
ev "JSON.stringify(window.__bbTest.debug())"
agent-browser screenshot $SHOT/e2e-01-placed.png >/dev/null 2>&1

echo "=== 3. Forza game over → revive ==="
ev "window.__bbTest.forceGameOver()"
wait_ms 1200
ev "JSON.stringify(window.__bbTest.debug())"
agent-browser screenshot $SHOT/e2e-02-revive.png >/dev/null 2>&1

echo "=== 4. Clicca GUARDA ANNUNCIO E CONTINUA (design 540,1390) ==="
ev "(() => {
  const el = [...document.querySelectorAll('div')].filter(d => d.style.width === '1080px').find(d => d.getBoundingClientRect().height > 300);
  const rect = el.getBoundingClientRect();
  const sx = rect.width / 1080, sy = rect.height / 1920;
  const t = document.elementFromPoint(rect.left + 540 * sx, rect.top + 1390 * sy);
  if (!t) return 'no target';
  t.click();
  return 'clicked revive-ad btn';
})()"
wait_ms 800
agent-browser screenshot $SHOT/e2e-03-ad-rewarded.png >/dev/null 2>&1

echo "=== 5. Attendi countdown ad (5s) e RITIRA ==="
wait_ms 5300
ev "(() => { const els = [...document.querySelectorAll('div')].filter(d => (d.textContent||'').includes('RITIRA') && d.style.cursor === 'pointer'); if (els.length) { els[0].click(); return 'ritirato'; } return 'RITIRA non trovato'; })()"
wait_ms 1000
ev "JSON.stringify(window.__bbTest.debug())"
agent-browser screenshot $SHOT/e2e-04-revived.png >/dev/null 2>&1

echo "=== 6. Forza game over di nuovo → salta revive (non ora) ==="
ev "window.__bbTest.forceGameOver()"
wait_ms 1200
ev "(() => { const els = [...document.querySelectorAll('div')].filter(d => (d.textContent||'').trim() === 'non ora' && d.style.cursor === 'pointer'); if (els.length) { els[0].click(); return 'skippato'; } return 'non ora non trovato'; })()"
wait_ms 1500
ev "JSON.stringify(window.__bbTest.debug())"
agent-browser screenshot $SHOT/e2e-05-gameover.png >/dev/null 2>&1

echo "=== 7. Stato progress finale ==="
ev "(() => { const p = JSON.parse(localStorage.getItem('bb-progress')).state; return JSON.stringify({ gems: p.gems, games: p.stats.gamesPlayed, best: p.stats.bestScore, pieces: p.stats.totalPieces, unlocked: Object.keys(p.unlocked) }); })()"
echo "=== E2E DONE ==="
