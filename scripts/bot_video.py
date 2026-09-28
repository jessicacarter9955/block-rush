#!/usr/bin/env python3
"""Block Blast VIDEO bot v2 — two-phase marketing recorder (1080x1920).

Phase 1  WARM-UP: plays at machine pace on the local mirror, restarting on
         every game over, until the score crosses TARGET (default 800).
Phase 2  RECORDING: keeps playing the SAME game at a human, watchable pace
         until the game ends (the game-over screen is the video ending) or
         RECORD_MAX seconds. Then the whole session webm is trimmed from the
         TARGET crossing (minus a short preroll) and converted to MP4.

Fixes vs v1 (the run that stalled at 265):
- Root cause of the stall: the GameDistribution SDK fired PauseGame ->
  System.SetTimescale(0) -> the whole game clock froze, so the 5s revive
  countdown never expired and the bot looped forever. Now window.gdsdk is
  stubbed via an init script AND ad/SDK network requests are route-blocked,
  so the SDK can never pause the game. A 1s watchdog also forces the
  runtime timescale back to 1 as belt-and-braces.
- The Revive popup has NO close button in the original (only BtnRevive +
  countdown); v1 tapped empty space at (918, 275). v2 simply waits for the
  5s countdown to auto-transition to GameOver, forcing it via
  window.c3_callFunction("ShowGameOverLayer") only if stuck > 12s.
- Deadlock guards: HUD with no placeable moves > 12s -> force the game's
  own GameOver() sequence; stuck Waiting > 12s -> force GameOver().

Live status -> download/bot-video/state.json (stream viewer on :3100).
"""
import json
import os
import re
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bot_player as bp

VDIR = "/home/z/my-project/download/bot-video"
bp.OUT = VDIR  # redirect Bot screenshots into the video dir

from bot_player import GV_SETUP_JS, best_move  # noqa: E402

GAME_URL = "http://127.0.0.1:8931/index.html"
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")
CDP_PORT = 9222
STATE_FILE = os.path.join(VDIR, "state.json")
LOG_FILE = os.path.join(VDIR, "run.log")
MP4_PATH = os.path.join(VDIR, "block-blast-short.mp4")

TARGET = 1800             # score at which the real recording starts
WARMUP_BUDGET = 1150.0    # max seconds to hunt for a 1800+ run
RECORD_MAX = 90.0         # max seconds of recorded gameplay
SESSION_MAX = 1400.0      # hard cap — the session now runs DETACHED under
                          # the persistent dev server (spawned via the
                          # /api/bot-run route), so there is no 600s call
                          # limit anymore
RECORD_MIN = 45.0         # min recording length; if a game over happens
                          # earlier the game restarts and recording continues
PREROLL = 2.5             # seconds of video kept before the 1800 crossing

# original-layout button coordinates (1080x1920 design space == viewport)
BTN_GORESET = (540, 1598)
BTN_CLOSE_PAUSE = (899, 482)
BTN_PLAY = (540, 1295)

FAST = {"grab": 0.08, "engage": 0.10, "steps": 5, "step_delay": 0.02,
        "settle": 0.06, "drop_wait": 0.10}
CINEMA = {"grab": 0.15, "engage": 0.16, "steps": 14, "step_delay": 0.022,
          "settle": 0.16, "drop_wait": 0.20}
MODECFG = {
    "warmup": {"pace": FAST, "post": 0.15, "settle": 1.1},
    "record": {"pace": CINEMA, "post": 0.55, "settle": 3.5},
}

SEED_JS = """
(() => {
  try {
    const req = indexedDB.open("c3-localstorage-43p8optb74l", 2);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("keyvaluepairs"))
        db.createObjectStore("keyvaluepairs");
    };
    req.onsuccess = (e) => {
      const db = e.target.result;
      try {
        const tx = db.transaction("keyvaluepairs", "readwrite");
        tx.objectStore("keyvaluepairs").put(
          JSON.stringify({SFX: 1, Music: 1, BestScore: 450, Tut: 0}),
          "Block Blast_Data");
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      } catch (err) { try { db.close(); } catch (_) {} }
    };
  } catch (e) {}
})();
"""

