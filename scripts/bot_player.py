#!/usr/bin/env python3
"""Block Blast bot v2 — plays the original web game via Playwright + CDP touch.

v2 fixes: neutralize GD overlays (gd__promo blocked input), read global
event variables (GameState/Score/TutNum) directly, engagement check via
SelectedShape, retry drags.
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

GD_URL = "https://html5.gamedistribution.com/3a364ed8d075418abb7849e1d63b6015/index.html"
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")
OUT = "/home/z/my-project/download/bot"
SHAPES = json.load(open("/home/z/my-project/original_shapes.json"))["Shapes"]

SPOT0X, SPOT0Y = 120, 411
CELL = 120
LIFT = 200

NEUTRALIZE_CSS = """
div.gd__promo, div.gd__adv, div[class^="gd__"], iframe[src*="googleads"],
iframe[src*="doubleclick"], iframe[src*="adition"], iframe[src*="smartadserver"],
iframe[width="0"], iframe[height="0"] {
  display: none !important;
  pointer-events: none !important;
}
"""

READ_STATE_JS = """
() => {
  const rt = window.c3_runtimeInterface._localRuntime;
  const byName = rt._objectClassesByName;
  const insts = (n) => {
    const c = byName.get(n);
    if (!c) return [];
    return (c.GetInstances ? c.GetInstances() : c._instances) || [];
  };
  const wi = (i) => i._worldInfo;
  const grid = Array.from({length: 8}, () => Array(8).fill(0));
  for (const s of insts('spot')) {
    const xx = s._instVarValues[0], yy = s._instVarValues[1], f = s._instVarValues[2];
    if (f !== -1 && xx >= 0 && xx < 8 && yy >= 0 && yy < 8) grid[yy][xx] = 1;
  }
  const pieces = [];
  const byPh = {};
  for (const b of insts('block')) {
    const ph = b._instVarValues[2];
    if (ph === -1) continue;
    if (!byPh[ph]) byPh[ph] = {ph: ph, blocks: []};
    byPh[ph].blocks.push({
      u: b._uid, xx: b._instVarValues[0], yy: b._instVarValues[1],
      fr: (b._sdkInst && b._sdkInst._currentFrameIndex) || 0,
      x: wi(b)._x, y: wi(b)._y,
    });
  }
  for (const k of Object.keys(byPh)) {
    byPh[k].blocks.sort((a, b) => a.u - b.u);
    pieces.push(byPh[k]);
  }
  const placeholders = insts('placeholder').map(p => ({
    u: p._uid, idx: p._instVarValues[0], myShape: p._instVarValues[1],
    placed: p._instVarValues[2], x: wi(p)._x, y: wi(p)._y,
  }));
  const parents = insts('shapesparent').map(p => ({
    u: p._uid, dx: p._instVarValues[1], ph: p._instVarValues[2],
    x: wi(p)._x, y: wi(p)._y,
  }));
  const ts = insts('txtscore')[0];
  const shown = ts ? parseInt((ts._sdkInst._text || '0').replace(/[^0-9]/g, ''), 10) || 0 : 0;
  return {
    grid, pieces, placeholders, parents,
    scoreShown: shown,
    gv: window.__gv ? {
      state: window.__gv('GameState'), score: window.__gv('Score'),
      tut: window.__gv('TutNum'), sel: window.__gv('SelectedShape'),
      combo: window.__gv('Combo'),
    } : null,
    blockCount: insts('block').length,
  };
}
"""

DRAG_READ_JS = """
(uid) => {
  const rt = window.c3_runtimeInterface._localRuntime;
  const byName = rt._objectClassesByName;
  const insts = (n) => {
    const c = byName.get(n);
    if (!c) return [];
    return (c.GetInstances ? c.GetInstances() : c._instances) || [];
  };
  const wi = (i) => i._worldInfo;
  const parent = insts('shapesparent').find(p => p._uid === uid);
  if (!parent) return null;
  const blocks = insts('block')
    .filter(b => b._instVarValues[3] === uid)
    .map(b => ({u: b._uid, xx: b._instVarValues[0], yy: b._instVarValues[1],
                x: wi(b)._x, y: wi(b)._y}))
    .sort((a, b) => a.u - b.u);
  return {px: wi(parent)._x, py: wi(parent)._y, dx: parent._instVarValues[1], blocks};
}
"""

GV_SETUP_JS = """
() => {
  if (window.__gv) return true;
  const rt = window.c3_runtimeInterface._localRuntime;
  const esm = rt._eventSheetManager;
  window.__gv = (name) => {
    for (const v of esm._allGlobalVars) if (v._name === name) return v.GetValue();
    return null;
  };
  return true;
}
"""

LIGHT_STATE_JS = """
() => {
  const rt = window.c3_runtimeInterface._localRuntime;
  const byName = rt._objectClassesByName;
  const insts = (n) => {
    const c = byName.get(n);
    if (!c) return [];
    return (c.GetInstances ? c.GetInstances() : c._instances) || [];
  };
  let gridHash = 0;
  for (const s of insts('spot')) {
    gridHash += (s._uid % 1000003) * (s._instVarValues[2] + 2);
  }
  let nPieces = 0;
  for (const b of insts('block')) if (b._instVarValues[2] !== -1) nPieces++;
  let score = 0;
  const esm = rt._eventSheetManager;
  for (const v of esm._allGlobalVars) if (v._name === 'Score') score = v.GetValue();
  return [gridHash, nPieces, score];
}
"""


def spot_center(sx, sy):
    return (SPOT0X + sx * CELL, SPOT0Y + sy * CELL)


def handle_consent(page, log):
    for f in page.frames:
        for sel in ["button:has-text('I Accept')", "button:has-text('Accept')",
                    "button:has-text('AGREE')", "[title^='I Accept']"]:
            try:
                loc = f.locator(sel)
                if loc.count() > 0 and loc.first.is_visible():
                    loc.first.click(timeout=3000)
                    log(f"consent clicked: {sel}")
                    page.wait_for_timeout(1500)
                    return True
            except Exception:
                continue
    return False


# ------------------------------------------------------------------
# Solver (same as v1)
# ------------------------------------------------------------------

def shape_cells(shape):
    return [(r, c) for r in range(len(shape)) for c in range(len(shape[r])) if shape[r][c]]


def empty_regions(g):
    seen = [[False] * 8 for _ in range(8)]
    regions = 0
    for y in range(8):
        for x in range(8):
            if g[y][x] == 0 and not seen[y][x]:
                regions += 1
                stack = [(y, x)]
                seen[y][x] = True
                while stack:
                    cy, cx = stack.pop()
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < 8 and 0 <= nx < 8 and g[ny][nx] == 0 and not seen[ny][nx]:
                            seen[ny][nx] = True
                            stack.append((ny, nx))
    return regions


def isolated_empties(g):
    n = 0
    for y in range(8):
        for x in range(8):
            if g[y][x] == 1:
                continue
            blocked = 0
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if not (0 <= ny < 8 and 0 <= nx < 8) or g[ny][nx] == 1:
                    blocked += 1
            if blocked >= 3:
                n += 1
    return n


def near_complete_lines(g):
    n = 0
    for y in range(8):
        f = sum(g[y])
        if 6 <= f <= 7:
            n += 1
    for x in range(8):
        f = sum(g[y][x] for y in range(8))
        if 6 <= f <= 7:
            n += 1
    return n


def evaluate(g, lines, cells_placed):
    filled = sum(sum(r) for r in g)
    return (lines * 30000
            + near_complete_lines(g) * 3000
            + cells_placed * 30
            - filled * 340
            - isolated_empties(g) * 2600
            - (empty_regions(g) - 1) * 2000)


def best_move(grid, pieces):
    """Greedy best placement + anti-stranding filter:
    prefer moves that keep every OTHER tray piece placeable afterwards
    (prevents the 'no piece fits anymore' board death)."""
    candidates = []
    for p in pieces:
        shape = p["shape"]  # derived from real block coords, see tray_pieces
        cells = shape_cells(shape)
        ax, ay = p["anchor"]
        for sy in range(8):
            for sx in range(8):
                targets = [(sy + r - ay, sx + c - ax) for (r, c) in cells]
                ok = True
                for (ty, tx) in targets:
                    if not (0 <= ty < 8 and 0 <= tx < 8) or grid[ty][tx]:
                        ok = False
                        break
                if not ok:
                    continue
                g2 = [row[:] for row in grid]
                for (ty, tx) in targets:
                    g2[ty][tx] = 1
                full_rows = [y for y in range(8) if all(g2[y])]
                full_cols = [x for x in range(8) if all(g2[y][x] for y in range(8))]
                lines = len(full_rows) + len(full_cols)
                for y in full_rows:
                    g2[y] = [0] * 8
                for x in full_cols:
                    for y in range(8):
                        g2[y][x] = 0
                sc = evaluate(g2, lines, len(cells))
                candidates.append({"score": sc, "ph": p["ph"], "shapeIdx": p["shapeIdx"],
                                   "anchor_spot": (sx, sy), "targets": targets,
                                   "lines": lines, "g2": g2})
    if not candidates:
        return None

    def placeable(shape, g):
        cs = shape_cells(shape)
        base_y = min(r for (r, c) in cs)
        base_x = min(c for (r, c) in cs)
        for sy in range(8):
            for sx in range(8):
                ok = True
                for (r, c) in cs:
                    ty, tx = sy + r - base_y, sx + c - base_x
                    if not (0 <= ty < 8 and 0 <= tx < 8) or g[ty][tx]:
                        ok = False
                        break
                if ok:
                    return True
        return False

    safe = []
    for mv in candidates:
        stranded = False
        for p in pieces:
            if p["ph"] == mv["ph"]:
                continue
            if not placeable(p["shape"], mv["g2"]):
                stranded = True
                break
        if not stranded:
            safe.append(mv)
    pool = safe if safe else candidates
    best = max(pool, key=lambda m: m["score"])
    best.pop("g2", None)
    return best


# ------------------------------------------------------------------
# Bot
# ------------------------------------------------------------------

class Bot:
    def __init__(self, page, gf, cdp, log):
        self.page = page
        self.gf = gf
        self.cdp = cdp
        self.log = log
        self.move_no = 0
        self.spots = None
        self._drag_cache = {}
        # drag pacing (seconds) — video bot overrides for fast/cinematic modes
        self.pace = {"grab": 0.12, "engage": 0.20, "steps": 3,
                     "step_delay": 0.04, "settle": 0.18, "drop_wait": 0.15}

    def refresh_spots(self):
        """uid <-> (xx,yy) mapping for the closed-loop targeting."""
        self.spots = self.gf.evaluate("""() => {
            const rt = window.c3_runtimeInterface._localRuntime;
            const cls = rt._objectClassesByName.get('spot');
            return cls.GetInstances().map(s => ({u: s._uid,
                xx: s._instVarValues[0], yy: s._instVarValues[1]}));
        }""")
        self.spot_by_uid = {s["u"]: (s["xx"], s["yy"]) for s in self.spots}
        self.uid_by_cell = {(s["xx"], s["yy"]): s["u"] for s in self.spots}

    def read(self):
        return self.gf.evaluate(READ_STATE_JS)

    def gv(self, name):
        return self.gf.evaluate("(n) => window.__gv(n)", name)

    def touch(self, kind, x, y):
        pts = [{"x": x, "y": y, "id": 1}] if kind != "touchEnd" else []
        self.cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": pts})

    def input_clear(self, x=540, y=1000):
        """True when the game iframe (id=game) is the hit target."""
        try:
            r = self.page.evaluate(
                "(p) => { const e = document.elementFromPoint(p[0], p[1]);"
                " if (!e) return null;"
                " return e.tagName + '|' + (e.id || '') + '|' + (e.className || '').toString().slice(0, 40); }",
                [x, y])
            return r is not None and r.startswith("IFRAME|game")
        except Exception:
            return False

    def input_ok(self):
        """Cheap 1-point probe on the tray area: is the canvas reachable?"""
        try:
            r = self.page.evaluate(
                "(p) => { const e = document.elementFromPoint(p[0], p[1]);"
                " return !!(e && e.tagName === 'IFRAME' && e.id === 'game'); }",
                [540, 1626])
            return bool(r)
        except Exception:
            return False

    def clear_input(self):
        """Make sure touches reach the game canvas; hides blockers inline."""
        for _ in range(8):
            if self.input_clear() and self.input_clear(540, 1626) and self.input_clear(974, 300):
                return True
            # 1) consent frames first
            handle_consent(self.page, self.log)
            # 2) cancel any GD ad
            try:
                self.page.evaluate("() => window.gdsdk && window.gdsdk.cancelAd && window.gdsdk.cancelAd()")
            except Exception:
                pass
            # 3) hide whatever covers the probe points
            for pt in [(540, 1000), (540, 1626), (974, 300), (540, 300)]:
                try:
                    self.page.evaluate("""(p) => {
                        const e = document.elementFromPoint(p[0], p[1]);
                        if (e && !(e.tagName === 'IFRAME' && e.id === 'game')) {
                            e.style.setProperty('display', 'none', 'important');
                            e.style.setProperty('pointer-events', 'none', 'important');
                        }
                    }""", pt)
                except Exception:
                    pass
            self.page.wait_for_timeout(350)
        return self.input_clear()

    def wait_settled(self, timeout=8.0):
        t0 = time.time()
        prev = None
        stable = 0
        while time.time() - t0 < timeout:
            cur = json.dumps(self.gf.evaluate(LIGHT_STATE_JS))
            if cur == prev:
                stable += 1
                if stable >= 2:
                    return self.read()
            else:
                stable = 0
            prev = cur
            time.sleep(0.15)
        return self.read()

    def tray_pieces(self, st):
        ph_by_u = {p["u"]: p for p in st["placeholders"]}
        pieces = []
        for piece in st["pieces"]:
            ph = ph_by_u.get(piece["ph"])
            if not ph or ph["myShape"] < 0:
                continue
            blocks = piece["blocks"]
            if not blocks:
                continue
            # Derive the TRUE shape mask from the actual block cell coords
            # (xx=iv0, yy=iv1). myShape can lie for special/mercy pieces
            # (e.g. the 1x1s the game hands out after a revive).
            cells = [(b["yy"], b["xx"]) for b in blocks]
            miny = min(r for r, c in cells)
            minx = min(c for r, c in cells)
            cellset = {(r - miny, c - minx) for r, c in cells}
            h = max(r for r, _ in cellset) + 1
            w = max(c for _, c in cellset) + 1
            shape = [[1 if (r, c) in cellset else 0 for c in range(w)]
                     for r in range(h)]
            anchor = (blocks[0]["xx"] - minx, blocks[0]["yy"] - miny)  # (col, row)
            pieces.append({"ph": piece["ph"], "shapeIdx": ph["myShape"],
                           "shape": shape, "anchor": anchor,
                           "blocks": blocks})
        return pieces

    def drag_to(self, parent_uid, parent_pos, anchor_local, sx, sy):
        # Drag the piece so its anchor block lands on Spot(sx, sy).
        # Mechanics (from the decompiled events, verified live):
        # - touchStart near a tray block picks the piece; DX = parent.X - touch.X
        # - while dragging, parent world = (finger.x + DX, finger.y - 200),
        #   piece scales x2 (children local offsets double)
        # - anchor world = parent + local*2; CurSpot tracks the spot under it
        # Closed loop: move -> read CurSpot -> correct by whole cells.
        if self.spots is None:
            self.refresh_spots()
        target_uid = self.uid_by_cell.get((sx, sy))

        # ---- grab (retry if an overlay ate the touch) ----
        engaged = False
        for _ in range(3):
            if not self.input_ok():
                if not self.clear_input():
                    self.log("input blocked; retrying")
                    time.sleep(0.5)
                    continue
            bx = parent_pos[0] + anchor_local[0]
            by = parent_pos[1] + anchor_local[1]
            self.touch("touchStart", bx, by)
            time.sleep(self.pace["grab"])
            self.touch("touchMove", bx + 12, by - 10)
            time.sleep(self.pace["engage"])
            if self.gv("SelectedShape") == parent_uid:
                engaged = True
                break
            self.touch("touchEnd", bx + 12, by - 10)
            time.sleep(0.4)
        if not engaged:
            return False

        cached = self._drag_cache.get(parent_uid)
        if cached:
            dx, lx, ly = cached["dx"], cached["lx"], cached["ly"]
        else:
            info = self.gf.evaluate(DRAG_READ_JS, parent_uid)
            if not info or not info["blocks"]:
                self.touch("touchEnd", 0, 0)
                return False
            dx = info["dx"]
            lx, ly = info["blocks"][0]["x"], info["blocks"][0]["y"]
            self._drag_cache[parent_uid] = {"dx": dx, "lx": lx, "ly": ly}

        tx, ty = spot_center(sx, sy)
        scale = 2.0
        finger_x = tx - lx * scale - dx
        finger_y = ty - ly * scale + LIFT

        def move_finger(fx, fy, steps=None):
            if steps is None:
                steps = self.pace["steps"]
            x0, y0 = move_finger.last if hasattr(move_finger, "last") else (bx + 12, by - 10)
            for i in range(1, steps + 1):
                self.touch("touchMove", x0 + (fx - x0) * i / steps,
                           y0 + (fy - y0) * i / steps)
                time.sleep(self.pace["step_delay"])
            move_finger.last = (fx, fy)
            time.sleep(self.pace["settle"])

        try:
            for attempt in range(5):
                move_finger(finger_x, finger_y)
                cur = self.gv("CurSpot")
                if cur == target_uid and target_uid is not None:
                    self.touch("touchEnd", finger_x, finger_y)
                    time.sleep(self.pace["drop_wait"])
                    return True
                cell = self.spot_by_uid.get(cur)
                if cell:
                    ex, ey = cell
                    finger_x += (sx - ex) * CELL
                    finger_y += (sy - ey) * CELL
                else:
                    # anchor not over an empty spot; try the other scale
                    scale = 1.0 if scale == 2.0 else 2.0
                    finger_x = tx - lx * scale - dx
                    finger_y = ty - ly * scale + LIFT
            # not converged: release over the tray so the piece safely returns
            self.log(f"drag not converged (target {sx},{sy}); returning piece")
            move_finger(parent_pos[0], parent_pos[1] + 120)
            self.touch("touchEnd", parent_pos[0], parent_pos[1] + 120)
            time.sleep(0.3)
            return False
        finally:
            move_finger.last = None
            if hasattr(move_finger, "last"):
                del move_finger.last

    def wait_pieces(self, timeout=12.0):
        """Wait for tray pieces, dismissing any ad overlay that pauses the game."""
        t0 = time.time()
        while time.time() - t0 < timeout:
            st = self.read()
            if st["pieces"]:
                return st
            # GD mid-game ad can pause the game with no pieces spawning
            self.clear_input()
            time.sleep(0.7)
        return self.read()

    def play_tutorial(self):
        targets = [(3, 4), (4, 3), (3, 3)]
        for step, (sx, sy) in enumerate(targets, 1):
            st = self.wait_pieces()
            tut = self.gv("TutNum")
            if tut == 0:
                self.log("tutorial already done")
                return True
            pieces = self.tray_pieces(st)
            if not pieces:
                self.log(f"tut step {step}: no piece!")
                self.page.screenshot(path=os.path.join(OUT, f"tut{step}-nopiece.png"))
                return False
            piece = pieces[0]
            parent = next((sp for sp in st["parents"] if sp["ph"] == piece["ph"]), None)
            if parent is None:
                return False
            parent_uid = parent["u"]
            parent_pos = (parent["x"], parent["y"])
            anchor_local = (piece["blocks"][0]["x"], piece["blocks"][0]["y"])
            self.log(f"tut step {tut}: shape {piece['shapeIdx']} -> anchor ({sx},{sy})")
            ok = False
            for attempt in range(4):
                if self.drag_to(parent_uid, parent_pos, anchor_local, sx, sy):
                    time.sleep(1.6)
                    st2 = self.read()
                    if st2["gv"]["score"] > st["gv"]["score"] or st2["gv"]["tut"] != tut:
                        ok = True
                        break
                    # maybe the drop bounced: re-grab (piece back in tray)
                    piece2 = self.tray_pieces(st2)
                    if not piece2:
                        ok = True
                        break
                    piece = piece2[0] if any(p["ph"] == piece["ph"] for p in piece2) else piece2[0]
                    parent2 = next((sp for sp in st2["parents"] if sp["ph"] == piece["ph"]), None)
                    if parent2 is None:
                        return False
                    parent_uid = parent2["u"]
                    parent_pos = (parent2["x"], parent2["y"])
                    anchor_local = (piece["blocks"][0]["x"], piece["blocks"][0]["y"])
                else:
                    time.sleep(0.6)
            if not ok:
                self.log(f"tut step {step} FAILED")
                self.page.screenshot(path=os.path.join(OUT, f"tut{step}-fail.png"))
                return False
            st3 = self.wait_settled()
            self.log(f"tut step done: score={st3['gv']['score']} tut={st3['gv']['tut']}")
            self.page.screenshot(path=os.path.join(OUT, f"tut{step}-score{st3['gv']['score']}.png"))
        return True

    def play_loop(self, milestones=(1500, 2000, 2500), deadline_abs=None):
        pending = list(milestones)
        deadline = deadline_abs or (time.time() + 500)
        fails = 0
        t0 = time.time()
        iters = 0
        need_settle = True
        while time.time() < deadline:
            if need_settle:
                st = self.wait_settled()
                need_settle = False
            gv = st["gv"] or {}
            state = gv.get("state")
            score = gv.get("score") or 0

            while pending and score >= pending[0]:
                m = pending.pop(0)
                time.sleep(0.55)  # let the count-up finish for the screenshot
                self.clear_input()  # no ad in the milestone screenshot
                time.sleep(0.25)
                stx = self.read()
                if (stx["gv"]["score"] or 0) >= m:
                    self.page.screenshot(path=os.path.join(OUT, f"milestone-{m}.png"))
                    self.log(f"*** MILESTONE {m} (score={stx['gv']['score']}) ***")
                else:
                    pending.insert(0, m)
                    break
            if not pending:
                self.log("all milestones done")
                return True

            if state == "GameOver":
                self.log(f"GAME OVER at {score}")
                self.page.screenshot(path=os.path.join(OUT, f"gameover-{score}.png"))
                return False
            if state == "Pause":
                self.log("paused -> closing")
                self.touch("touchStart", 899, 482)
                time.sleep(0.12)
                self.touch("touchEnd", 899, 482)
                time.sleep(0.6)
                need_settle = True
                continue
            if state == "Revive":
                self.log(f"revive screen at {score} -> pressing revive")
                self.page.screenshot(path=os.path.join(OUT, f"revive-{score}.png"))
                self.touch("touchStart", 533, 1362)
                time.sleep(0.12)
                self.touch("touchEnd", 533, 1362)
                time.sleep(4.0)
                self.clear_input()  # dismiss the rewarded-ad overlay after the video
                time.sleep(1.0)
                # full reset: post-revive pieces/board may differ from cache
                self._drag_cache.clear()
                self.refresh_spots()
                fails = 0
                need_settle = True
                continue
            if state == "Waiting":
                time.sleep(1.0)
                need_settle = True
                continue
            if state != "HUD":
                self.log(f"unexpected state {state}, waiting")
                time.sleep(1.0)
                need_settle = True
                continue

            iters += 1
            if iters % 15 == 0:
                el = time.time() - t0
                self.log(f"pace: {self.move_no} moves, score={score}, "
                         f"{el:.0f}s, {score / max(el / 60, 0.1):.0f} pts/min, fails={fails}")

            pieces = self.tray_pieces(st)
            if not pieces:
                self.clear_input()  # dismiss a possible mid-game ad
                time.sleep(0.8)
                need_settle = True
                continue
            mv = best_move(st["grid"], pieces)
            if mv is None:
                self.log(f"no move available at {score}; waiting for game over")
                time.sleep(1.2)
                need_settle = True
                continue

            chosen = next((p for p in pieces if p["ph"] == mv["ph"]), None)
            parent = next((sp for sp in st["parents"] if sp["ph"] == mv["ph"]), None)
            if chosen is None or parent is None:
                time.sleep(0.4)
                need_settle = True
                continue
            parent_uid = parent["u"]
            parent_pos = (parent["x"], parent["y"])
            anchor_local = (chosen["blocks"][0]["x"], chosen["blocks"][0]["y"])

            self.move_no += 1
            sx, sy = mv["anchor_spot"]
            ok = self.drag_to(parent_uid, parent_pos, anchor_local, sx, sy)
            if ok:
                time.sleep(0.5)
                st2 = self.read()
                score2 = (st2["gv"] or {}).get("score") or 0
                chosen_gone = all(p["ph"] != mv["ph"] for p in st2["pieces"])
                if chosen_gone or score2 > score or \
                        len(st2["pieces"]) != len(st["pieces"]):
                    fails = 0
                    st = st2  # fast path: grid is logically committed, skip settle
                    continue
            fails += 1
            if fails > 6:
                self.log("too many failed moves; abort")
                self.page.screenshot(path=os.path.join(OUT, "stuck.png"))
                return False
            time.sleep(0.5)
            need_settle = True
        self.log("deadline")
        return False


def main():
    os.makedirs(OUT, exist_ok=True)
    log_lines = []
    t_launch = time.time()

    def log(msg):
        line = f"[{time.strftime('%H:%M:%S')}] {msg}"
        print(line, flush=True)
        log_lines.append(line)
        with open(os.path.join(OUT, "run.log"), "a") as f:
            f.write(line + "\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1080, "height": 1920},
            has_touch=True, is_mobile=True, device_scale_factor=1,
            user_agent=UA,
        )
        page = ctx.new_page()
        page.add_init_script("window.OffscreenCanvas = undefined;")
        # Pre-seed the game's Construct3 storage (IndexedDB, NOT localStorage:
        # KVStorageContainer -> db "c3-localstorage-<projectId>" v2, store
        # "keyvaluepairs", raw values, out-of-line keys) so that at layout start
        # JSON_LS.Get("Tut")==0 -> CreateShapes() straight, tutorial skipped.
        # projectId from live probe: 43p8optb74l
        page.add_init_script("""
