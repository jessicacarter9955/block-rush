# Monetizzazione — Guida operativa (web)

Questo progetto ha un **strato annunci plug-gabile** (`src/lib/ads/`): il gioco
chiama sempre le stesse due funzioni (`showRewarded` / `maybeInterstitial`) e il
provider attivo decide *come* l'annuncio viene mostrato. Passare dagli annunci
simulati a una network reale è una modifica di configurazione, non di codice.

```
src/lib/ads/
├── types.ts             contratto AdProvider (+ placement: revive, booster_*,
│                        shop_gems, daily_restore, double_gems)
├── mock-provider.ts     annunci simulati → AdOverlay demo (default)
├── applixir-provider.ts SDK AppLixir v6 REALE (rewarded video)
├── gd-provider.ts       adapter portali GameDistribution/GameMonetize
│                        (auto-rileva window.gdsdk iniettata dal portale)
└── index.ts             selezione: localStorage → .env.local → gdsdk → mock
```

---

## 1. AppLixir — rewarded video (già integrato nel codice)

È l'unica network **effettivamente cablata** oggi: l'integrazione segue le
docs ufficiali v6.1.0 (`https://support.applixir.com`).

**Cosa serve da te (in ordine):**

1. **Dominio tuo.** Il gioco deve girare su un dominio di tua proprietà
   (es. `blockblast-tuonome.com` su Vercel/Netlify, oppure GitHub Pages con
   dominio custom). Il link di anteprima del sandbox **non è eleggibile**:
   le network verificano il dominio e richiedono di modificare `ads.txt`.
2. **Account publisher** su `applixir.com` → registra il sito nel dashboard.
3. **Requisito minimo dichiarato: 5.000+ DAU.** In fase di review sono
   valutati anche sito e traffico; sotto soglia possono rifiutare.
4. Copia la **API key** (dashboard → Sites) e incollala qui:
   ```bash
   # .env.local
   NEXT_PUBLIC_AD_PROVIDER=applixir
   NEXT_PUBLIC_APPLIXIR_API_KEY=xxxx-xxxx-xxxx-xxxx
   ```
5. **ads.txt**: copia in `public/ads.txt` la riga esatta dal loro dashboard
   (il file contiene già le istruzioni in commento).
6. Rilancia `npm run dev` (o il deploy). Nella console del browser vedrai
   `[ads] provider: applixir (SDK reale attivo)`.

**Test rapido senza rebuild** (console del browser, poi ricarica):
```js
localStorage.setItem('bb_ad_provider', 'applixir');
localStorage.setItem('bb_applixir_key', 'LA-TUA-KEY');
// per tornare agli annunci simulati:
localStorage.setItem('bb_ad_provider', 'mock');
```

**Come è gestita la ricompensa** (regola delle docs ufficiali): il premio viene
concesso **solo** su `status.type === "complete"`, mai su `allAdsCompleted`
(scatta anche se l'utente salta), quartili o `manuallyEnded`. Errori VAST,
consenso rifiutato o timeout risolvono in "skipped" → il gioco continua.

**Limite noto (importante per una economia reale):** il lato client è
inaffidabile — il `complete` ottimistico serve solo per l'UI. Per accreditare
gemme in modo sicuro serve il **Web Callback** firmato lato server di AppLixir
(GET firmato al tuo backend, dedup su `tid`, poi accredito). Finché il gioco è
client-only, le gemme restano manipolabili da un utente motivato: accettabile
per un soft-launch, da risolvere prima di IAP reali.

## 1bis. Portali (CrazyGames / GameMonetize / GameDistribution) — REQUISITI MINIMI, monetizzi appena pubblichi

Se la domanda è «quali ads hanno requisiti meno stringenti?»: i **portali di
distribuzione** sono la risposta — non serve traffico minimo, non serve il
dominio tuo, non serve ads.txt. Carichi la build, loro la pubblicano sul loro
portale (con il loro traffico) e iniettano la loro SDK che serve rewarded +
interstitial; tu prendi la revenue share.

| Portale | Requisiti | Note |
|---|---|---|
| **CrazyGames** | ✅ nessun minimo di traffico — «upload your game in minutes: files + cover image» | QA qualitativo (gioco deve essere buono), rev share su ads + IAP opzionali. Prima scelta per qualità/traffico |
| **GameMonetize** | ✅ nessun minimo, self-serve | setup facilissimo, SDK compatibile gdsdk |
| **GameDistribution** (Azerion) | ✅ nessun minimo di traffico | review fino a ~3 settimane |
| **Poki** | 🟡 curato, quality bar alta | solo se il gioco è molto rifinito |

**Il codice è già pronto**: `gd-provider.ts` implementa l'API ufficiale
`window.gdsdk.showAd('rewarded'|'interstitial', { adStarted, adEnded, adError })`
(usata da GameDistribution e GameMonetize) e viene **attivato in automatico**
quando il gioco gira dentro l'iframe del portale (la SDK iniettata viene
rilevata da `index.ts`). Il gioco rispetta già il contratto richiesto dai
portali: input bloccato durante l'ad (stato `adBusy`), musica abbassata,
ricompensa solo su `adEnded`.

**Cosa serve da te:** account sviluppatore sul portale → upload della build
(export statico del sito) + immagine di copertina → passata la QA, le ads
partono da sole. Nessuna configurazione nel codice.

