#!/usr/bin/env python3
"""Record the Block Rush 1:1 web game from GAMEPLAY START with the JS bot
playing (real drags, speed slider ~10x). Captures milestone screenshots
(2000/3000/4000/5000/100000) and logs precise wall-clock timestamps so the
encode step can cut the video exactly from the beginning of gameplay.

Runs entirely in the foreground of ONE long tool call (sandbox reaper kills
background processes at the end of a call).
"""
import json
import os
import time

from playwright.sync_api import sync_playwright

OUT = '/home/z/my-project/download/bot-video-rush'
os.makedirs(OUT, exist_ok=True)
URL = 'http://localhost:3000/play?clean=1&bot=1&speed=0.3'
VIEW_W, VIEW_H = 430, 932
SESSION_MAX = 440  # safety margin vs the 600s call cap
TARGET = None      # record until game over or session cap (max content)
MILESTONES = [2000, 3000, 4000, 5000, 100000]

events = {'t0': None, 'game_mount': None, 'game_over': None,
          'milestones': {}, 'final_score': None}

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

    page.goto(URL, wait_until='domcontentloaded', timeout=30000)
    print('page loaded, waiting for the bot to press PLAY...', flush=True)

    # wait for the game API (gameplay start)
    deadline = time.time() + 60
    while time.time() < deadline:
        if page.evaluate("typeof window.__BB__ !== 'undefined'"):
            events['game_mount'] = time.time()
            print('GAMEPLAY START', flush=True)
            break
        time.sleep(0.1)
    if events['game_mount'] is None:
        print('ERROR: game never mounted')
        ctx.close()
        raise SystemExit(1)

    # wait a moment for the first tray, then poll
    time.sleep(1.0)
    reached = set()
    end_at = None
    t_start = time.time()
    last_score = -1
    stuck_zero = 0

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

        if score == 0 and last_score == 0:
            stuck_zero += 1
        else:
            stuck_zero = 0
        last_score = score
        if stuck_zero > 120:
            print('bot seems stalled at 0 — stopping', flush=True)
            break

        for m in MILESTONES:
            if m not in reached and score >= m:
                reached.add(m)
                events['milestones'][str(m)] = time.time()
                # let the count-up settle, then screenshot without any overlay
                time.sleep(0.9)
                page.screenshot(path=f'{OUT}/milestone-{m}.png')
                print(f'*** MILESTONE {m} (score={score}) ***', flush=True)
                if m == TARGET:
                    end_at = time.time() + 6  # show a bit more action, then stop
        if over:
            events['game_over'] = time.time()
            events['final_score'] = score
            print(f'GAME OVER at {score}', flush=True)
            time.sleep(2.5)
            page.screenshot(path=f'{OUT}/gameover-{score}.png')
            break
        if end_at is not None and time.time() >= end_at:
            events['final_score'] = score
            print(f'target reached, stopping at {score}', flush=True)
            break
        time.sleep(0.25)

    events['final_score'] = last_score
    # save the video
    video = page.video.path()
    ctx.close()
    browser.close()
    events['video'] = video
    with open(f'{OUT}/events.json', 'w') as f:
        json.dump(events, f, indent=1)
    print(json.dumps({k: v for k, v in events.items() if k != 'video'}, indent=1))
    print('VIDEO:', video)