(() => {
  try {
    const req = indexedDB.open("c3-localstorage-43p8optb74l", 2);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("keyvaluepairs"))
        db.createObjectStore("keyvaluepairs");
    };
    req.onsuccess = (e) => {
      const db = e.target.result;
      try {
        const tx = db.transaction("keyvaluepairs", "readwrite");
        tx.objectStore("keyvaluepairs").put(
          JSON.stringify({SFX: 1, Music: 1, BestScore: 1200, Tut: 0}),
          "Block Blast_Data");
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      } catch (err) { try { db.close(); } catch (_) {} }
    };
  } catch (e) {}
})();
""")
        page.goto(GD_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(4000)

        for _ in range(4):
            handle_consent(page, log)
            try:
                page.evaluate("() => window.gdsdk && window.gdsdk.cancelAd && window.gdsdk.cancelAd()")
            except Exception:
                pass
            page.wait_for_timeout(1200)

        gf = next((f for f in page.frames if "rvvASMiM" in f.url), page.main_frame)
        for _ in range(30):
            try:
                if gf.evaluate("() => !!(window.c3_runtimeInterface && window.c3_runtimeInterface._localRuntime)"):
                    break
            except Exception:
                pass
            page.wait_for_timeout(1000)

        gf.evaluate(GV_SETUP_JS)
        page.add_style_tag(content=NEUTRALIZE_CSS)

        st = gf.evaluate(READ_STATE_JS)
        log(f"up: state={st['gv']['state']} score={st['gv']['score']} "
            f"tut={st['gv']['tut']} pieces={len(st['pieces'])}")
        page.screenshot(path=os.path.join(OUT, "00-start.png"))

        cdp = ctx.new_cdp_session(page)
        bot = Bot(page, gf, cdp, log)
        bot.refresh_spots()

        if not bot.play_tutorial():
            log("tutorial failed; trying normal loop anyway")
        page.screenshot(path=os.path.join(OUT, "01-after-tutorial.png"))

        bot.play_loop(milestones=(1500, 2000, 2500),
                      deadline_abs=t_launch + 560)
        page.screenshot(path=os.path.join(OUT, "02-final.png"))

        st = bot.read()
        log(f"FINAL: state={st['gv']['state']} score={st['gv']['score']} combo={st['gv']['combo']}")
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
