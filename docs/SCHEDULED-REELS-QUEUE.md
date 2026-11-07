# BlockRush · Reels queue gratuita

La coda e la pianificazione video utilizzano **GitHub Issues + GitHub
Actions** e non richiedono Redis, Render, server sempre accesi, carte di
credito o token dei social. E' una coda di **rendering**: non pubblica
automaticamente i contenuti sulle piattaforme esterne.

## Come programmare un video

1. Una volta che il workflow è presente nel branch di default (main), vai
   in Issues > New issue > **Programma video / Reels**.
2. **Crea la issue usando l'account proprietario del repository**; issue
   create da altri utenti vengono ignorate per sicurezza.
3. Mantieni il titolo con prefisso [REEL] e modifica i sei valori JSON.
   Non aggiungere altri campi.
4. La coda controlla le scadenze ogni ~15 minuti tramite un cron GitHub,
   oppure usa Actions > Free Scheduled Reels Queue > Run workflow per
   verificare immediatamente i job maturi. I cron GitHub non garantiscono
   l'esecuzione puntuale (possono essere ritardati).
5. Apri il link al run aggiunto automaticamente come commento. Al termine
   scarica il file ZIP degli MP4 e manifest dalla sezione **Artifacts** del
   run. Gli artifact scadono dopo **30 giorni**.

Esempio, rendering da un minuto alle 18:30 UTC del 10 novembre:

```json
{
  "runAt": "2026-11-10T18:30:00Z",
  "count": 1,
  "seconds": 60,
  "speed": 4,
  "format": "instagram-reels",
  "framing": "safe"
}
```

Attualmente i formati sono: instagram-reels, youtube-shorts, tiktok,
snapchat, douyin, instagram-feed, square, youtube-landscape, bilibili,
gameplay-portrait-fhd, gameplay-portrait-4k, gameplay-landscape-fhd,
gameplay-landscape-4k, gameplay-ultrawide e gameplay-square.

Per le risoluzioni gameplay usa framing fit, così il gameplay è conservato
interamente. Formati 4K: massimo un video e 15 secondi per job, in modo
prudenziale per i runner gratuiti; anche così **non è garantita** la
compatibilità dei runner con tutti i video 4K.

## Persistenza, retry, costi

- Le issue e i commenti GitHub sono la fonte dello stato persistente.
  Ogni cron seleziona un solo job scaduto e dell'account proprietario.
- GitHub Actions impedisce due run concorrenti della coda tramite
  concurrency. Dopo un arresto inatteso la lease scade in 65 minuti;
  se il run precedente aveva già caricato l'artifact, il job viene
  completato senza renderizzare un doppione.
- Massimo **3 tentativi** per job. Un errore resta visibile nella issue e
  viene ritentato alla successiva scansione. Esauriti i tentativi,
  la issue viene chiusa con un commento di errore.
- Le regole dei minuti gratuiti e la disponibilità dei runner dipendono
  dal tipo di repository e dall'offerta GitHub vigente. L'esecuzione
  di Actions sui repository pubblici standard è generalmente gratuita
  sui runner ospitati GitHub, senza garanzia di capacità illimitata.
- Non usare questo sistema per creare una grande coda non presidiata di
  rendering 4K; GitHub Actions impone limiti di tempo e risorse.

## Avviso privacy e pubblicazione

**Questo repository è pubblico: tutte le issue di coda, i relativi
commenti, i nomi dei formati, gli orari, e gli artifact dei workflow
pubblici sono potenzialmente visibili a chiunque.** Non inserire credenziali,
email personali, bozze riservate, dati utente, file proprietari o token
all'interno delle issue. Per workflow non pubblici occorre migrare la
coda su un repository privato e rivalutare i costi di Actions.

Lo scheduler non contiene OAuth e non automatizza la pubblicazione social.
Per pubblicare è necessario scaricare i file ed effettuarne l'upload
manuale o configurare separatamente un'integrazione approvata, con i
permessi richiesti dalle piattaforme.

## Dipendenza di build (temporanea)

Il workflow legge il generatore video dal branch
codex/blockrush-video-resolutions. Quando le modifiche delle risoluzioni
saranno integrate in main, conviene allineare anche questo ref a main.
Senza quel branch o se il recorder non supporta il formato scelto, il
rendering fallisce e la queue registra il tentativo, fino a max 3.
