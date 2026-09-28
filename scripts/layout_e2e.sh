#!/bin/bash
# E2E test del LAYOUT EDITOR (agent-browser CLI) — v2.
# Copre: modalità layout (drag/resize/testo), salvataggio multi-layout,
# reset Originale, ricarica layout, applicazione live al gioco vero
# (board ridimensionata → drag&drop con celle ricalcolate), fix false-f00.
# Uso: bash scripts/layout_e2e.sh
set -e
cd /home/z/my-project
SHOT=download/layout-test
mkdir -p $SHOT

ev() { agent-browser eval "$1" 2>&1 | tail -1; }
wait_ms() { sleep $(awk "BEGIN{print $1/1000}"); }

FALSE_BEFORE=$(grep -c "false-f00" dev.log || true)

echo "=== 0. Stato pulito + error collector ==="
agent-browser open http://localhost:3000 >/dev/null 2>&1
wait_ms 2500
agent-browser set viewport 1280 800 >/dev/null 2>&1 || true
wait_ms 600
ev "localStorage.removeItem('bb-layouts'); localStorage.removeItem('bb-run-save'); localStorage.removeItem('bb-progress'); 'cleared'"
agent-browser open http://localhost:3000 >/dev/null 2>&1
wait_ms 3000
# error collector (dopo il load pulito)
ev "window.__errs = []; window.addEventListener('error', e => window.__errs.push('ERR: ' + e.message)); window.addEventListener('unhandledrejection', e => window.__errs.push('REJ: ' + e.reason)); 'collector ok'"
agent-browser screenshot $SHOT/01-home.png >/dev/null 2>&1

# click su testo: elementi il cui testo combacia e i cui figli sono solo svg/icon
ev "window.__clickText = (txt) => {
  const up = s => s.trim().toUpperCase();
  const els = [...document.querySelectorAll('button,div,span')].filter(e => {
    if (up(e.textContent) !== up(txt)) return false;
    if (e.children.length === 0) return true;
    return [...e.children].every(c => c.tagName.toLowerCase() === 'svg' || c.tagName.toLowerCase() === 'span' && up(c.textContent) === up(txt));
  });
  if (!els.length) return 'NOT FOUND: ' + txt;
  els[els.length - 1].click();
  return 'clicked ' + txt;
}; 'ok'" >/dev/null 2>&1

# drag di un LayoutBox (delta px client)
ev "window.__dragBox = async (el, dx, dy) => {
  const box = document.querySelector('[data-layoutbox=\"' + el + '\"]');
  if (!box) return 'box not found: ' + el;
  const r = box.getBoundingClientRect();
  const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
  const opts = (x, y) => ({ bubbles: true, cancelable: true, pointerId: 9, pointerType: 'mouse', clientX: x, clientY: y, isPrimary: true });
  box.dispatchEvent(new PointerEvent('pointerdown', opts(x0, y0)));
  await new Promise(res => setTimeout(res, 150));
  for (const k of [0.4, 0.8, 1]) {
    window.dispatchEvent(new PointerEvent('pointermove', opts(x0 + dx * k, y0 + dy * k)));
    await new Promise(res => setTimeout(res, 90));
  }
  window.dispatchEvent(new PointerEvent('pointerup', opts(x0 + dx, y0 + dy)));
  await new Promise(res => setTimeout(res, 200));
  const s = box.style;
  return el + ' → left=' + s.left + ' top=' + s.top + ' w=' + s.width + ' h=' + s.height;
};" >/dev/null 2>&1

