#!/usr/bin/env python3
"""Capture all real asset bytes (images/fonts/json) the game loads from the browser.

The GD CDN returns 49-byte S3 error bodies for direct curl GETs of the sprite
sheets, so we load the real game in Playwright, sniff every network response,
and save image/font/json bodies into the local mirror with correct paths.
"""
import os
import re
import sys
import time

from playwright.sync_api import sync_playwright

GD_URL = "https://html5.gamedistribution.com/3a364ed8d075418abb7849e1d63b6015/index.html"
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")
MIRROR = "/home/z/my-project/game-mirror"

SAVED = {"n": 0, "bytes": 0}
SKIP_EXT = (".js", ".html", ".css")
SKIP_URL = ("googlesyndication", "doubleclick", "googleads", "gstatic",
            "googleapis", "facebook", "analytics", "adition", "smartadserver",
            "cookie", "consent", ".svg", "favicon")


def rel_path(url: str) -> str:
    """Map a gamedistribution URL to the local mirror relative path."""
    m = re.search(r"gamedistribution\.com/(.+)$", url.split("?")[0])
    if not m:
        return None
    path = m.group(1)
    # strip both known prefixes
    for pref in ("rvvASMiM/3a364ed8d075418abb7849e1d63b6015/",
                 "3a364ed8d075418abb7849e1d63b6015/"):
        if path.startswith(pref):
            return path[len(pref):]
    return None


SEEN = set()


def on_response(resp):
    try:
        url = resp.url
        if "gamedistribution.com" in url:
            SEEN.add(url.split("?")[0])
        if any(s in url for s in SKIP_URL):
            return
        if url.endswith(SKIP_EXT):
            return
        rp = rel_path(url)
        if not rp:
            return
        body = resp.body()
        if not body or len(body) < 60:  # 49-byte S3 error bodies
            return
        dest = os.path.join(MIRROR, rp)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as f:
            f.write(body)
        SAVED["n"] += 1
        SAVED["bytes"] += len(body)
        print(f"  saved {rp} ({len(body)} b)", flush=True)
    except Exception as e:
        print(f"  skip {resp.url[:80]}: {e}", flush=True)


def handle_consent(page):
    for _ in range(3):
        for f in page.frames:
            for sel in ["button:has-text('I Accept')", "button:has-text('Accept')",
                        "button:has-text('AGREE')", "[title^='I Accept']"]:
                try:
                    loc = f.locator(sel)
                    if loc.count() > 0 and loc.first.is_visible():
                        loc.first.click(timeout=3000)
                        page.wait_for_timeout(2000)
                        return True
                except Exception:
                    continue
        page.wait_for_timeout(1500)
    return False


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
        page.on("response", on_response)

        page.goto(GD_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(3000)
        clicked = handle_consent(page)
        print(f"consent clicked: {clicked}", flush=True)
        # wait up to 75s for the game frame to appear
        for i in range(75):
            if any("rvvASMiM" in f.url for f in page.frames):
                print(f"game frame appeared after {i}s", flush=True)
                break
            try:
                page.evaluate("() => window.gdsdk && window.gdsdk.cancelAd && window.gdsdk.cancelAd()")
            except Exception:
                pass
            page.wait_for_timeout(1000)
        page.wait_for_timeout(20000)

        print("--- URLs seen on gamedistribution.com ---", flush=True)
        for u in sorted(SEEN):
            print("  ", u, flush=True)

        gf = next((f for f in page.frames if "rvvASMiM" in f.url), None)
        if gf:
            try:
                gf.evaluate("() => !!(window.c3_runtimeInterface && window.c3_runtimeInterface._localRuntime)")
                print("runtime: UP", flush=True)
            except Exception:
                print("runtime: not readable", flush=True)

        browser.close()
    print(f"\nTOTAL saved: {SAVED['n']} files, {SAVED['bytes']} bytes", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
