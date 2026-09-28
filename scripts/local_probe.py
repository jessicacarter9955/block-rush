#!/usr/bin/env python3
"""Probe: does the local game mirror run standalone (no GD SDK, no ads)?"""
import sys
import time

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8931/index.html"
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")

READ_JS = """
() => {
  const rt = window.c3_runtimeInterface && window.c3_runtimeInterface._localRuntime;
  if (!rt) return {up: false};
  const esm = rt._eventSheetManager;
  const gv = (n) => { for (const v of esm._allGlobalVars) if (v._name === n) return v.GetValue(); };
  return {up: true, state: gv('GameState'), score: gv('Score'), tut: gv('TutNum')};
}
"""

CONSOLE_ERRORS = []


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1080, "height": 1920},
            has_touch=True, is_mobile=True, device_scale_factor=1,
            user_agent=UA,
        )
        page = ctx.new_page()
        page.add_init_script("window.OffscreenCanvas = undefined;")
        page.on("console", lambda m: CONSOLE_ERRORS.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: CONSOLE_ERRORS.append(str(e)))

        t0 = time.time()
        page.goto(URL, wait_until="domcontentloaded", timeout=30000)

        up = None
        for i in range(30):
            try:
                up = page.evaluate(READ_JS)
                if up and up.get("up"):
                    break
            except Exception:
                pass
            page.wait_for_timeout(1000)
        print(f"runtime: {up} ({time.time()-t0:.1f}s)")
        page.wait_for_timeout(3000)
        up = page.evaluate(READ_JS)
        print(f"state after 3s: {up}")
        page.screenshot(path="/home/z/my-project/download/local-probe.png")
        print("errors:", CONSOLE_ERRORS[:8])
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
