#!/usr/bin/env python3
"""Diagnose a single drag on the LOCAL mirror with verbose CurSpot tracking."""
import json
import sys
import time

sys.path.insert(0, "/home/z/my-project/scripts")
import bot_player as bp

from bot_player import READ_STATE_JS, DRAG_READ_JS, GV_SETUP_JS
from playwright.sync_api import sync_playwright

GAME_URL = "http://127.0.0.1:8931/index.html"
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")

SEED_JS = open("/home/z/my-project/scripts/bot_video.py").read().split('SEED_JS = """')[1].split('"""')[0]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1080, "height": 1920},
        has_touch=True, is_mobile=True, device_scale_factor=1, user_agent=UA)
    page = ctx.new_page()
    page.add_init_script("window.OffscreenCanvas = undefined;")
    page.add_init_script(SEED_JS)
    page.goto(GAME_URL, wait_until="domcontentloaded")
    for _ in range(20):
        try:
            if page.evaluate("() => !!(window.c3_runtimeInterface && window.c3_runtimeInterface._localRuntime)"):
                break
        except Exception:
            pass
        page.wait_for_timeout(1000)
    page.evaluate(GV_SETUP_JS)
    cdp = ctx.new_cdp_session(page)
    bot = bp.Bot(page, page, cdp, lambda m: print("[bot]", m, flush=True))
    bot.refresh_spots()

    st = bot.read()
    for _ in range(20):
        if st["pieces"]:
            break
        time.sleep(0.7)
        st = bot.read()
    pieces = bot.tray_pieces(st)
    print("placeholders:", st["placeholders"])
    print("parents:", st["parents"])
    print("pieces:", [(pc["ph"], pc["shapeIdx"], len(pc["blocks"])) for pc in pieces])
    print("gv:", st["gv"])
    piece = pieces[0]
    parent = next(sp for sp in st["parents"] if sp["ph"] == piece["ph"])
    info = page.evaluate(DRAG_READ_JS, parent["u"])
    print("parent:", parent)
    print("drag info:", json.dumps(info, indent=1)[:600])
    print("spot (2,1) uid:", bot.uid_by_cell.get((2, 1)))
    print("spot (3,4) uid:", bot.uid_by_cell.get((3, 4)))

    # --- grab ---
    bx = parent["x"] + piece["blocks"][0]["x"]
    by = parent["y"] + piece["blocks"][0]["y"]
    print(f"grab at ({bx:.0f},{by:.0f})")
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart",
              "touchPoints": [{"x": bx, "y": by, "id": 1}]})
    time.sleep(0.12)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchMove",
              "touchPoints": [{"x": bx + 12, "y": by - 10, "id": 1}]})
    time.sleep(0.2)
    print("SelectedShape:", bot.gv("SelectedShape"), "vs parent", parent["u"])

    # --- re-read parent pos while dragging (lifted) ---
    info2 = page.evaluate(DRAG_READ_JS, parent["u"])
    print("while dragging:", json.dumps(info2, indent=1)[:600])

    # --- move over spot (3,4) using the v2 formula, scale 2 ---
    tx, ty = 120 + 3 * 120, 411 + 4 * 120
    lx, ly = info2["blocks"][0]["x"], info2["blocks"][0]["y"]
    dx = info2["dx"]
    for scale in (2.0, 1.0):
        fx = tx - lx * scale - dx
        fy = ty - ly * scale + 200
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove",
                  "touchPoints": [{"x": fx, "y": fy, "id": 1}]})
        time.sleep(0.25)
        cur = bot.gv("CurSpot")
        cell = bot.spot_by_uid.get(cur)
        print(f"scale={scale} finger=({fx:.0f},{fy:.0f}) CurSpot={cur} cell={cell}")
        if cur is not None and cur != 0:
            break

    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    time.sleep(0.8)
    st2 = bot.read()
    print("after drop:", st2["gv"])
    page.screenshot(path="/tmp/diag-drop.png")
    browser.close()