# Neutralize the GameDistribution SDK BEFORE it loads: a stub window.gdsdk
# means showAd()/preloadAd() are no-ops and the SDK_START message (which the
# real SDK sends when an ad starts, setting _adPlaying=true -> PauseGame ->
# SetTimescale(0)) can never arrive. The CDN script is also route-blocked.
GDSK_STUB_JS = """
(() => {
  if (window.__gd_stub) return;
  window.__gd_stub = 1;
  const ok = () => Promise.resolve();
  window.gdsdk = {
    init: ok, preloadAd: ok, showAd: ok, showBanner: () => {},
    sendEvent: () => {}, pauseGame: () => {}, resumeGame: () => {},
    getGameLang: () => "en", getGameUID: () => "stub",
  };
})();
"""

WATCHDOG_JS = """
() => {
  if (window.__wd) return true;
  window.__wd = 1;
  window.__tsfix = 0;
  setInterval(() => {
    try {
      const rt = window.c3_runtimeInterface && window.c3_runtimeInterface._localRuntime;
      if (rt && rt.GetTimeScale() < 1) {
        rt.SetTimeScale(1);
        window.__tsfix = (window.__tsfix || 0) + 1;
      }
    } catch (e) {}
  }, 1000);
  return true;
}
"""

SPOT_COUNT_JS = """
() => {const rt=window.c3_runtimeInterface._localRuntime;
 const c=rt._objectClassesByName.get('spot');
 return c ? ((c.GetInstances?c.GetInstances():c._instances)||[]).length : 0;}
"""

AD_RE = re.compile(
    r"gamedistribution|doubleclick\.|googleads|googlesyndication|adition"
    r"|smartadserver|adnxs|criteo|pubmatic|rubiconproject|casalemedia"
    r"|openx\.net|amazon-adsystem|scorecardresearch|quantserve", re.I)


def route_filter(route):
    try:
        if AD_RE.search(route.request.url):
            route.abort()
        else:
            route.continue_()
    except Exception:
        pass


# ------------------------------------------------------------------ state io

STATE = {"phase": "warmup", "state": "boot", "score": 0, "best": 0,
         "moves": 0, "elapsed": 0, "games": 1, "target": TARGET,
         "markers": [], "samples": []}
T_REC = [None]
LAST_SAMPLE = [0.0]


def write_state(**kw):
    STATE.update(kw)
    try:
        with open(STATE_FILE, "w") as f:
            json.dump(STATE, f)
    except Exception:
        pass


def marker(ev):
    if T_REC[0] is None:
        return
    STATE["markers"].append({"t": round(time.time() - T_REC[0], 2), "ev": ev})


def add_sample(score):
    if T_REC[0] is None:
        return
    now = time.time() - T_REC[0]
    if now - LAST_SAMPLE[0] >= 0.4:
        LAST_SAMPLE[0] = now
        STATE["samples"].append([round(now, 2), score])


def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass


# ------------------------------------------------------------------ bot

class LocalBot(bp.Bot):
    """Bot variant for the local mirror: no GD SDK, no consent, no ads."""

    def input_ok(self):
        try:
            r = self.page.evaluate(
                "(p) => { const e = document.elementFromPoint(p[0], p[1]);"
                " return !!(e && e.tagName !== 'IFRAME'); }", [540, 1626])
            return bool(r)
        except Exception:
            return False

    def clear_input(self):
        for _ in range(4):
            if self.input_ok():
                return True
            time.sleep(0.4)
        return self.input_ok()

    def force(self, fn_name, params=None):
        """Directly invoke an event-sheet function of the game."""
        try:
            self.page.evaluate(
                "(a) => (window.c3_callFunction ?"
                " window.c3_callFunction(a[0], a[1]) : null)",
                [fn_name, list(params or [])])
            return True
        except Exception as e:
            self.log(f"force({fn_name}) failed: {e}")
            return False


def tap(bot, xy, settle=0.6):
    bot.touch("touchStart", xy[0], xy[1])
    time.sleep(0.12)
    bot.touch("touchEnd", xy[0], xy[1])
    time.sleep(settle)


def wait_board(bot, timeout=25.0):
    t0 = time.time()
    n = 0
    while time.time() - t0 < timeout:
        try:
            n = bot.page.evaluate(SPOT_COUNT_JS)
        except Exception:
            n = 0
        if n and n >= 64:
            return True
        time.sleep(0.4)
    bot.log(f"board not rebuilt in time ({n} spots)")
    return False


# ------------------------------------------------------------------ main loop

