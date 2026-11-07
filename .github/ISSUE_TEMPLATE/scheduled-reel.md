---
name: Programma video / Reels
about: Schedula rendering MP4 tramite GitHub Actions (non pubblica sui social)
title: "[REEL] "
labels: []
assignees: []
---

**Attenzione: repository pubblico.** La issue, l'orario e tutte le opzioni
sono visibili pubblicamente. Non inserire password, token o bozze private.
La coda accetta solo issue create dal proprietario del repository.

Imposta runAt in UTC (con Z), per esempio 2026-11-10T18:00:00Z.
GitHub avvia i cicli circa ogni 15 minuti, ma può ritardarli.

```json
{
  "runAt": "2026-11-10T18:00:00Z",
  "count": 1,
  "seconds": 15,
  "speed": 4,
  "format": "instagram-reels",
  "framing": "safe"
}
```

Formati social:
instagram-reels, youtube-shorts, tiktok, snapchat, douyin,
instagram-feed, square, youtube-landscape, bilibili.

Formati gameplay:
gameplay-portrait-fhd, gameplay-portrait-4k, gameplay-landscape-fhd,
gameplay-landscape-4k, gameplay-ultrawide, gameplay-square.

- count: da 1 a 3 (massimo 1 nei formati 4K).
- seconds: 6, 15, 30, 45 o 60 (massimo 15 nei formati 4K).
- speed: 2, 4 o 8.
- framing: fit (gioco intero) o safe (margini UI social).

La coda aggiunge commenti con lo stato; a successo chiude la issue.
Scarica gli MP4 dagli artifact del run GitHub Actions linkato.
**Non viene effettuato autopost su TikTok, Instagram o YouTube.**