## 2. Loop monetario implementato

| Placement | Dove | Note |
|---|---|---|
| `revive` | schermata game over (3 per partita) | countdown 5s in pausa durante l'annuncio |
| `booster_clear` / `booster_swap` / `booster_remove` | booster in partita | la prima volta gratis con annuncio, poi gemme |
| `double_gems` | game over ("×2 GUARDA ANNUNCIO") | raddoppia le gemme guadagnate nella run |
| `shop_gems` | negozio (+50 gemme) | faucet giornaliero |
| `daily_restore` | login giornaliero | ripristina streak persa |
| interstitial | tra le partite | mai in partita · min 2 game-over tra loro · min 90s · mai se "Rimuovi pubblicità" |

Politica premium: chi compra "Rimuovi pubblicità" (4,99 €) non vede interstitial
e le ricompense degli annunci diventano immediate.

## 3. Display fuori dal canvas

`src/components/game/DisplaySlot.tsx` mostra il banner **sotto il telefono**
(solo desktop). Di default ruota 3 house ads (cross-promo del gioco stesso).
Per una network display reale incolla il loro tag in `.env.local`:

```bash
NEXT_PUBLIC_DISPLAY_TAG_HTML='<div id="..."><script src="https://..."></script></div>'
```

Gli `<script>` vengono ricreati via DOM così eseguono davvero. Chi ha
"Rimuovi pubblicità" non vede i banner di network (le house promo restano).

**Quale network per il display**: AdinPlay (gruppo Venatus) è la prima
candidata per un browser game — domanda dedicata gaming e formati per game
site, richiesta di approvazione con dominio proprio. Venatus è la stessa
holding in versione premium (scala maggiore). AdSense funziona come baseline
display ma non è pensato per il game loop. In ogni caso: serve il dominio tuo.

## 4. IAP (pacchetti gemme + Rimuovi pubblicità)

Default: acquisti **simulati** (latenza 800ms, accredito immediato — per demo
e test). Per checkout reali senza backend: **Stripe Payment Links**.

1. Su Stripe crea un Payment Link per ogni taglia (60/150/400/1000/2500/6000
   gemme + "Rimuovi pubblicità").
2. Incolli in `.env.local`:
   ```bash
   NEXT_PUBLIC_IAP_LINKS={"p60":"https://buy.stripe.com/…","p400":"https://buy.stripe.com/…","removeAds":"https://buy.stripe.com/…"}
   ```
3. I bottoni aprono il checkout reale in una nuova scheda (icona link esterno).

**Limitazione onesta**: senza backend l'accredimento NON è automatico (chi
paga deve ricevere le gemme). La soluzione corretta è il webhook Stripe
(`checkout.session.completed`) su un piccolo endpoint server-side che scriva
sul profilo; quando serve, quello è il passo successivo.

## 5. Riepilogo reti (settembre 2026) — ordinate per requisiti d'ingresso

| Rete | Prodotto | Requisiti d'ingresso | Fattibilità ora |
|---|---|---|---|
| **CrazyGames** | portale: rewarded + interstitial + IAP | ✅ NESSUN minimo — upload + cover, QA qualità | codice pronto (gdsdk auto) |
| **GameMonetize** | portale: rewarded + interstitial | ✅ NESSUN minimo, self-serve | codice pronto (gdsdk auto) |
| **GameDistribution** | portale: rewarded + interstitial + display | ✅ nessun minimo, review ~3 settimane | codice pronto (gdsdk auto) |
| **AppLixir** | rewarded video (sito proprio) | 🟡 5.000+ DAU dichiarati, API key, ads.txt, dominio | codice pronto |
| **AdSense** | display baseline (sito proprio) | 🟡 nessun minimo di traffico, ma review contenuti + dominio | slot display pronto |
| **AdinPlay** | display/game site (sito proprio) | 🟡 dominio + domanda publisher (accettano anche piccoli) | slot display pronto |
| **Venatus** | display premium (holding AdinPlay) | 🟡 scala/traffico consolidato | — |
| **Mediavine** | publisher network | ❌ 50k+ sessioni/mese, non per gameloop | — |
| **Playwire** | stack completo | ❌ scala | — |

**In sintesi**: vuoi monetizzare *appena pubblichi* → carica il gioco su
**CrazyGames + GameMonetize + GameDistribution** in parallelo (zero requisiti,
loro portano il traffico). Sul sito tuo nel frattempo: AppLixir rewarded
(già cablato) + display AdinPlay/AdSense (slot pronto). AdSense è l'unica
senza soglia DAU per il sito proprio, ma è solo display e rende poco su un game.

## 6. Checklist "cosa serve da te"

- [ ] **Account sviluppatore su CrazyGames / GameMonetize / GameDistribution** (zero requisiti — basta l'export statico del gioco)
- [ ] **PAT GitHub** (token con scope `repo`) per pushare il web su GitHub
- [ ] **Dominio** tuo (per AppLixir / AdinPlay / AdSense sul sito proprio)
- [ ] **Account AppLixir** + registrazione sito + API key (se in target 5k DAU)
- [ ] **Account Stripe** se vuoi IAP con Payment Links
- [ ] (dopo) **mini-backend webhook** per accredito sicuro gemme/ads