def play_loop(bot, mode, deadline, milestones=()):
    page = bot.page
    cfg = MODECFG[mode]
    bot.pace = dict(cfg["pace"])
    post_move = cfg["post"]
    settle_to = cfg["settle"]

    pending = list(milestones)
    fails = 0
    iters = 0
    games = STATE.get("games", 1)
    best_seen = STATE.get("best", 0)
    need_settle = True
    revive_t0 = None
    wait_t0 = None
    stuck_t0 = None
    empty_logged = False
    move_times = []
    revive_n = 0
    t0 = time.time()
    last_game_t = time.time() - (T_REC[0] or time.time())
    score = STATE.get("score", 0)

    while time.time() < deadline:
        if need_settle:
            st = bot.wait_settled(timeout=settle_to)
            need_settle = False
        else:
            st = bot.read()
        gv = st["gv"] or {}
        state = gv.get("state")
        score = gv.get("score") or 0
        best_seen = max(best_seen, score)
        add_sample(score)
        write_state(state=state, score=score, best=best_seen,
                    moves=bot.move_no,
                    elapsed=round(time.time() - (T_REC[0] or time.time()), 1),
                    games=games)

        # ---- warm-up done? ----
        if mode == "warmup" and score >= TARGET:
            marker("target_reached")
            log(f"*** SCORE {score} >= {TARGET} at t="
                f"{time.time() - T_REC[0]:.1f}s -> recording phase ***")
            return {"result": "target", "score": score,
                    "t_cross": time.time() - T_REC[0],
                    "last_game_t": last_game_t}

        if state != "Revive":
            revive_t0 = None
        if state != "Waiting":
            wait_t0 = None
        if state != "HUD":
            stuck_t0 = None

        # ---- milestones: screenshots while recording ----
        while pending and score >= pending[0]:
            m = pending.pop(0)
            time.sleep(0.55)  # let the count-up settle for the screenshot
            stx = bot.read()
            if (stx["gv"] or {}).get("score", 0) >= m:
                page.screenshot(path=os.path.join(VDIR, f"milestone-{m}.png"))
                marker(f"milestone_{m}")
                log(f"*** MILESTONE {m} (score={stx['gv']['score']}) ***")
            else:
                pending.insert(0, m)
                break

        if state == "GameOver":
            time.sleep(1.8)  # score count-up + popup settle
            page.screenshot(path=os.path.join(VDIR, f"gameover-{score}.png"))
            marker(f"game_over_{score}")
            log(f"GAME OVER at {score}")
            if mode == "record" and (time.time() - t0) >= RECORD_MIN:
                log("game over on camera -> ending the recording here")
                time.sleep(4.5)  # let the final screen shine
                page.screenshot(path=os.path.join(VDIR, "final-gameover.png"))
                marker("final_gameover")
                return {"result": "gameover", "score": score,
                        "t_end": time.time() - T_REC[0],
                        "last_game_t": last_game_t}
            time.sleep(0.4)
            tap(bot, BTN_GORESET)
            time.sleep(2.4)
            wait_board(bot)
            bot._drag_cache.clear()
            bot.refresh_spots()
            fails = 0
            games += 1
            last_game_t = time.time() - T_REC[0]
            if mode == "record":
                marker("restart_during_record")
                log("new game while recording")
            need_settle = True
            continue

        if state == "Revive":
            if revive_t0 is None:
                revive_t0 = time.time()
                revive_n += 1
                marker(f"revive_{score}")
                log(f"revive popup at {score} -> forcing RewardedAdSucceed "
                    f"(attempt {revive_n})")
                page.screenshot(path=os.path.join(VDIR, f"revive-{score}.png"))
                if revive_n <= 3:
                    # The game's own post-ad continuation: closes the popup,
                    # destroys tray-overlapping blocks, respawns shapes and
                    # keeps the SAME score — exactly what a player gets after
                    # watching a rewarded ad.
                    bot.force("RewardedAdSucceed")
                    time.sleep(1.5)
                    bot._drag_cache.clear()
                    bot.refresh_spots()
                    need_settle = True
                    revive_t0 = None
                    continue
            if time.time() - revive_t0 > 10.0:
                log("revive not taking effect -> forcing ShowGameOverLayer")
                bot.force("ShowGameOverLayer")
                time.sleep(1.0)
                revive_t0 = None
            else:
                time.sleep(0.8)
            need_settle = True
            continue

        if state == "Pause":
            log("paused -> closing")
            tap(bot, BTN_CLOSE_PAUSE)
            need_settle = True
            continue
        if state == "Home":
            log("home -> pressing play")
            time.sleep(1.2)
            tap(bot, BTN_PLAY)
            time.sleep(2.0)
            wait_board(bot)
            bot._drag_cache.clear()
            bot.refresh_spots()
            last_game_t = time.time() - T_REC[0]
            need_settle = True
            continue
        if state == "Waiting":
            if wait_t0 is None:
                wait_t0 = time.time()
                log("waiting (game-over sequence starting)")
            if time.time() - wait_t0 > 12.0:
                log("stuck in Waiting -> forcing the GameOver sequence")
                bot.force("GameOver")
                time.sleep(1.0)
                wait_t0 = None
            else:
                time.sleep(0.7)
            need_settle = True
            continue
        if state != "HUD":
            log(f"unexpected state {state}; waiting")
            time.sleep(1.0)
            need_settle = True
            continue

        iters += 1
        if iters % 20 == 0:
            recent = move_times[-20:]
            avg = sum(recent) / len(recent) if recent else 0.0
            log(f"pace[{mode}]: {bot.move_no} moves, score={score}, "
                f"games={games}, {time.time() - t0:.0f}s, "
                f"avg {avg:.1f}s/move, fails={fails}")

        pieces = bot.tray_pieces(st)
        if not pieces:
            if not empty_logged:
                log("tray empty; waiting for pieces to spawn")
                empty_logged = True
            time.sleep(0.5)
            need_settle = True
            continue
        empty_logged = False
        mv = best_move(st["grid"], pieces)
        if mv is None:
            if stuck_t0 is None:
                stuck_t0 = time.time()
                log("no placeable move; waiting for the game to end")
            if time.time() - stuck_t0 > 15.0:
                log("game not ending by itself -> forcing GameOver()")
                bot.force("GameOver")
                stuck_t0 = None
            time.sleep(1.0)
            need_settle = True
            continue

        chosen = next((p for p in pieces if p["ph"] == mv["ph"]), None)
        parent = next((sp for sp in st["parents"] if sp["ph"] == mv["ph"]), None)
        if chosen is None or parent is None:
            time.sleep(0.4)
            need_settle = True
            continue
        parent_uid = parent["u"]
        parent_pos = (parent["x"], parent["y"])
        anchor_local = (chosen["blocks"][0]["x"], chosen["blocks"][0]["y"])

        t_move = time.time()
        bot.move_no += 1
        sx, sy = mv["anchor_spot"]
        ok = bot.drag_to(parent_uid, parent_pos, anchor_local, sx, sy)
        if ok:
            time.sleep(post_move)
            st2 = bot.read()
            score2 = (st2["gv"] or {}).get("score") or 0
            chosen_gone = all(p["ph"] != mv["ph"] for p in st2["pieces"])
            if chosen_gone or score2 > score or \
                    len(st2["pieces"]) != len(st["pieces"]):
                fails = 0
                move_times.append(time.time() - t_move)
                st = st2
                continue
        fails += 1
        if fails == 3:
            log("re-mapping spots after repeated drag failures")
            bot.refresh_spots()
        if fails > 8:
            log("too many failed moves; ending session")
            page.screenshot(path=os.path.join(VDIR, "stuck.png"))
            marker("stuck")
            return {"result": "stuck", "score": score,
                    "t_end": time.time() - T_REC[0],
                    "last_game_t": last_game_t}
        time.sleep(0.4)
        need_settle = True

    log(f"{mode} deadline reached")
    return {"result": "budget" if mode == "warmup" else "maxlen",
            "score": score, "t_end": time.time() - T_REC[0],
            "last_game_t": last_game_t}


