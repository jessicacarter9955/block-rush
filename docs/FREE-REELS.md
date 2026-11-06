# BlockRush Reels gratis — studio web + cloud opzionale

**Studio web diretto:** https://jessicacarter9955.github.io/block-rush/creator/

**Cloud senza PC acceso:** https://github.com/jessicacarter9955/block-rush/actions/workflows/free-reels.yml

## Studio web (nessun GitHub richiesto)

1. Apri `/creator/` con Chrome/Edge desktop; il gioco si apre nell'anteprima con il bot automatico.
2. Seleziona piattaforma, durata (6–60 secondi) e velocità.
3. Premi **Genera video**, scegli **Questa scheda** nella finestra di condivisione e autorizza. Il browser registra solo il riquadro di gioco, 1080×1920, fino alla durata scelta.
4. Visualizza l'anteprima del risultato e premi **Scarica video**. Se il browser supporta H.264/MP4 si ottiene MP4; altrimenti un WebM chiaramente etichettato.

Lo studio è gratuito e non richiede login GitHub o installazioni, ma il browser e il PC devono restare aperti durante la registrazione. Le API del browser richiedono il consenso esplicito a condividere la scheda; non è possibile avviare la cattura invisibilmente.

## Generazione cloud (opzionale, PC spento)

1. Accedi a GitHub con un account abilitato a scrivere nel repository.
2. Nel workflow **Free Reels Generator** premi **Run workflow**, scegli numero (1–3), durata (6–60 secondi), velocità, piattaforma e inquadratura.
3. Attendi il job **generate**; apri il run completato e scarica il pacchetto ZIP dalla sezione **Artifacts**.
4. Nello ZIP trovi i file MP4 e un `manifest.json` con punteggio, durata e dimensione.

Il sito GitHub Pages resta online anche quando il workflow non gira. Il rendering gira sui runner standard Linux di GitHub Actions: Chromium riproduce il bot, FFmpeg converte gli MP4 a 1080×1920, e GitHub conserva gli artifact per 30 giorni. Scaricali entro la scadenza: GitHub Actions non è un archivio video permanente.

Il sito web `/creator/` non è il vecchio server locale `/publisher/` trasferito in cloud. Non serve un server con disco persistente; non c'è pubblicazione automatica sui social, né uno streaming continuo. I video generati sono senza audio.

## Sviluppo e verifica

La parte operativa è sul branch `codex/youtube-bot-publishing`; il workflow di avvio è su `main` perché GitHub richiede `workflow_dispatch` sul branch predefinito.

```sh
npm ci
npx playwright install --with-deps chromium
npm run publisher:build
REELS_COUNT=1 REELS_SECONDS=6 REELS_FORMAT=instagram-reels npm run reels:generate
```

Gli MP4 vengono scritti in `reels/` (ignorata da Git) e restano fuori dai commit. La CLI supporta anche `REELS_FRAMING=safe` e `REELS_SPEED=8`.