# resize da un angolo (il box DEVE essere già selezionato)
ev "window.__resizeBox = async (el, corner, dx, dy) => {
  const box = document.querySelector('[data-layoutbox=\"' + el + '\"]');
  if (!box) return 'box not found: ' + el;
  const wantsN = corner.includes('n'), wantsW = corner.includes('w');
  const handles = [...box.querySelectorAll(':scope > div')].filter(d => /resize/.test(d.style.cursor || ''));
  const h = handles.find(d => {
    const hasN = d.style.top !== '', hasW = d.style.left !== '';
    return hasN === wantsN && hasW === wantsW;
  });
  if (!h) return 'handle non trovato tra ' + handles.length;
  const r = h.getBoundingClientRect();
  const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
  const opts = (x, y) => ({ bubbles: true, cancelable: true, pointerId: 11, pointerType: 'mouse', clientX: x, clientY: y, isPrimary: true });
  h.dispatchEvent(new PointerEvent('pointerdown', opts(x0, y0)));
  await new Promise(res => setTimeout(res, 150));
  for (const k of [0.5, 1]) {
    window.dispatchEvent(new PointerEvent('pointermove', opts(x0 + dx * k, y0 + dy * k)));
    await new Promise(res => setTimeout(res, 90));
  }
  window.dispatchEvent(new PointerEvent('pointerup', opts(x0 + dx, y0 + dy)));
  await new Promise(res => setTimeout(res, 200));
  const s = box.style;
  return el + ' ' + corner + ' → left=' + s.left + ' top=' + s.top + ' w=' + s.width + ' h=' + s.height;
};" >/dev/null 2>&1

# posizione di un LayoutBox (selettore quotato!)
ev "window.__boxPos = (el) => {
  const b = document.querySelector('[data-layoutbox=\"' + el + '\"]');
  return b ? 'left=' + b.style.left + ' top=' + b.style.top + ' w=' + b.style.width + ' h=' + b.style.height : 'MANCA: ' + el;
}; 'ok'" >/dev/null 2>&1

# digita in un input (React-friendly)
ev "window.__typeIn = (sel, val) => {
  const i = document.querySelector(sel);
  if (!i) return 'input non trovato: ' + sel;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(i, val);
  i.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed ' + val + ' in ' + sel;
}; 'ok'" >/dev/null 2>&1

echo "=== 1. Home default: posizione logo (121.5 / 88 attesi) ==="
ev "window.__boxPos('home.logo')"

echo "=== 2. Entra modalità LAYOUT ==="
ev "window.__clickText('LAYOUT')"
wait_ms 500

echo "=== 3. Drag logo (+150px, -80px client) ==="
ev "window.__dragBox('home.logo', 150, -80)"
agent-browser screenshot $SHOT/02-layout-logo-moved.png >/dev/null 2>&1

echo "=== 4. Seleziona PLAY (click) poi resize SE (+70px) — lockRatio atteso ==="
ev "window.__dragBox('home.playBtn', 0, 0)"
wait_ms 300
ev "window.__resizeBox('home.playBtn', 'se', 70, 70)"

echo "=== 5. Doppio click PLAY → editor testo → 'START' ==="
ev "(() => {
  const box = document.querySelector('[data-layoutbox=\"home.playBtn\"]');
  const r = box.getBoundingClientRect();
  box.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  return 'dblclick ok';
})()"
wait_ms 600
ev "(() => { const i = document.querySelector('input.bb-textedit-input'); return i ? 'input presente, valore=' + JSON.stringify(i.value) : 'INPUT MANCANTE'; })()"
ev "window.__typeIn('input.bb-textedit-input', 'START')"
wait_ms 300
agent-browser keyboard press Enter >/dev/null 2>&1 || true
wait_ms 500
ev "(() => { const s = JSON.parse(localStorage.getItem('bb-skin-studio') || '{}'); return 'playBtn.text = \"' + (s.state?.skin?.playBtn?.text ?? '?') + '\"'; })()"

echo "=== 6. Salva layout 'Layout E2E' ==="
ev "[...document.querySelectorAll('button')].find(b => (b.title||'') === 'Layout salvati')?.click(); 'popover aperto'"
wait_ms 600
ev "window.__typeIn('input[placeholder*=Nome]', 'Layout E2E')"
ev "window.__clickText('Salva')"
wait_ms 500
ev "(() => { const l = JSON.parse(localStorage.getItem('bb-layouts') || '{}'); return 'saved=[' + (l.state?.saved || []).map(s => s.name).join(',') + '] attivo=' + (l.state?.activeSavedId ? 'sì' : 'no'); })()"

echo "=== 7. Ripristina Originale (popover ancora aperto) ==="
ev "window.__clickText('Originale')"
wait_ms 500
ev "window.__boxPos('home.logo')"

echo "=== 8. Ricarica layout salvato (popover aperto, riga cliccabile) ==="
ev "(() => { const rows = [...document.querySelectorAll('button')].filter(e => e.textContent.trim() === 'Layout E2E'); if (!rows.length) return 'riga non trovata'; rows[rows.length - 1].click(); return 'caricato'; })()"
wait_ms 500
ev "window.__boxPos('home.logo')"
agent-browser keyboard press Escape >/dev/null 2>&1 || true
wait_ms 400

