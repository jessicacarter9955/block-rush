#!/usr/bin/env python3
"""Detached 1800-session pipeline.

Spawned by the Next.js /api/bot-run route as a child of the PERSISTENT dev
server, so it survives tool-call boundaries (tool-call children get killed
when the call ends; the dev server does not).

Sequence:
  1. game mirror on :8931 (static http server)
  2. live preview on :3100 (stream_server.py, MJPEG + state)
  3. bot_video.py v3 — warm-up to 1800 (with revive insurance), then 90s of
     CINEMA-pace recording; writes trim window + webm path to state.json
  4. x10 re-time encode via encode_throttled.py (CPU-watchdog safe)
     -> download/bot-video/block-blast-1800-10x.mp4
"""
import json
import os
import subprocess
import sys
import time

BASE = "/home/z/my-project"
VDIR = f"{BASE}/download/bot-video"
STATE = f"{VDIR}/state.json"
LOCK = f"{VDIR}/pipeline.lock"
OUT_MP4 = f"{VDIR}/block-blast-1800-10x.mp4"
PY = sys.executable


def log(msg):
    print(f"[pipeline {time.strftime('%H:%M:%S')}] {msg}", flush=True)


def read_state():
    try:
        with open(STATE) as f:
            return json.load(f)
    except Exception:
        return {}


def write_state(**kw):
    st = read_state()
    st.update(kw)
    try:
        with open(STATE, "w") as f:
            json.dump(st, f)
    except Exception:
        pass


def main():
    os.makedirs(VDIR, exist_ok=True)

    # ---- single-instance guard ----
    if os.path.exists(LOCK):
        try:
            old = int(open(LOCK).read().strip())
            os.kill(old, 0)
            log(f"pipeline already running (pid {old}); aborting")
            return 1
        except Exception:
            log("stale lock found; taking over")
    with open(LOCK, "w") as f:
        f.write(str(os.getpid()))

    game = stream = None
    try:
        log("cleaning leftovers from previous sessions")
        for pat in ("http.server 8931", "stream_server.py", "bot_video.py",
                    "remote-debugging-port=9222"):
            subprocess.run(["pkill", "-f", pat], capture_output=True)
        time.sleep(1.5)

        log("game mirror on :8931")
        game = subprocess.Popen(
            [PY, "-m", "http.server", "8931",
             "--directory", f"{BASE}/game-mirror"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log("live preview on :3100")
        stream = subprocess.Popen(
            [PY, f"{BASE}/scripts/stream_server.py"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(2.0)

        log("bot session starting (target 1800 — expect ~15 min)")
        bot = subprocess.run([PY, f"{BASE}/scripts/bot_video.py"])
        log(f"bot exited rc={bot.returncode}")
    finally:
        for proc in (stream, game):
            try:
                if proc:
                    proc.terminate()
            except Exception:
                pass

    # ---- x10 encode from the trim window the bot wrote to state.json ----
    st = read_state()
    video, t0, t1 = st.get("video"), st.get("t_start"), st.get("t_end")
    if not (video and os.path.exists(str(video))
            and isinstance(t0, (int, float)) and isinstance(t1, (int, float))):
        log(f"ERROR: missing trim inputs (video={video}, t_start={t0}, "
            f"t_end={t1})")
        write_state(phase="failed")
        return 1

    dur = st.get("dur") or max(1.0, t1 - t0 + 1.0)
    write_state(phase="encoding")
    log(f"encoding x10: -ss {t0:.2f} -t {dur:.2f} -> {OUT_MP4}")
    rc = subprocess.run(
        [PY, f"{BASE}/scripts/encode_throttled.py", "ffmpeg", "-y",
         "-ss", f"{t0:.3f}", "-t", f"{dur:.3f}", "-i", str(video),
         "-vf", "setpts=PTS/10,fps=25",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
         "-pix_fmt", "yuv420p", "-profile:v", "high",
         "-movflags", "+faststart", "-an", OUT_MP4]).returncode

    if rc == 0 and os.path.exists(OUT_MP4):
        size = os.path.getsize(OUT_MP4)
        log(f"DONE: {OUT_MP4} ({size / 1e6:.1f} MB)")
        write_state(phase="done", mp4=OUT_MP4, mp4_mb=round(size / 1e6, 1))
        return 0
    log(f"encode failed rc={rc}")
    write_state(phase="encode_failed")
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    finally:
        try:
            os.remove(LOCK)
        except Exception:
            pass
