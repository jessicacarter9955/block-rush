#!/usr/bin/env python3
"""Diagnose why CDP touch events don't reach the C3 game canvas."""
import json
from playwright.sync_api import sync_playwright

GD_URL = "https://html5.gamedistribution.com/3a364ed8d075418abb7849e1d63b6015/index.html"
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")

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
        # consent + ad
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

        gf = None
        for f in page.frames:
            if "rvvASMiM" in f.url:
                gf = f
        print("game frame:", gf.url[:80] if gf else None)

        # 1) what element is at the tray piece position (540, 1626) in MAIN frame?
        el = page.evaluate("""() => {
            const e = document.elementFromPoint(540, 1626);
            return e ? {tag: e.tagName, id: e.id, cls: (e.className||'').toString().slice(0,80)} : null;
        }""")
        print("elementFromPoint(540,1626) main frame:", el)

        # 2) instrument listeners in the game frame
        gf.evaluate("""() => {
            window.__evts = [];
            const names = ['touchstart','touchmove','touchend','pointerdown','pointermove','pointerup','mousedown','mousemove','mouseup'];
            for (const t of names) {
                window.addEventListener(t, function(e) {
                    window.__evts.push([t, e.clientX, e.clientY, (e.pointerType||'')]);
                }, true);
            }
        }""")

        cdp = ctx.new_cdp_session(page)
        # 3) dispatch a touch sequence at the tray piece
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": 540, "y": 1626, "id": 1}]})
        page.wait_for_timeout(200)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": 540, "y": 1400, "id": 1}]})
        page.wait_for_timeout(200)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_timeout(400)

        evts = gf.evaluate("() => window.__evts")
        print("events seen in GAME frame:", json.dumps(evts))

        evts_main = page.evaluate("""() => {
            const e = window.__evts_main || null; return e;
        }""")
        # also instrument main frame
        page.evaluate("""() => {
            window.__mevts = [];
            for (const t of ['touchstart','pointerdown','mousedown']) {
                window.addEventListener(t, function(e) {
                    window.__mevts.push([t, e.clientX, e.clientY]);
                }, true);
            }
        }""")
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": 300, "y": 800, "id": 1}]})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_timeout(300)
        print("events seen in MAIN frame:", json.dumps(page.evaluate("() => window.__mevts")))

        # 4) canvas info in game frame
        ci = gf.evaluate("""() => {
            const cs = [...document.querySelectorAll('canvas')];
            return cs.map(c => ({id: c.id, w: c.width, h: c.height,
                style: (c.style.cssText||'').slice(0,100),
                rect: (() => { const r = c.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()}));
        }""")
        print("canvases in game frame:", json.dumps(ci))

        # 5) suspension + tick check
        sus = gf.evaluate("""() => {
            const rt = window.c3_runtimeInterface._localRuntime;
            const out = {suspended: rt.IsSuspended ? rt.IsSuspended() : 'n/a'};
            out.t1 = rt.GetGameTime ? rt.GetGameTime() : null;
            return out;
        }""")
        print("suspension check A:", sus)
        page.wait_for_timeout(600)
        sus2 = gf.evaluate("""() => {
            const rt = window.c3_runtimeInterface._localRuntime;
            return {t2: rt.GetGameTime ? rt.GetGameTime() : null};
        }""")
        print("suspension check B:", sus2)
        # try resuming
        try:
            gf.evaluate("() => { const rt = window.c3_runtimeInterface._localRuntime; if (rt.SetSuspended) rt.SetSuspended(false); }")
            page.wait_for_timeout(300)
            t3 = gf.evaluate("() => window.c3_runtimeInterface._localRuntime.GetGameTime()")
            print("after SetSuspended(false), game time:", t3)
        except Exception as e:
            print("resume err:", e)
        # gdsdk state in main frame
        try:
            g = page.evaluate("() => { const g = window.gdsdk; return g ? {cmd: Object.keys(g), gameState: g.gameState, adBlocked: g.adBlocked} : null; }")
            print("gdsdk:", g)
        except Exception as e:
            print("gdsdk err:", e)
        # element from point INSIDE game frame
        try:
            el2 = gf.evaluate("() => { const e = document.elementFromPoint(540, 1626); return e ? {tag: e.tagName, id: e.id} : null; }")
            print("elementFromPoint inside game frame:", el2)
        except Exception as e:
            print("efp err:", e)
        # 5b) explore event sheet manager for global vars (GameState!)
        try:
            gv = gf.evaluate("""() => {
                const rt = window.c3_runtimeInterface._localRuntime;
                const esm = rt._eventSheetManager;
                const props = Object.getOwnPropertyNames(esm);
                const found = [];
                const seen = new Set();
                const scan = (obj, path, depth) => {
                    if (!obj || depth > 3 || seen.has(obj)) return;
                    if (typeof obj !== 'object') return;
                    seen.add(obj);
                    if (obj.constructor && obj.constructor.name === 'EventVariable') {
                        let v = null;
                        try { v = obj.GetValue(); } catch(e) {}
                        found.push([path, obj._name, v]);
                        return;
                    }
                    if (Array.isArray(obj)) {
                        obj.forEach((o, i) => scan(o, path + '[' + i + ']', depth + 1));
                    } else {
                        for (const k of Object.getOwnPropertyNames(obj)) {
                            if (k.startsWith('_runtime') || k.startsWith('_eventSheet')) continue;
                            let v;
                            try { v = obj[k]; } catch(e) { continue; }
                            if (v && typeof v === 'object') scan(v, path + '.' + k, depth + 1);
                        }
                    }
                };
                scan(esm, 'esm', 0);
                return {props: props.slice(0, 30), vars: found.map(f => [f[1], f[2]]).slice(0, 80)};
            }""")
            print("GLOBAL VARS:", json.dumps(gv, indent=0)[:2500])
        except Exception as e:
            print("gv err:", e)
        # 5c) where does the touch plugin attach? list canvas listeners
        try:
            lst = gf.evaluate("""() => {
                const c = window.c3canvas || document.querySelector('canvas');
                const info = {canvasListeners: (typeof getEventListeners !== 'function') ? 'n/a (needs CDP)' : 'n/a',
                              docListeners: 'n/a'};
                return info;
            }""")
            print("listener info:", lst)
        except Exception as e:
            print("lst err:", e)
        # 5) does the game Touch plugin see touches? check the C3 touch DOM handler
        probe = gf.evaluate("""() => {
            const ri = window.c3_runtimeInterface;
            const dh = ri && ri._domHandlers && ri._domHandlers.find(d => d.GetComponentID && d.GetComponentID() === 'touch');
            if (!dh) return {found: false};
            return {found: true, keys: Object.getOwnPropertyNames(Object.getPrototypeOf(dh)).slice(0, 30)};
        }""")
        print("touch DOM handler:", json.dumps(probe))
        browser.close()

if __name__ == "__main__":
    main()