echo "=== 9. Schermata GIOCO: sposta board + ridimensiona (lockSquare) ==="
ev "window.__clickTab = (t) => { const b = [...document.querySelectorAll('header button')].find(x => x.textContent.trim() === t); if (!b) return 'tab non trovato: ' + t; b.click(); return 'tab ' + t; }; 'ok'" >/dev/null 2>&1
ev "window.__clickTab('GIOCO')"
wait_ms 900
ev "window.__boxPos('game.board')"
ev "window.__dragBox('game.board', 0, 60)"
ev "window.__resizeBox('game.board', 'se', -80, -80)"

echo "=== 10. Sposta punteggio in alto ==="
ev "window.__dragBox('game.score', 0, -40)"
agent-browser screenshot $SHOT/03-game-layoutmode.png >/dev/null 2>&1

echo "=== 11. Testo banner in POPUP (override layout) ==="
ev "window.__clickTab('POPUP')"
wait_ms 700
# sub-tab GAME OVER (default = PAUSA)
ev "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'GAME OVER'); if (!b) return 'sub-tab GAME OVER non trovato'; b.click(); return 'sub-tab ok'; })()"
wait_ms 700
ev "(() => {
  const box = document.querySelector('[data-layoutbox=\"popups.gameover.banner\"]');
  if (!box) return 'banner MANCA';
  const r = box.getBoundingClientRect();
  box.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  return 'dblclick banner';
})()"
wait_ms 600
ev "window.__typeIn('input.bb-textedit-input', 'PARTITA FINITA')"
wait_ms 300
agent-browser keyboard press Enter >/dev/null 2>&1 || true
wait_ms 500
ev "(() => { const l = JSON.parse(localStorage.getItem('bb-layouts') || '{}'); return 'banner.text = \"' + (l.state?.overrides?.['popups.gameover.banner']?.text ?? 'MANCA') + '\"'; })()"
agent-browser keyboard press Escape >/dev/null 2>&1 || true

echo "=== 12. Esci da LAYOUT e GIOCA con layout personalizzato ==="
ev "window.__clickText('LAYOUT')"
wait_ms 400
ev "window.__clickText('GIOCA')"
wait_ms 1000
# modale login giornaliero: RITIRA N GEMME poi OTTIMO!
ev "(() => { const els = [...document.querySelectorAll('div')].filter(d => (d.textContent||'').includes('RITIRA') && d.style.cursor === 'pointer'); if (els.length) { els[0].click(); return 'ritirato'; } return 'nessun RITIRA (modale non aperta)'; })()"
wait_ms 800
ev "window.__clickText('OTTIMO!')"
wait_ms 800
# PLAY = sprite BtnPlay DENTRO il telefono → clicca l'antenato clickable
ev "(() => { const el = [...document.querySelectorAll('div')].filter(d => d.style.width === '1080px').find(d => d.getBoundingClientRect().height > 300); if (!el) return 'design space non trovato'; const img = [...el.querySelectorAll('img')].find(i => i.src.includes('BtnPlay-f00')); if (!img) return 'BtnPlay img non trovata nel telefono'; let n = img; while (n && n.style.cursor !== 'pointer') n = n.parentElement; if (!n) return 'nessun ancestor clickable'; n.click(); return 'PLAY cliccato'; })()"
wait_ms 1800
ev "JSON.stringify(window.__bbTest.debug())"
agent-browser screenshot $SHOT/04-gioco-custom-layout.png >/dev/null 2>&1

