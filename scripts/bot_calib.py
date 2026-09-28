#!/usr/bin/env python3
"""Calibration: hold a drag, log finger/parent/anchor-local/CurSpot to nail
the world-coordinate composition (children local offsets + parent scale)."""
import json
from playwright.sync_api import sync_playwright

GD_URL = "https://html5.gamedistribution.com/3a364ed8d075418abb7849e1d63b6015/index.html"
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")
NEUTRALIZE_CSS = """
div.gd__promo, div.gd__adv, div[class^="gd__"], iframe[src*="googleads"],
iframe[src*="doubleclick"] { display: none !important; pointer-events: none !important; }
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
        page.add_style_tag(content=NEUTRALIZE_CSS)
        gf = next((f for f in page.frames if "rvvASMiM" in f.url), page.main_frame)

        gf.evaluate("""() => {
            const rt = window.c3_runtimeInterface._localRuntime;
            const esm = rt._eventSheetManager;
            window.__gv = (name) => {
                for (const v of esm._allGlobalVars) if (v._name === name) return v.GetValue();
                return null;
            };
        }""")

        # spots by uid -> (xx,yy)
        spots = gf.evaluate("""() => {
            const rt = window.c3_runtimeInterface._localRuntime;
            const cls = rt._objectClassesByName.get('spot');
            return cls.GetInstances().map(s => ({u: s._uid, xx: s._instVarValues[0], yy: s._instVarValues[1]}));
        }""")
        spot_by_uid = {s["u"]: (s["xx"], s["yy"]) for s in spots}
        uid_by_cell = {(s["xx"], s["yy"]): s["u"] for s in spots}

        piece = gf.evaluate("""() => {
            const rt = window.c3_runtimeInterface._localRuntime;
            const cls = rt._objectClassesByName.get('shapesparent');
            const i = cls.GetInstances()[0];
            return {u: i._uid, x: i._worldInfo._x, y: i._worldInfo._y,
                    w: i._worldInfo._w, h: i._worldInfo._h};
        }""")
        print("parent pre-drag:", piece)

        cdp = ctx.new_cdp_session(page)
        # touch at the PARENT position (world) = middle of the piece
        fx, fy = piece["x"], piece["y"]
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart",
                 "touchPoints": [{"x": fx, "y": fy, "id": 1}]})
        page.wait_for_timeout(250)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove",
                 "touchPoints": [{"x": fx, "y": fy - 300, "id": 1}]})
        page.wait_for_timeout(300)

        def drag_info():
            return gf.evaluate("""() => {
                const rt = window.c3_runtimeInterface._localRuntime;
                const cls = rt._objectClassesByName.get('shapesparent');
                const i = cls.GetInstances()[0];
                const blocks = rt._objectClassesByName.get('block').GetInstances()
                    .filter(b => b._instVarValues[3] === i._uid)
                    .map(b => ({u: b._uid, x: b._worldInfo._x, y: b._worldInfo._y,
                                w: b._worldInfo._w, h: b._worldInfo._h}))
                    .sort((a, b) => a.u - b.u);
                return {px: i._worldInfo._x, py: i._worldInfo._y,
                        pw: i._worldInfo._w, ph: i._worldInfo._h,
                        dx: i._instVarValues[1],
                        blocks,
                        curSpot: window.__gv('CurSpot'),
                        shapeState: window.__gv('ShapeState'),
                        sel: window.__gv('SelectedShape')};
            }""")

        info = drag_info()
        print("during drag (finger 539.5, 1326):", json.dumps(info))

        # move over the empty tutorial row (row 4): target anchor spot (3,4)
        # try finger y = spotY + 200 = 891+200 = 1091, x = 480+120=600? test a grid of positions
        for finger in [(540, 1091), (600, 1091), (480, 1091), (540, 971), (540, 1211)]:
            cdp.send("Input.dispatchTouchEvent", {"type": "touchMove",
                     "touchPoints": [{"x": finger[0], "y": finger[1], "id": 1}]})
            page.wait_for_timeout(280)
            info = drag_info()
            cs = info["curSpot"]
            cs_cell = spot_by_uid.get(cs, None)
            print(f"finger={finger} parent=({info['px']:.1f},{info['py']:.1f}) "
                  f"a0local=({info['blocks'][0]['x']:.1f},{info['blocks'][0]['y']:.1f}) "
                  f"a0size=({info['blocks'][0]['w']:.1f}) CurSpot={cs} {cs_cell} "
                  f"ShapeState={info['shapeState']}")

        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_timeout(600)
        st = gf.evaluate("() => ({score: window.__gv('Score'), state: window.__gv('GameState'), tut: window.__gv('TutNum')})")
        print("after release:", st)
        browser.close()

if __name__ == "__main__":
    main()
