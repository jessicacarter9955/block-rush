#!/usr/bin/env python3
"""Live stream server — broadcasts the bot's browser as MJPEG + status page.

- /            viewer page (dark, phone frame, live score panel)
- /stream.mjpg MJPEG stream (multipart/x-mixed-replace)
- /latest.jpg  single latest frame
- /state.json  bot status forwarded from download/bot-video/state.json

The screenshot loop attaches to the bot's Chromium via CDP (127.0.0.1:9222)
and never touches the bot process itself.
"""
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

STATE_FILE = "/home/z/my-project/download/bot-video/state.json"
CDP_URL = "http://127.0.0.1:9222"

_lock = threading.Lock()
_frame = {"bytes": None, "seq": 0, "ts": 0.0}
_cond = threading.Condition(_lock)

VIEWER = """<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Block Blast — Bot LIVE</title>
<style>
:root{--bg:#0b0e1a;--card:#141931;--acc:#ffb020;--txt:#eef0ff;--mut:#8b93b8;--rec:#ff3b5c}
*{margin:0;padding:0;box-sizing:border-box}
body{background:radial-gradient(1200px 800px at 50% -10%,#1b2340 0%,var(--bg) 55%);
  font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--txt);
  min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:18px 12px 40px}
h1{font-size:clamp(18px,4vw,28px);letter-spacing:.14em;font-weight:800;margin:6px 0 2px}
h1 b{color:var(--acc)}
.sub{color:var(--mut);font-size:13px;margin-bottom:16px;display:flex;gap:10px;align-items:center}
.rec{width:10px;height:10px;border-radius:50%;background:var(--rec);display:inline-block;
  animation:p 1.2s infinite}
@keyframes p{50%{opacity:.25}}
.wrap{display:flex;gap:22px;align-items:flex-start;flex-wrap:wrap;justify-content:center}
.phone{position:relative;height:min(78vh,860px);aspect-ratio:9/16;border-radius:34px;
  padding:10px;background:linear-gradient(160deg,#2a3355,#12162b);box-shadow:0 30px 70px #0009,0 0 0 2px #ffffff14}
.phone img{width:100%;height:100%;object-fit:cover;border-radius:26px;background:#000;display:block}
.panel{background:var(--card);border:1px solid #ffffff12;border-radius:18px;padding:18px 20px;
  width:250px;display:flex;flex-direction:column;gap:14px}
.panel h2{font-size:12px;letter-spacing:.22em;color:var(--mut);font-weight:700}
.big{font-size:44px;font-weight:900;color:var(--acc);font-variant-numeric:tabular-nums;line-height:1}
.big.flash{animation:fl .5s}
@keyframes fl{50%{transform:scale(1.18);color:#fff}}
.row{display:flex;justify-content:space-between;font-size:14px;color:var(--txt)}
.row span:first-child{color:var(--mut)}
.tag{display:inline-block;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:700;letter-spacing:.08em}
.tag.play{background:#12b76a22;color:#12b76a}.tag.wait{background:#ffb02022;color:var(--acc)}
.tag.end{background:#ff3b5c22;color:var(--rec)}
.note{color:var(--mut);font-size:12px;line-height:1.6;margin-top:14px;max-width:560px;text-align:center}
</style></head><body>
<h1>BLOCK <b>BLAST</b> — BOT LIVE</h1>
<div class="sub"><span class="rec"></span> <span id="sub">RISCALDAMENTO IN CORSO</span></div>
<div class="wrap">
  <div class="phone"><img id="v" src="/stream.mjpg" alt="live"></div>
  <div class="panel">
    <h2>PUNTEGGIO</h2>
    <div class="big" id="score">0</div>
    <div class="row"><span>Stato</span><b id="state">—</b></div>
    <div class="row"><span>Mosse</span><b id="moves">0</b></div>
    <div class="row"><span>Tempo</span><b id="time">0:00</b></div>
    <div class="row"><span>Best</span><b id="best">0</b></div>
    <div class="row"><span>Partite</span><b id="games">1</b></div>
    <div class="row"><span>Sessione</span><span class="tag wait" id="phase">warm-up</span></div>
  </div>
</div>
<p class="note">Fase 1 — <b>warm-up</b>: il bot gioca veloce e, grazie al revive,
rigioca ad ogni game over finché il punteggio non supera l'obiettivo della
sessione (guarda il vivo a sinistra).
Fase 2 — <b>registrazione</b>: dall'obiettivo in poi il bot rallenta a ritmo
umano e la partita viene registrata; il video finale parte dal momento del
sorpasso (verticale 1080×1920, pronto per TikTok / YouTube Shorts). L'MP4
arriva a fine sessione.</p>
<script>
const $=i=>document.getElementById(i);
let last=-1;
setInterval(async()=>{
  try{
    const s=await (await fetch('/state.json',{cache:'no-store'})).json();
    if(s.score!==undefined){
      if(s.score>last+1&&last>=0){const e=$('score');e.classList.remove('flash');void e.offsetWidth;e.classList.add('flash')}
      last=s.score;$('score').textContent=s.score;
      $('state').textContent=(s.state||'—')==='HUD'?'In partita':(s.state||'—');
      $('moves').textContent=s.moves||0;
      $('games').textContent=s.games||1;
      const m=Math.floor((s.elapsed||0)/60),r=Math.floor((s.elapsed||0)%60);
      $('time').textContent=m+':'+String(r).padStart(2,'0');
      $('best').textContent=s.best||0;
      const p=s.phase||'waiting';const t=$('phase');
      const map={warmup:['wait','WARM-UP · OBIETTIVO '+(s.target||800)],
                 recording:['play','REGISTRAZIONE'],
                 playing:['play','LIVE'],
                 done:['end','COMPLETATA']};
      const mm=map[p]||['wait','in avvio'];
      t.className='tag '+mm[0];t.textContent=mm[1];
      $('sub').textContent=p==='warmup'?'RISCALDAMENTO — FINO A '+(s.target||800):
        p==='recording'?'REGISTRAZIONE VIDEO IN CORSO':
        p==='done'?'SESSIONE COMPLETATA — MP4 IN ARRIVO':'AVVIO';
    }
  }catch(e){}
},1500);
</script></body></html>"""


