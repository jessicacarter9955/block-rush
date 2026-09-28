# Block Rush 1:1 🎮

Il puzzle game **Block Rush** in versione web **1:1 pixel perfect**: blocchi candy
glossy, board con bordo neon, sfondo bokeh navy — ogni elemento estratto dai
screenshot reali del gioco originale.

▶ **Gioca**: https://jessicacarter9955.github.io/block-rush/

## Cosa c'è dentro

- **Gioco completo** — griglia 8×8, drag & drop dei pezzi dal vassoio, righe e
  colonne multiple, combo, punteggio, record, pausa, game over, rivivi.
- **BOT giocatore** — un bot JavaScript che gioca da solo cercando sempre il
  punteggio più alto: prende il pezzo dal vassoio e lo trascina sulla griglia
  come farebbe un giocatore in carne e ossa. Con **slider di velocità**
  (0,25× cinematico → 16× turbo) e auto-restart.
- **RECORDER video** — registra esattamente l'area di gioco (1080×1920, 30fps,
  senza pannelli) e scarica il video pronto per **YouTube Shorts e TikTok**.
  Scorciatoia tastiera **R** = start/stop.

## Parametri URL utili

| Parametro | Effetto |
|---|---|
| `?clean=1` | nasconde i pannelli (schermata pulita, ideale per i video) |
| `?bot=1` | avvia automaticamente il bot |
| `?speed=4` | velocità del bot (0.25 – 16) |

## Sviluppo locale

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # export statico in out/
```

Deploy automatico su GitHub Pages a ogni push su `main`
(workflow `.github/workflows/deploy-pages.yml`).
