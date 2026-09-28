#!/usr/bin/env python3
"""Registra la run completa Block Rush 1:1 dall'INIZIO DEL GAMEPLAY col bot
JavaScript a velocita' x10 (~8 mosse/sec): attraversa i milestone
2000 -> 3000 -> 4000 -> 5000 -> 100000. Viewport 1080x1920 nativo.

Salva in download/gameplay-video/:
  - webm grezzo (master)
  - milestone-*.png (screenshot puliti a ogni traguardo)
  - events.json (timestamp esatti di ogni evento per il taglio dei video)
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

OUT = '/home/z/my-project/download/gameplay-video'
os.makedirs(OUT, exist_ok=True)
URL = 'http://localhost:3000/play?clean=1&bot=1&speed=10&version=rush'
VIEW_W, VIEW_H = 1080, 1920
SESSION_MAX = float(sys.argv[1]) if len(sys.argv) > 1 else 500
# (in modalita' detached non c'e' il cap dei 600s per chiamata tool)
TARGET = 100000            # traguardo finale
EXTRA_AFTER_TARGET = 8     # secondi di gioco extra dopo il traguardo
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
    # nascondi l'indicatore dev di Next.js (non serve riavviare il server)
    try:
        page.add_style_tag(content='nextjs-portal{display:none!important}')
    except Exception:
        pass
    print('pagina caricata, il bot preme PLAY...', flush=True)

    # inizio gameplay = API di gioco disponibile
    deadline = time.time() + 90
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
    moves0 = -1

    while time.time() - t_start < SESSION_MAX:
        try:
            st = page.evaluate(
                "(() => { const b = window.__BB__; return b ? "
                "{s: b.getScore(), over: b.isGameOver(), m: (b.getStats ? b.getStats().moves : -1)} : null; })()")
        except Exception:
            st = None
        if st is None:
            time.sleep(0.3)
            continue
        score, over = st['s'], st['over']
        if 'm' in st and st['m'] >= 0:
            moves0 = st['m']

        now = time.time()
        if now - last_sample >= 4:
            events['samples'].append([round(now - events['t0'], 2), score])
            last_sample = now

        if score == 0 and last_score == 0:
            stuck_zero += 1
        else:
            stuck_zero = 0
        last_score = score
        if stuck_zero > 200:
            print('bot fermo a 0 — stop', flush=True)
            break

        for m in MILESTONES:
            if m not in reached and score >= m:
                reached.add(m)
                events['milestones'][str(m)] = round(time.time() - events['t0'], 2)
                time.sleep(0.8)
                page.screenshot(path=f'{OUT}/milestone-{m}.png')
                print(f'*** MILESTONE {m} (score={score}) ***', flush=True)
                if m == TARGET:
                    end_at = time.time() + EXTRA_AFTER_TARGET
        if over:
            events['game_over'] = round(time.time() - events['t0'], 2)
            events['final_score'] = score
            print(f'GAME OVER a {score}', flush=True)
            time.sleep(2.5)
            page.screenshot(path=f'{OUT}/gameover-{score}.png')
            break
        if end_at is not None and time.time() >= end_at:
            events['final_score'] = score
            print(f'traguardo {TARGET} superato, stop a {score}', flush=True)
            break
        time.sleep(0.2)

    events['final_score'] = last_score
    events['moves'] = moves0
    events['duration'] = round(time.time() - events['t0'], 2)
    video = page.video.path()
    ctx.close()
    browser.close()
    events['video'] = video
    with open(f'{OUT}/events.json', 'w') as f:
        json.dump(events, f, indent=1)
    print(json.dumps({k: v for k, v in events.items() if k not in ('video', 'samples')}, indent=1))
    print('VIDEO:', video)