class FrameBuffer:
    def update(self, data: bytes):
        with _cond:
            _frame["bytes"] = data
            _frame["seq"] += 1
            _frame["ts"] = time.time()
            _cond.notify_all()

    def latest(self):
        with _lock:
            return _frame["bytes"], _frame["seq"]


FB = FrameBuffer()


def capture_loop():
    """Attach to the bot's Chromium via CDP and screenshot the game page."""
    from playwright.sync_api import sync_playwright
    while True:
        page = None
        try:
            with sync_playwright() as p:
                browser = None
                for _ in range(240):  # wait up to 2 min for the bot browser
                    try:
                        browser = p.chromium.connect_over_cdp(CDP_URL)
                        break
                    except Exception:
                        time.sleep(0.5)
                if browser is None:
                    continue
                # find the game page
                for _ in range(120):
                    pages = []
                    for ctx in browser.contexts:
                        pages += ctx.pages
                    page = next((pg for pg in pages if "8931" in pg.url), None)
                    if page:
                        break
                    time.sleep(0.5)
                if page is None:
                    browser.close()
                    continue
                print("[stream] attached, streaming", flush=True)
                while True:
                    shot = page.screenshot(type="jpeg", quality=72)
                    FB.update(shot)
                    time.sleep(0.25)
        except Exception as e:
            print(f"[stream] capture error: {e}; reconnecting", flush=True)
            time.sleep(2.0)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        if "/stream" not in (args[0] if args else ""):
            pass

    def _send(self, code, ctype, body, cache=False):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        if not cache:
            self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/" or path.startswith("/index"):
            self._send(200, "text/html; charset=utf-8", VIEWER.encode())
        elif path == "/latest.jpg":
            data, _ = FB.latest()
            if data:
                self._send(200, "image/jpeg", data)
            else:
                self.send_response(503)
                self.send_header("Content-Length", "0")
                self.end_headers()
        elif path == "/state.json":
            try:
                body = open(STATE_FILE, "rb").read()
                self._send(200, "application/json", body)
            except Exception:
                self._send(200, "application/json",
                           b'{"phase":"waiting","score":0,"state":"starting"}')
        elif path == "/stream.mjpg":
            self.send_response(200)
            self.send_header("Content-Type",
                             "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            last_seq = -1
            try:
                while True:
                    with _cond:
                        got = _cond.wait_for(
                            lambda: _frame["seq"] != last_seq, timeout=12.0)
                        data, seq = _frame["bytes"], _frame["seq"]
                    if not got and data is None:
                        continue
                    if got:
                        last_seq = seq
                    self.wfile.write(
                        b"--frame\r\nContent-Type: image/jpeg\r\n"
                        + f"Content-Length: {len(data)}\r\n\r\n".encode()
                        + data + b"\r\n")
                    self.wfile.flush()
            except Exception:
                pass  # viewer closed the connection
        else:
            self.send_response(404)
            self.send_header("Content-Length", "0")
            self.end_headers()


def main():
    threading.Thread(target=capture_loop, daemon=True).start()
    srv = ThreadingHTTPServer(("0.0.0.0", 3100), Handler)
    print("[stream] mjpeg service on :3100 (via gateway ?XTransformPort=3100)",
          flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
