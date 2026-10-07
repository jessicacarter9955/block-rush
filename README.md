# Block Rush 🎮

Puzzle game web con griglia 8×8, trascinamento dei pezzi, combo, punteggio, record e schermate di pausa e fine partita. La pagina include un bot dimostrativo con velocità regolabile e un recorder per acquisire il gioco in formato verticale.

▶ **Gioca**: https://jessicacarter9955.github.io/block-rush/

## Parametri URL

| Parametro | Effetto |
|---|---|
| `?clean=1` | nasconde i pannelli di controllo |
| `?bot=1` | avvia automaticamente il bot |
| `?speed=4` | imposta la velocità del bot (0,25–16) |

## Sviluppo locale

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build statica in out/
```

Il deploy GitHub Pages parte a ogni push su `main` tramite `.github/workflows/deploy-pages.yml`.