# ------------------------------------------------------------------ main

def main():
    os.makedirs(VDIR, exist_ok=True)
    os.makedirs(os.path.join(VDIR, "raw"), exist_ok=True)
    log("=== video bot v2 session start (warm-up until "
        f"{TARGET}, then recording) ===")
    STATE["markers"] = []
    STATE["samples"] = []
    write_state(phase="warmup", state="boot", score=0, best=0, moves=0,
                elapsed=0, games=1, target=TARGET, mp4=None)
    video_path = None
    t_start = 0.0
    t_end = 0.0

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[f"--remote-debugging-port={CDP_PORT}",
                  "--disable-background-timer-throttling",
                  "--disable-renderer-backgrounding",
                  "--autoplay-policy=no-user-gesture-required"])
        ctx = browser.new_context(
            viewport={"width": 1080, "height": 1920},
            has_touch=True, is_mobile=True, device_scale_factor=1,
            user_agent=UA,
            record_video_dir=os.path.join(VDIR, "raw"),
            record_video_size={"width": 1080, "height": 1920},
        )
        ctx.route("**/*", route_filter)
        T_REC[0] = time.time()
        page = ctx.new_page()
        page.add_init_script("window.OffscreenCanvas = undefined;")
        page.add_init_script(SEED_JS)
        page.add_init_script(GDSK_STUB_JS)
        page.goto(GAME_URL, wait_until="domcontentloaded", timeout=30000)

        for _ in range(30):
            try:
                if page.evaluate(
                        "() => !!(window.c3_runtimeInterface && "
                        "window.c3_runtimeInterface._localRuntime)"):
                    break
            except Exception:
                pass
            page.wait_for_timeout(1000)
        page.evaluate(GV_SETUP_JS)
        page.evaluate(WATCHDOG_JS)
        video_path = page.video.path()
        write_state(video=video_path)
        marker("runtime_up")
        log(f"runtime up; recording -> {video_path}")

        n_spots = 0
        for _ in range(60):
            n_spots = page.evaluate(SPOT_COUNT_JS)
            if n_spots >= 64:
                break
            page.wait_for_timeout(500)
        log(f"board ready: {n_spots} spots")

        cdp = ctx.new_cdp_session(page)
        bot = LocalBot(page, page, cdp, log)
        bot.refresh_spots()

        st = bot.read()
        log(f"up: state={st['gv']['state']} score={st['gv']['score']} "
            f"tut={st['gv']['tut']}")
        page.screenshot(path=os.path.join(VDIR, "00-start.png"))
        marker("game_start")

        if bot.gv("TutNum"):
            log("tutorial active -> playing it")
            bot.play_tutorial()
            page.screenshot(path=os.path.join(VDIR, "01-after-tutorial.png"))
            bot._drag_cache.clear()
            bot.refresh_spots()

        # ---- phase 1: warm-up at machine pace ----
        session_deadline = time.time() + SESSION_MAX
        res = play_loop(bot, "warmup",
                        min(time.time() + WARMUP_BUDGET, session_deadline))
        if res["result"] == "target":
            t_start = max(0.0, res["t_cross"] - PREROLL)
            time.sleep(0.55)
            stx = bot.read()
            page.screenshot(path=os.path.join(VDIR, f"milestone-{TARGET}.png"))
            log(f"warm-up complete: score {res['score']} "
                f"(video starts at t={t_start:.1f}s)")
        else:
            t_start = max(0.0, res.get("last_game_t", 0.0))
            log(f"WARN: {TARGET} not reached ({res}); recording the current "
                f"game from its start (t={t_start:.1f}s)")
        write_state(phase="recording", t_start=round(t_start, 2))
        marker("recording_start")

        # ---- phase 2: the actual marketing footage ----
        res2 = play_loop(bot, "record",
                         min(time.time() + RECORD_MAX, session_deadline),
                         milestones=(1900, 2000, 2200))
        t_end = res2.get("t_end") or (time.time() - T_REC[0])
        log(f"record phase done: {res2['result']} score={res2['score']}")

        page.screenshot(path=os.path.join(VDIR, "02-final.png"))
        marker("session_end")
        try:
            stf = bot.read()
            final_state = (stf["gv"] or {}).get("state")
        except Exception:
            final_state = "done"
        ts_fix = 0
        try:
            ts_fix = page.evaluate("() => window.__tsfix || 0")
        except Exception:
            pass
        log(f"timescale watchdog interventions: {ts_fix}")
        write_state(phase="done", state=final_state,
                    score=res2["score"], moves=bot.move_no,
                    t_end=round(t_end, 2))
        log(f"FINAL: best={STATE['best']} games={STATE['games']} "
            f"moves={bot.move_no}")

        ctx.close()  # flush the .webm recording
        browser.close()

    # ---- hand the trim window to the detached pipeline encoder ----
    # (encoding inside the session process would spike CPU and risk the
    #  watchdog; run_1800_session.py does the x10 cut after we exit)
    if video_path and os.path.exists(video_path):
        dur = max(1.0, t_end - t_start + 1.0)
        log(f"SESSION COMPLETE: video={video_path} "
            f"trim=(-ss {t_start:.2f} -t {dur:.2f}); pipeline encodes x10")
        write_state(video=video_path, t_start=round(t_start, 2),
                    t_end=round(t_end, 2), dur=round(dur, 2),
                    note=f"crossing {TARGET} on camera; x10 cut pending")
    else:
        log("WARNING: video file not found after close")
    return 0


if __name__ == "__main__":
    sys.exit(main())