echo "=== 13. Piazza pezzo con board ridimensionata (celle ricalcolate) ==="
ev "window.__dragCustom = async (slot, r, c) => {
  const dbg = window.__bbTest.debug();
  const b = dbg.board;
  const p = window.__bbTest.getTray()[slot];
  if (!p) return 'slot vuoto';
  const left = b.x - b.w / 2, top = b.y - b.w / 2;
  const pad = 20 * b.w / 1000;
  const cell = b.cell;
  const trayX = [196.5, 539.5, 883.5][slot];
  const dx = left + pad + c * cell + (p.w * cell) / 2;
  const dy = top + pad + r * cell + (p.h * cell) / 2 + 200;
  const el = [...document.querySelectorAll('div')].filter(d => d.style.width === '1080px').find(d => d.getBoundingClientRect().height > 300);
  const rect = el.getBoundingClientRect();
  const sx = rect.width / 1080, sy = rect.height / 1920;
  const cx = x => rect.left + x * sx, cy = y => rect.top + y * sy;
  const opts = (x, y) => ({ bubbles: true, cancelable: true, pointerId: 13, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true });
  document.elementFromPoint(cx(trayX), cy(1626)).dispatchEvent(new PointerEvent('pointerdown', opts(cx(trayX), cy(1626))));
  await new Promise(res => setTimeout(res, 200));
  for (const k of [0.3, 0.6, 1]) {
    document.dispatchEvent(new PointerEvent('pointermove', opts(cx(trayX + (dx - trayX) * k), cy(1626 + (dy - 1626) * k))));
    await new Promise(res => setTimeout(res, 120));
  }
  document.dispatchEvent(new PointerEvent('pointerup', opts(cx(dx), cy(dy))));
  return 'piazzato w' + p.w + ' h' + p.h + ' in r' + r + 'c' + c + ' con cell=' + cell.toFixed(1);
};" >/dev/null 2>&1
ev "window.__dragCustom(0, 0, 0)"
wait_ms 1200
ev "JSON.stringify(window.__bbTest.debug())"
agent-browser screenshot $SHOT/05-pezzo-piazzato.png >/dev/null 2>&1

echo "=== 14. Pausa: popup con children layout ==="
ev "(() => {
  const el = [...document.querySelectorAll('div')].filter(d => d.style.width === '1080px').find(d => d.getBoundingClientRect().height > 300);
  const rect = el.getBoundingClientRect();
  const sx = rect.width / 1080, sy = rect.height / 1920;
  const t = document.elementFromPoint(rect.left + 974 * sx, rect.top + 88 * sy);
  if (!t) return 'no pause btn';
  t.click();
  return 'pausa aperta';
})()"
wait_ms 700
ev "window.__boxPos('popups.pause')"
agent-browser screenshot $SHOT/06-pausa.png >/dev/null 2>&1
ev "(() => {
  const el = [...document.querySelectorAll('div')].filter(d => d.style.width === '1080px').find(d => d.getBoundingClientRect().height > 300);
  const rect = el.getBoundingClientRect();
  const sx = rect.width / 1080, sy = rect.height / 1920;
  const t = document.elementFromPoint(rect.left + (97 + 802) * sx, rect.top + (404 + 78) * sy);
  if (!t) return 'no close';
  t.click();
  return 'pausa chiusa';
})()"
wait_ms 600

echo "=== 15. Game over: banner + elementi layout ==="
ev "window.__bbTest.setScoreDirect(300); 'ok'"
wait_ms 400
ev "window.__bbTest.forceGameOver(); 'forced'"
wait_ms 1400
ev "window.__clickText('non ora')"
wait_ms 1800
ev "(() => {
  const out = [];
  for (const k of ['popups.gameover.banner', 'popups.gameover.scoreLabel', 'popups.gameover.score', 'popups.gameover.buttons']) {
    const b = document.querySelector('[data-layoutbox=\"' + k + '\"]');
    out.push(k + '=' + (b ? 'ok(' + b.style.width + '×' + b.style.height + ')' : 'MANCA'));
  }
  const lbl = document.querySelector('[data-layoutbox=\"popups.gameover.scoreLabel\"]');
  out.push('label testo=' + (lbl ? lbl.textContent.trim() : '?'));
  return out.join(' · ');
})()"
agent-browser screenshot $SHOT/07-gameover.png >/dev/null 2>&1

echo "=== 16. Errori runtime (collector) ==="
ev "window.__errs.length ? window.__errs.slice(0, 6).join(' || ') : 'NESSUN errore runtime'"

echo "=== 17. Fix false-f00: nessuna nuova richiesta 404 ==="
FALSE_AFTER=$(grep -c "false-f00" dev.log || true)
echo "richieste false-f00: prima=$FALSE_BEFORE dopo=$FALSE_AFTER"

echo "=== FINE — screenshot in $SHOT/ ==="
