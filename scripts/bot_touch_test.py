#!/usr/bin/env python3
"""Controlled touch test: neutralize overlays, touch the tray piece, verify."""
import json
from playwright.sync_api import sync_playwright

GD_URL = "https://html5.gamedistribution.com/3a364ed8d075418abb7849e1d63b6015/index.html"
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")

NEUTRALIZE_CSS = """
div.gd__promo, div.gd__adv, div[class^="gd__"], iframe[src*="googleads"],
iframe[src*="doubleclick"], iframe[src*="gamedistribution"][src*="sdk"] {
  display: none !important;
  pointer-events: none !important;
}
"""

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
        page.goto(GD_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(5000)
        for _ in range(4):
            for f in page.frames:
                try:
                    loc = f.locator("button:has-text('I Accept')")
                    if loc.count() > 0 and loc.first.is_visible():
                        loc.first.click(timeout=2000)
                except Exception:
                    pass
            try:
                page.evaluate("() => window.gdsdk && window.gdsdk.cancelAd && window.gdsdk.cancelAd()")
            except Exception:
                pass
            page.wait_for_timeout(1200)

        gf = next((f for f in page.frames if "rvvASMiM" in f.url), page.main_frame)

        # neutralize overlays in the main frame
        page.add_style_tag(content=NEUTRALIZE_CSS)

        # global var reader
        gf.evaluate("""() => {
            window.__gv = (name) => {
                const rt = window.c3_runtimeInterface._localRuntime;
                const esm = rt._eventSheetManager;
                for (const v of esm._allGlobalVars) if (v._name === name) return v.GetValue();
                return null;
            };
        }""")

        def gv(name):
            return gf.evaluate("(n) => window.__gv(n)", name)

        print("GameState:", gv("GameState"), "| SelectedShape:", gv("SelectedShape"),
              "| TutNum:", gv("TutNum"), "| ShapeState:", gv("ShapeState"))

        # overlay check
        el = page.evaluate("() => { const e = document.elementFromPoint(540, 1626); return e ? e.tagName + '.' + (e.className||'').toString().slice(0,40) : null; }")
        print("hit test (540,1626):", el)
        el2 = page.evaluate("() => { const e = document.elementFromPoint(540, 1000); return e ? e.tagName + '.' + (e.className||'').toString().slice(0,40) : null; }")
        print("hit test (540,1000):", el2)

        cdp = ctx.new_cdp_session(page)

        # piece position: shapesparent
        piece = gf.evaluate("""() => {
            const rt = window.c3_runtimeInterface._localRuntime;
            const cls = rt._objectClassesByName.get('shapesparent');
            const insts = cls.GetInstances();
            if (!insts.length) return null;
            const i = insts[0];
            return {u: i._uid, x: i._worldInfo._x, y: i._worldInfo._y};
        }""")
        print("piece parent:", piece)

        # touch DOWN on the piece, hold, and inspect state DURING the touch
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart",
                 "touchPoints": [{"x": piece["x"], "y": piece["y"], "id": 1}]})
        page.wait_for_timeout(300)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove",
                 "touchPoints": [{"x": piece["x"], "y": piece["y"] - 300, "id": 1}]})
        page.wait_for_timeout(300)
        mid = gf.evaluate("""() => {
            const rt = window.c3_runtimeInterface._localRuntime;
            const cls = rt._objectClassesByName.get('shapesparent');
            const insts = cls.GetInstances();
            const i = insts[0];
            return {x: i._worldInfo._x, y: i._worldInfo._y, dx: i._instVarValues[1]};
        }""")
        print("piece parent DURING drag:", mid)
        print("GameState mid:", gv("GameState"), "| SelectedShape mid:", gv("SelectedShape"))
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_timeout(800)
        print("GameState after:", gv("GameState"), "| SelectedShape after:", gv("SelectedShape"),
              "| ShapeState:", gv("ShapeState"))
        page.screenshot(path="/home/z/my-project/download/bot/touch-test.png")

        # try again with a plain click on the pause button to test ANY input
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart",
                 "touchPoints": [{"x": 974, "y": 88, "id": 1}]})
        page.wait_for_timeout(120)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_timeout(700)
        st = gf.evaluate("""() => {
            const rt = window.c3_runtimeInterface._localRuntime;
            const cls = rt._objectClassesByName.get('pausepopup');
            return {pauseCount: cls.GetInstances().length};
        }""")
        print("pause popup instances after pause tap:", st)
        page.screenshot(path="/home/z/my-project/download/bot/touch-test2.png")
        browser.close()

if __name__ == "__main__":
    main()
