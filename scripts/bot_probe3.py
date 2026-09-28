#!/usr/bin/env python3
"""Probe 3: full game-state dump — spots, blocks, placeholders, score."""
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
          const insts = (n) => {
            const cls = byName.get(n);
            return cls ? (cls.GetInstances ? cls.GetInstances() : cls._instances) : [];
          };
          const pos = (i) => {
            const wi = i._worldInfo;
            const x = (wi && (wi._x !== undefined ? wi._x : (typeof wi.GetX === 'function' ? wi.GetX() : null)));
            const y = (wi && (wi._y !== undefined ? wi._y : (typeof wi.GetY === 'function' ? wi.GetY() : null)));
            return [x, y];
          };
          const out = {};
          // worldInfo shape probe
          const s0 = insts('spot')[0];
          if (s0) {
            out.worldInfoKeys = Object.getOwnPropertyNames(s0._worldInfo).slice(0, 30);
            out.worldInfoMethods = ['GetX','GetY','GetBoundingBox'].filter(m => typeof s0._worldInfo[m] === 'function');
          }
          out.spots = insts('spot').map(i => ({
            u: i._uid, xx: i._instVarValues[0], yy: i._instVarValues[1],
            f: i._instVarValues[2], p: pos(i)
          }));
          out.blocks = insts('block').map(i => ({
            u: i._uid, xx: i._instVarValues[0], yy: i._instVarValues[1],
            ph: i._instVarValues[2], par: i._instVarValues[3],
            mc: i._instVarValues[4], p: pos(i),
            fr: i._sdkInst && i._sdkInst._currentFrameIndex
          }));
          out.placeholders = insts('placeholder').map(i => ({
            u: i._uid, iv: [...i._instVarValues], p: pos(i)
          }));
          out.shapesparents = insts('shapesparent').map(i => ({
            u: i._uid, iv: [...i._instVarValues], p: pos(i)
          }));
          // spritefont text probe
          const ts = insts('txtscore')[0];
          if (ts) {
            out.txtscoreProps = Object.getOwnPropertyNames(ts._sdkInst).filter(k => k.toLowerCase().includes('text') || k.toLowerCase().includes('str')).slice(0, 10);
            out.txtscoreText = ts._sdkInst._text !== undefined ? ts._sdkInst._text : null;
            out.txtscoreSdk = ts._sdkInst.GetText ? ts._sdkInst.GetText() : null;
          }
          out.layout = rt.GetCurrentLayout().GetName();
          return out;
        }
        """)
        page.screenshot(path="/home/z/my-project/download/bot/probe3.png")
        open("/home/z/my-project/download/bot/state1.json","w").write(json.dumps(res, indent=1)); print("saved, blocks:", len(res.get("blocks",[])), "spots:", len(res.get("spots",[])))
        browser.close()

if __name__ == "__main__":
    main()
