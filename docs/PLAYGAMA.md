# Playgama Bridge — Ads & multi-piattaforma

Block Rush integra [Playgama Bridge](https://github.com/Playgama/bridge) (`@playgama/bridge` v2,
CDN `bridge.playgama.com`): **un'unica integrazione per pubblicare su 20+ piattaforme**,
tra cui **YouTube Playables**, CrazyGames, Poki, GameDistribution, Telegram, TikTok,
Yandex Games, Facebook, Discord, Reddit, MSN, GameSnacks, Samsung, Huawei, VK e altre.

## Cosa è integrato

| Punto del gioco | Formato | Note |
| --- | --- | --- |
| Suggerimento (`?` in partita) | **Rewarded** | `GUARDA ANNUNCIO` → mostra il pezzo da piazzare e le celle |
| Revive (`ONE MORE CHANCE`) | **Rewarded** | `WATCH AD & CONTINUE`; il countdown si ferma durante l'annuncio |
| `PLAY AGAIN` dal game over | **Interstitial** | delay minimo 90s gestito dall'SDK |

File chiave:

- `src/lib/playgama.ts` — wrapper: caricamento CDN, init, `showRewardedAd()`,
  `showInterstitialAd()`, `isRewardedReady()`, ducking audio durante gli annunci
- `public/playgama-bridge-config.json` — config SDK (safe-area, delay interstitial,
  preload dei placement `hint` / `game_over`)
- `src/lib/hint-reward.ts` — provider pattern: `setHintAdProvider()` aggancia il rewarded
- `src/components/game/PlayGame.tsx` — revive rewarded + interstitial al play again
- `src/components/game/RushUI.tsx` — label dinamiche (`FREE CONTINUE` quando non ci sono ads)

## Degradazione graceful (regola d'oro)

Fuori dalle piattaforme (dev locale, GitHub Pages, mock) il bridge risponde con valori
sicuri: `isRewardedSupported = false` → il provider non viene registrato e l'UI mostra i
fallback (`Annunci non disponibili. Riprova più tardi.` / `FREE CONTINUE`). Se la CDN è
bloccata (AdBlock/rete) il gioco parte comunque al 100%. Mai crash per colpa degli ads.

## Pubblicare su Playgama (e YouTube Playables)

1. **Build statica**: `NEXT_PUBLIC_BASE_PATH= npm run build` → cartella `out/`
   (zippala **senza** il basePath di GitHub Pages: le piattaforme servono a dominio root).
2. Crea/entra nel cabinet su **https://developer.playgama.com**.
3. Nuovo gioco → carica lo zip della build + cover/screenshot.
4. Scegli le piattaforme di destinazione (YouTube Playables, CrazyGames, Poki, ...):
   il bridge rileva da solo la piattaforma e attiva gli annunci giusti.
5. Sandbox test → submit per review. Gli incassi arrivano nel cabinet Playgama.

Tool utili: [config editor](https://playgama.github.io/bridge-config-editor/),
[DevTools Chrome](https://chromewebstore.google.com/detail/playgama-bridge-devtools/mldhijegcmagkcchjmenafiipkhjlppo),
[wiki](https://wiki.playgama.com/playgama/bridge-sdk/getting-started),
[Discord](https://discord.gg/pzqd2upxr8).

## Test locali

```bash
npm run build && python3 -m http.server 8923 --directory out
node scripts/playgama/e2e-playgama2.cjs   # serve anche dev su :3000
```

Il test verifica: init bridge (console `PlaygamaBridge v2.x initialized`), piattaforma
`mock`/`standalone`, fallback hint senza annunci, pannello revive con `FREE CONTINUE`,
assenza di page error. Screenshot in `download/playgama-e2e/`.
