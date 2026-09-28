#!/usr/bin/env python3
"""Registra il gioco web Block Blast Rosso 1:1 dall'INIZIO DEL GAMEPLAY col
bot JavaScript che gioca (drag reali come un giocatore in carne e ossa).
Viewport 1080x1920 nativo (design scale 1:1). Cattura screenshot ai milestone
(2000/3000/4000/5000/100000) e salva events.json con i timestamp esatti per
il taglio x5 dall'inizio.

Lanciato DETACHED dalla route /api/rosso-video (figlio del next-server
persistente) così sopravvive ai confini delle chiamate tool.
"""
import json
import os
import time

from playwright.sync_api import sync_playwright

OUT = '/home/z/my-project/download/bot-video-rosso'
os.makedirs(OUT, exist_ok=True)
URL = 'http://localhost:3000/play?clean=1&bot=1&speed=0.3&version=rosso-1-1'
VIEW_W, VIEW_H = 1080, 1920
SESSION_MAX = 1500          # cap della sessione di gioco (secondi)
TARGET = 2000               # milestone minima garantita: dopo, continua fino al cap
EXTRA_AFTER_TARGET = 99999  # dopo il target continua fino al cap sessione
MILESTONES = [2000, 3000, 4000, 5000, 100000]

events = {'t0': None, 'game_mount': None, 'game_over': None,
          'milestones': {}, 'final_score': None, 'samples': []}

with sync_playwright() as pw:
    browser = pw.chromium.launch(args=['--force-device-scale-factor=1'])
    ctx = browser.new_context(
        viewport={'width': VIEW_W, 'height': VIEW_H},
        record_video_dir=OUT,
        record_video_size={'width': VIEW_W, 'height': VIEW_H},
        is_mobile=True, has_touch=True,
        device_scale_factor=1,
    )
    page = ctx.new_page()
    events['t0'] = time.time()

    page.goto(URL, wait_until='domcontentloaded', timeout=60000)
    print('pagina caricata, aspetto che il bot prema PLAY...', flush=True)

    # aspetta l'API di gioco = inizio gameplay
    deadline = time.time() + 120
    while time.time() < deadline:
        if page.evaluate("typeof window.__BB__ !== 'undefined'"):
            events['game_mount'] = time.time()
            print('GAMEPLAY START', flush=True)
            break
        time.sleep(0.1)
    if events['game_mount'] is None:
        print('ERROR: il gioco non è mai partito')
        ctx.close()
        raise SystemExit(1)

    time.sleep(1.0)
    reached = set()
    end_at = None
    t_start = time.time()
    last_score = -1
    stuck_zero = 0
    last_sample = 0

    while time.time() - t_start < SESSION_MAX:
        try:
            st = page.evaluate(
                "(() => { const b = window.__BB__; return b ? "
                "{s: b.getScore(), over: b.isGameOver()} : null; })()")
        except Exception:
            st = None
        if st is None:
            time.sleep(0.4)
            continue
        score, over = st['s'], st['over']

        now = time.time()
        if now - last_sample >= 5:
            events['samples'].append([round(now - events['t0'], 2), score])
            last_sample = now

        if score == 0 and last_score == 0:
            stuck_zero += 1
        else:
            stuck_zero = 0
        last_score = score
        if stuck_zero > 150:
            print('bot fermo a 0 — stop', flush=True)
            break

        for m in MILESTONES:
            if m not in reached and score >= m:
                reached.add(m)
                events['milestones'][str(m)] = time.time() - events['t0']
                time.sleep(0.9)
                page.screenshot(path=f'{OUT}/milestone-{m}.png')
                print(f'*** MILESTONE {m} (score={score}) ***', flush=True)
                if m == TARGET:
                    end_at = time.time() + EXTRA_AFTER_TARGET
        if over:
            events['game_over'] = time.time() - events['t0']
            events['final_score'] = score
            print(f'GAME OVER a {score}', flush=True)
            time.sleep(2.5)
            page.screenshot(path=f'{OUT}/gameover-{score}.png')
            break
        if end_at is not None and time.time() >= end_at:
            events['final_score'] = score
            print(f'target superato, stop a {score}', flush=True)
            break
        time.sleep(0.25)

    events['final_score'] = last_score
    video = page.video.path()
    ctx.close()
    browser.close()
    events['video'] = video
    events['duration'] = time.time() - events['t0']
    with open(f'{OUT}/events.json', 'w') as f:
        json.dump(events, f, indent=1)
    print(json.dumps({k: v for k, v in events.items() if k not in ('video', 'samples')}, indent=1))
    print('SAMPLES (ultimi 5):', events['samples'][-5:])
    print('VIDEO:', video)
