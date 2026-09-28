#!/usr/bin/env python3
"""Probe 2: nail down instance internals for spot/block/placeholder."""
import json
from playwright.sync_api import sync_playwright

GD_URL = "https://html5.gamedistribution.com/3a364ed8d075418abb7849e1d63b6015/index.html"
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")

def get_game_frame(page):
    for f in page.frames:
        if 'rvvASMiM' in f.url:
            return f
    return page.main_frame

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
        for _ in range(6):
            try:
                page.evaluate("() => window.gdsdk && window.gdsdk.cancelAd && window.gdsdk.cancelAd()")
            except Exception:
                pass
            page.wait_for_timeout(1500)
        gf = get_game_frame(page)
        for _ in range(20):
            try:
                if gf.evaluate("() => !!(window.c3_runtimeInterface && window.c3_runtimeInterface._localRuntime)"):
                    break
            except Exception:
                pass
            page.wait_for_timeout(1000)

        res = gf.evaluate("""
        () => {
          const rt = window.c3_runtimeInterface._localRuntime;
          const byName = rt._objectClassesByName;
          const out = {};
          const probe = (name) => {
            const cls = byName.get(name);
            if (!cls) return {err: 'no class'};
            const insts = cls.GetInstances ? cls.GetInstances() : cls._instances;
            if (!insts || !insts.length) return {count: 0};
            const s = insts[0];
            const getV = (o, k) => { try { const v = o ? o[k] : null; return v === undefined ? null : v; } catch(e) { return 'ERR'; } };
            const priv = {};
            for (const k of ['_x','_y','_w','_h','_uid','_instVars','_iid','_animFrame']) priv[k] = getV(s, k);
            return {
              count: insts.length,
              ownProps: Object.getOwnPropertyNames(s).slice(0, 40),
              priv,
              methods: ['GetX','GetY','GetInstVars','GetUID','GetAnimationFrame','GetWorldInfo'].filter(m => typeof s[m] === 'function'),
            };
          };
          for (const n of ['spot','block','placeholder','shapesparent','txtscore','board']) {
            out[n] = probe(n);
          }
          return out;
        }
        """)
        print(json.dumps(res, indent=1))
        browser.close()

if __name__ == "__main__":
    main()
