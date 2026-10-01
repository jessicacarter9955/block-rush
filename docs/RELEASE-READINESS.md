# Pubblicazione — stato al 30 settembre 2026

Il gioco principale è già Flutter + Flame nativo (Dart), con build web e workflow APK Android. `block-rush` è la versione web React/Next con bot, slider e recorder. Non è necessaria una seconda conversione del gioco mobile.

## Interventi completati

Ogni nuovo vassoio dispone di una sequenza verificata che colloca tutti i pezzi, simulando anche le cancellazioni. I pezzi restano fissi: scelte successive del giocatore possono portare alla sconfitta. Il gioco conserva l’ultima sequenza completa valida e la relativa griglia; Vedi soluzione nel game over ne mostra un replay separato, senza cambiare punteggio o partita. Il pulsante ? accanto alla pausa apre il dialog per ottenere il prossimo suggerimento tramite rewarded ad. Punteggio e record si ridimensionano in aree separate.

Corona originale ricreata in alta definizione, gemme sfaccettate, scie multicolore rettilinee, numeri combo senza ritaglio, pannelli coerenti. Le 64 celle sono disegnate esplicitamente per eliminare le celle fuse nell'immagine di riferimento.

## Cosa manca per distribuire

| Destinazione | Lavoro ancora necessario |
| --- | --- |
| Google Play | Application ID definitivo; keystore/upload key e firma release; Android App Bundle AAB; account Play Console, pagina store, privacy/Data Safety, classificazione età, test su dispositivi. L'APK CI attuale usa la chiave debug: serve per test, non è la consegna Play Store. Per nuovi account personali soggetti al requisito Google: test chiuso con almeno 12 tester per 14 giorni consecutivi prima di richiedere l'accesso produzione. |
| Apple App Store | Scaffold iOS, Mac/Xcode, bundle ID, team e provisioning; icone/launch screen, archivio firmato, TestFlight su iPhone/iPad, privacy e scheda App Store Connect; invio in review. Build iOS non verificata in questa sessione Windows. |
| itch.io / sito HTML | Build web release con tutti gli asset, ZIP con index.html alla radice e percorsi relativi; test in iframe, touch, audio dopo interazione e salvataggi. Caricare il pacchetto sulla pagina HTML Game e impostare fullscreen/mobile. |
| YouTube Playables | Accesso al programma/Developer Portal, integrazione Playables SDK e ciclo di vita, audio, dati/punteggio; verifica dei requisiti di rete, caricamento e dimensioni, test suite e certificazione. Non basta caricare un APK o un link web. |
| Steam | Pacchetto desktop (es. Flutter Windows), test mouse/tastiera e ridimensionamento, account Steamworks, pagina store, depots e review. Steam Direct indica 100 USD/prodotto, attesa iniziale di 30 giorni e pagina Coming Soon per almeno due settimane. La versione Steam non deve basarsi su annunci pubblicitari. |
| CrazyGames e altri portali HTML | Adattare il bundle alle specifiche del portale e superare QA. CrazyGames consente una Basic Launch senza integrazione specifica e senza monetizzazione; Full Launch richiede l'integrazione completa. |

## Decisioni prima di una release pubblica

- La classifica usa dati dimostrativi e record locale: per una classifica reale occorrono servizio online, autenticazione/identificatori e validazione punteggi, oppure etichettare chiaramente la demo.
- Il pannello di continuazione è gratuito nella preview; nessun annuncio reale è stato integrato. Il suggerimento ha un adapter per rewarded ads: solo il completamento sblocca l’aiuto, mentre annullamento, errore e assenza di provider non concedono premi. Occorre collegare un SDK reale e il consenso applicabile. Il comando demo è disponibile solo in sviluppo.
- Confermare diritti di distribuzione di nome, logo, sprites, font e audio derivati dal progetto originale. Preparare icone e screenshot store definitivi.
- Test finali su hardware Android/iOS, accessibilità, pause/resume e audio in background; misurare memoria, caricamento e fluidità su dispositivi economici.
- Il recorder desktop richiede la selezione della scheda di gioco tramite il browser. Crop, slider e rilascio delle risorse sono coperti da test; la cattura con il selettore di condivisione reale resta da provare manualmente.

## Fonti ufficiali

- Google Play: https://support.google.com/googleplay/android-developer/answer/14151465?hl=en
- Apple review: https://developer.apple.com/app-store/review/
- itch.io HTML5: https://itch.io/docs/creators/html5
- YouTube certificazione: https://developers.google.com/youtube/gaming/playables/certification/requirements
- Steam Direct: https://partner.steamgames.com/steamdirect
- CrazyGames: https://docs.crazygames.com/

## Anteprime locali

- Flutter: http://127.0.0.1:5173/
- Recorder: http://127.0.0.1:3000/play/
- In sviluppo: `?preview=combo`, `?preview=revive`, `?preview=gameover`, `?preview=digits`; Flutter aggiunge `?preview=fair` per la soluzione guidata. Le scene di debug sono escluse dalle build release e non registrano record dimostrativi.
