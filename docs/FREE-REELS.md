# BlockRush Reels gratis senza Render o PC acceso

Link permanente per avviare il generatore: https://github.com/jessicacarter9955/block-rush/actions/workflows/free-reels.yml

Pagina pubblica di accesso: https://jessicacarter9955.github.io/block-rush/creator/

## Come si usa

1. Accedi a GitHub con un account abilitato a scrivere nel repository.
2. Nel workflow **Free Reels Generator** premi **Run workflow**, scegli numero (1–3), durata (6–60 secondi), velocità, piattaforma e inquadratura.
3. Attendi il job **generate**; apri il run completato e scarica il pacchetto ZIP dalla sezione **Artifacts**.
4. Nello ZIP trovi i file MP4 e un `manifest.json` con punteggio, durata e dimensione.

Il sito GitHub Pages resta online anche quando il workflow non gira. Il rendering gira sui runner standard Linux di GitHub Actions: Chromium riproduce il bot, FFmpeg converte gli MP4 a 1080×1920, e GitHub conserva gli artifact per 30 giorni. Scaricali entro la scadenza: GitHub Actions non è un archivio video permanente.

La pagina `/creator/` è un ingresso statico, **non** il server locale `/publisher/` trasferito in cloud. Non serve un server con disco persistente; non c'è pubblicazione automatica sui social, né uno streaming continuo. I video generati sono senza audio.

## Sviluppo e verifica

La parte operativa è sul branch `codex/youtube-bot-publishing`; il workflow di avvio è su `main` perché GitHub richiede `workflow_dispatch` sul branch predefinito.

```sh
npm ci
npx playwright install --with-deps chromium
npm run publisher:build
REELS_COUNT=1 REELS_SECONDS=6 REELS_FORMAT=instagram-reels npm run reels:generate
```

Gli MP4 vengono scritti in `reels/` (ignorata da Git) e restano fuori dai commit. La CLI supporta anche `REELS_FRAMING=safe` e `REELS_SPEED=8`.
