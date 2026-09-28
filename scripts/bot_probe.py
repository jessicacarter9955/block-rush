#!/usr/bin/env python3
"""Probe: explore the live Block Blast C3 runtime via Playwright.

Goals:
1. Load the game (GameDistribution URL), cancel the pre-roll ad.
2. Verify window.c3_runtimeInterface._localRuntime access.
3. Dump object class names + sample instance structures (Spot, Block,
   PlaceHolder, ShapesParent, txtScore).
4. Calibrate the touch->layout coordinate mapping.
"""
import json
import sys
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
        # Force DOM (non-worker) runtime so window.c3_runtimeInterface
        # exposes _localRuntime with the object classes.
        page.add_init_script("window.OffscreenCanvas = undefined;")
        page.goto(GD_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(6000)

        # Try to get rid of the GameDistribution pre-roll ad.
        for _ in range(6):
            try:
                r = page.evaluate("() => { if (window.gdsdk && window.gdsdk.cancelAd) { window.gdsdk.cancelAd(); return 'called'; } return 'no sdk'; }")
                print("cancelAd:", r)
            except Exception as e:
                print("cancelAd err:", e)
            page.wait_for_timeout(1500)
            if page.evaluate("() => !!window.c3_runtimeInterface"):
                break

        # Give the loader time (shapes.json + ranking.json AJAX).
        page.wait_for_timeout(5000)
        page.screenshot(path="/home/z/my-project/download/bot/probe-01-loaded.png")

        print('FRAMES:', [(f.name, f.url[:90]) for f in page.frames])
        game_frame = None
        for f in page.frames:
            if 'rvvASMiM' in f.url:
                game_frame = f
        if game_frame is None:
            game_frame = page.main_frame
        # wait for the game runtime to come up inside the game frame
        for _ in range(20):
            try:
                okk = game_frame.evaluate('() => !!(window.c3_runtimeInterface && window.c3_runtimeInterface._localRuntime)')
                if okk: break
            except Exception:
                pass
            page.wait_for_timeout(1000)
        page = game_frame
        info = page.evaluate("""
        () => {
          const out = {};
          const ri = window.c3_runtimeInterface;
          out.hasRI = !!ri;
          const rt = ri && ri._localRuntime;
          out.hasRT = !!rt;
          if (!rt) return out;
          out.canvasInfo = (() => {
            const c = window.c3canvas || document.querySelector('canvas');
            if (!c) return null;
            const r = c.getBoundingClientRect();
            return {cssW: r.width, cssH: r.height, x: r.x, y: r.y};
          })();
          try { out.classNames = [...rt._objectClassesByName.keys()]; } catch(e) { out.classNamesErr = ''+e; }
          // current layout
          try { out.layout = rt.GetCurrentLayout().GetName(); } catch(e) {}
          return out;
        }
        """)
        print(json.dumps({k: v for k, v in info.items() if k != "classNames"}, indent=1)[:600])
        print("classes:", info.get("classNames"))

        # Dump sample instances of key objects.
        dump = page.evaluate("""
        () => {
          const rt = window.c3_runtimeInterface._localRuntime;
          const byName = rt._objectClassesByName;
          const res = {};
          const probe = (name) => {
            const cls = byName.get(name);
            if (!cls) return null;
            const insts = cls.GetInstances ? cls.GetInstances() : cls._instances;
            if (!insts || !insts.length) return {count: 0};
            const i = insts[0];
            const iv = i.GetInstVars ? null : undefined;
            let instVars = null;
            try { instVars = i._instVars && [...i._instVars]; } catch(e) {}
            return {
              count: insts.length,
              sample: {
                x: i.x, y: i.y, w: i.w, h: i.h, uid: i.uid,
                instVars,
                sdkKeys: i._sdkInst ? Object.keys(i._sdkInst).slice(0, 25) : null,
              }
            };
          };
          for (const n of ['spot','block','placeholder','shapesparent','txtscore']) {
            res[n] = probe(n);
          }
          return res;
        }
        """)
        print(json.dumps(dump, indent=1)[:3000])

        browser.close()

if __name__ == "__main__":
    main()
