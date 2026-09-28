#!/bin/bash
# E2E del layer ads provider (mock) — DisplaySlot, ×2 double gems, provider mock.
# Uso: bash scripts/ads_e2e.sh
set -e
cd /home/z/my-project
SHOT=download/ads-test
mkdir -p $SHOT

ev() { agent-browser eval "$1" 2>&1 | tail -1; }
wait_ms() { sleep $(awk "BEGIN{print $1/1000}"); }
# click a design coords dentro lo spazio 1080x1920
dclick() { agent-browser eval "(() => {
  const el = [...document.querySelectorAll('div')].filter(d => d.style.width === '1080px').find(d => d.getBoundingClientRect().height > 300);
  if (!el) return 'no-design-space';
  const rect = el.getBoundingClientRect();
  const sx = rect.width / 1080, sy = rect.height / 1920;
  const t = document.elementFromPoint(rect.left + $1 * sx, rect.top + $2 * sy);
  if (!t) return 'no-target';
  t.click();
  return 'clicked ' + $1 + ',' + $2;
})()" 2>&1 | tail -1; }

echo "=== 0. Reset stato + open ==="
agent-browser open "http://localhost:3000" >/dev/null 2>&1
wait_ms 1500
ev "localStorage.removeItem('bb-progress'); localStorage.removeItem('bb-run-save'); localStorage.removeItem('bb_ad_provider'); localStorage.removeItem('bb_applixir_key'); 'reset'"
agent-browser open "http://localhost:3000" >/dev/null 2>&1
wait_ms 2500

echo "=== 1. DisplaySlot house ads sotto il telefono (desktop) ==="
ev "(() => { const s = document.querySelector('[data-ad-slot=house-leaderboard]'); return s ? 'DisplaySlot OK · visibile=' + (getComputedStyle(s).display !== 'none') + ' · testo=' + s.textContent.slice(0,40) : 'DisplaySlot MANCANTE'; })()"
agent-browser screenshot $SHOT/01-home-display-slot.png >/dev/null 2>&1

echo "=== 2. Provider attivo (console + window) ==="
ev "(() => ({ adLog: !!window.__adLog, mockActive: typeof window.__bbTest === 'undefined' ? 'in-studio' : 'in-game' }))()"

echo "=== 3. GIOCA -> launcher -> chiudi login -> PLAY classica ==="
ev "(() => { const b = [...document.querySelectorAll('button,div')].find(e => e.textContent.trim() === 'GIOCA'); if (!b) return 'no GIOCA btn'; b.click(); return 'GIOCA clicked'; })()"
wait_ms 1200
agent-browser screenshot $SHOT/02-launcher.png >/dev/null 2>&1
# chiudi/ritira la modale login giornaliero (2 step: RITIRA -> OTTIMO!)
ev "(() => { const t = [...document.querySelectorAll('div,span')].filter(e => /^RITIRA/.test(e.textContent.trim()) && e.children.length === 0).pop(); if (!t) return 'nessuna modale login'; t.click(); return 'login: ritirato'; })()"
wait_ms 900
ev "(() => { const t = [...document.querySelectorAll('div,span')].filter(e => /^OTTIMO/.test(e.textContent.trim()) && e.children.length === 0).pop(); if (!t) return 'NESSUN OTTIMO'; t.click(); return 'login: chiusa'; })()"
wait_ms 900
dclick 540 800   # PLAY partita classica
wait_ms 1500
ev "typeof window.__bbTest === 'object' ? 'in-game OK' : 'NON in game'"
agent-browser screenshot $SHOT/03-game.png >/dev/null 2>&1

echo "=== 4. Installa helper drag + piazza pezzo ==="
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
ev "window.__drag(0, 0, 0)"
wait_ms 1000
ev "JSON.stringify(window.__bbTest.debug())"

echo "=== 5. Score 500 -> forceGameOver -> SALTA revive ==="
ev "window.__bbTest.setScoreDirect(500); 'score=500'"
wait_ms 300
ev "window.__bbTest.forceGameOver(); 'forced'"
wait_ms 1200
dclick 540 1560   # SALTA (skip revive)
wait_ms 1500
ev "JSON.stringify(window.__bbTest.debug())"
agent-browser screenshot $SHOT/04-gameover-gems.png >/dev/null 2>&1
ev "(() => { const p = JSON.parse(localStorage.getItem('bb-progress') || '{}'); return 'gems al game over: ' + p.state.gems; })()"

echo "=== 6. ×2 GUARDA ANNUNCIO -> overlay mock -> RITIRA ==="
ev "(() => { const p = JSON.parse(localStorage.getItem('bb-progress') || '{}'); return 'gems PRIMA del double: ' + p.state.gems; })()"
dclick 700 1430   # bottone ×2 (a destra del testo +N gemme)
wait_ms 800
ev "window.__adLog ? window.__adLog.slice(-2).join(' | ') : 'no adLog'"
agent-browser screenshot $SHOT/05-ad-overlay-double.png >/dev/null 2>&1
wait_ms 4800   # countdown 5s
dclick 540 1360  # RITIRA RICOMPENSA
wait_ms 1000
ev "window.__adLog ? window.__adLog.slice(-2).join(' | ') : 'no adLog'"
ev "(() => { const p = JSON.parse(localStorage.getItem('bb-progress') || '{}'); return 'gems dopo double: ' + p.state.gems; })()"
agent-browser screenshot $SHOT/06-doubled.png >/dev/null 2>&1
ev "JSON.stringify(window.__bbTest.debug())"

echo "=== 7. Mobile 430px: DisplaySlot nascosto ==="
agent-browser eval "window.resizeTo(430, 900); ''" >/dev/null 2>&1 || true
agent-browser set viewport 430 900 >/dev/null 2>&1 || true
wait_ms 800
ev "(() => { const s = document.querySelector('[data-ad-slot=house-leaderboard]'); if (!s) return 'DisplaySlot MANCANTE'; return 'mobile display=' + getComputedStyle(s).display + ' (none = nascosto OK)'; })()"
agent-browser screenshot $SHOT/07-mobile.png >/dev/null 2>&1
agent-browser set viewport 1280 800 >/dev/null 2>&1 || true

echo "=== 8. Errori console ==="
agent-browser console 2>&1 | grep -i -E "error|unhandled" | grep -v -i "favicon" | head -5 || echo "nessun errore console"

echo "=== FINE — screenshot in $SHOT/ ==="
