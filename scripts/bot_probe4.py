#!/usr/bin/env python3
"""Probe: extract GetProjectUniqueId + real IndexedDB storage layout of the game,
so the bot can pre-seed 'Block Blast_Data' (Tut=0) before boot."""
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
        for _ in range(6):
            for f in page.frames:
                for sel in ["button:has-text('I Accept')", "button:has-text('Accept')"]:
                    try:
                        loc = f.locator(sel)
                        if loc.count() > 0 and loc.first.is_visible():
                            loc.first.click(timeout=3000)
                            print("consent clicked")
                            page.wait_for_timeout(1500)
                    except Exception:
                        pass
            try:
                page.evaluate("() => window.gdsdk && window.gdsdk.cancelAd && window.gdsdk.cancelAd()")
            except Exception:
                pass
            page.wait_for_timeout(1200)

        gf = next((f for f in page.frames if "rvvASMiM" in f.url), page.main_frame)
        print("frames:", [f.url[:80] for f in page.frames])
        for _ in range(60):
            try:
                if gf.evaluate("() => !!(window.c3_runtimeInterface && window.c3_runtimeInterface._localRuntime)"):
                    break
            except Exception:
                pass
            page.wait_for_timeout(1000)
        # ricava il frame giusto dinamicamente se quello scelto non ha il runtime
        try:
            gf.evaluate("() => !!window.c3_runtimeInterface")
        except Exception:
            pass
        ok = False
        for f in page.frames:
            try:
                if f.evaluate("() => !!(window.c3_runtimeInterface && window.c3_runtimeInterface._localRuntime)"):
                    gf = f
                    ok = True
                    break
            except Exception:
                continue
        print("runtime found:", ok, "in", gf.url[:80])

        info = gf.evaluate("""async () => {
            const rt = window.c3_runtimeInterface._localRuntime;
            let projectId = null;
            try { projectId = rt.GetProjectUniqueId(); } catch (e) {}
            if (projectId == null) projectId = rt._projectUniqueId || null;
            let dbs = [];
            try { dbs = (await indexedDB.databases()).map(d => d.name + ' v' + (d.version||0)); } catch (e) { dbs = ['err: ' + e.message]; }
            let stored = null;
            try {
                const st = rt._GetProjectStorage();
                stored = await st.getItem('Block Blast_Data');
            } catch (e) { stored = 'err: ' + e.message; }
            let gvTut = null;
            try {
                const esm = rt._eventSheetManager;
                for (const v of esm._allGlobalVars) if (v._name === 'TutNum') gvTut = v.GetValue();
            } catch (e) {}
            return {origin: location.origin, projectId, dbs, stored, gvTut};
        }""")
        print("RESULT:", info)
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
