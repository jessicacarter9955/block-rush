#!/usr/bin/env python3
"""Copy a pinned, public Salsa Ninja Flutter web release under a separate route.

This script only writes public/salsa-ninja, preserving the entire existing Next.js
application, its public/ resources and its current pages.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen
import json
import time

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "salsa-ninja"
ORIGIN = "https://ygrfqehiwhmkfczosuoo.supabase.co/storage/v1/object/public/salsa-ninja-static/"
FILES = json.loads(r"""[".last_build_id","assets/AssetManifest.bin","assets/AssetManifest.bin.json","assets/FontManifest.json","assets/fonts/MaterialIcons-Regular.otf","assets/NOTICES","assets/shaders/ink_sparkle.frag","assets/shaders/stretch_effect.frag","canvaskit/canvaskit.js","canvaskit/canvaskit.js.symbols","canvaskit/canvaskit.wasm","canvaskit/chromium/canvaskit.js","canvaskit/chromium/canvaskit.js.symbols","canvaskit/chromium/canvaskit.wasm","canvaskit/skwasm_heavy.js","canvaskit/skwasm_heavy.js.symbols","canvaskit/skwasm_heavy.wasm","canvaskit/skwasm.js","canvaskit/skwasm.js.symbols","canvaskit/skwasm.wasm","canvaskit/webparagraph/canvaskit.js","canvaskit/webparagraph/canvaskit.js.symbols","canvaskit/webparagraph/canvaskit.wasm","canvaskit/wimp.js","canvaskit/wimp.js.symbols","canvaskit/wimp.wasm","favicon.png","flutter_bootstrap.js","flutter_service_worker.js","flutter.js","flutter.js.map","icons/Icon-192.png","icons/Icon-512.png","icons/Icon-maskable-192.png","icons/Icon-maskable-512.png","index.html","main.dart.js","manifest.json","version.json"]""")
assert "index.html" in FILES and "flutter_bootstrap.js" in FILES

def fetch_one(name):
    url = ORIGIN + quote(name, safe="/")
    for attempt in range(3):
        try:
            with urlopen(url, timeout=120) as response:
                assert response.status == 200
                payload = response.read()
            if not payload:
                raise ValueError("Empty file: " + name)
            return name, payload
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(fetch_one, name) for name in FILES]
        for task in as_completed(futures):
            name, payload = task.result()
            if name == "index.html":
                html = payload.decode("utf-8")
                assert '<base href="/">' in html
                html = html.replace('<base href="/">', '<base href="/salsa-ninja/">')
                html = html.replace("<title>salsa_ninja</title>", "<title>Salsa Ninja — Dance & Community</title>")
                payload = html.encode("utf-8")
            output = DEST / name
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(payload)
            print(f"Synced {name}: {len(payload)} bytes", flush=True)
    assert (DEST / "index.html").is_file()
    assert (DEST / "main.dart.js").is_file()
    print(f"COMPLETE {len(FILES)} files under {DEST}", flush=True)

if __name__ == "__main__":
    main()
