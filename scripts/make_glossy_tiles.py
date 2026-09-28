#!/usr/bin/env python3
"""Generate the Glossy theme color variants:
- recolor public/textures/red-cell.png (hue 352, monochrome red family) into
  N variant cell tiles via HSV rotate + sat scale + value remap
- render a contact sheet (download/skin-studio/glossy-varianti.png) using the
  SAME flat-color derivation formula that will live in src/lib/glossy.ts

The derivation here MUST stay in sync with src/lib/glossy.ts so that preset
tiles (generated offline by this script) match the runtime color-sphere recolor.
"""
import colorsys
import json
import math
from PIL import Image, ImageDraw, ImageFont

TEX = '/home/z/my-project/public/textures'
OUT_SHEET = '/home/z/my-project/download/skin-studio/glossy-varianti.png'

SRC_HUE = 352.0  # dominant hue of red-cell.png

# ---------------------------------------------------------------- variants ---
# base hex tuned per variant; everything else is derived by the shared formula
VARIANTS = [
    # (id, name, base hex)   rosso kept as reference (uses ORIGINAL tile+colors)
    ('glossyRosso',       'Rosso',        '#C0152A'),
    ('glossyNero',        'Nero',         '#2B2D33'),
    ('glossyBianco',      'Bianco',       '#EFEFF2'),
    ('glossyViola',       'Viola',        '#7A2BD6'),
    ('glossyGiallo',      'Giallo',       '#F5C400'),
    ('glossyVerdeChiaro', 'Verde chiaro', '#7ED957'),
    ('glossyAzzurro',     'Azzurro',      '#55C1F2'),
    ('glossyBlu',         'Blu reale',    '#3D5AF1'),
    ('glossyArancio',     'Arancione',    '#FF8A00'),
    ('glossyRosa',        'Rosa',         '#EE4E94'),
    ('glossyTeal',        'Teal',         '#00A99D'),
    ('glossyVerde',       'Verde',        '#23B04A'),
    ('glossyFucsia',      'Fucsia',       '#D63DE0'),
    ('glossyGrigio',      'Grigio',       '#707A8C'),
]

# ------------------------------------------------------- shared color math ---
def hex2rgb(hx):
    hx = hx.lstrip('#')
    return tuple(int(hx[i:i + 2], 16) for i in (0, 2, 4))

def _r(x):
    # JS Math.round semantics (half away from zero) — Python round() is banker's
    return int(math.floor(max(0, min(255, x)) + 0.5))

def rgb2hex(rgb):
    return '#%02X%02X%02X' % tuple(_r(c) for c in rgb)

def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

DARKEN = lambda rgb, k: mix(rgb, (0, 0, 0), k)          # k=0.4 -> 40% toward black
LIGHTEN = lambda rgb, k: mix(rgb, (255, 255, 255), k)

def rgb2hsl(rgb):
    r, g, b = (c / 255 for c in rgb)
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    d = mx - mn
    if d == 0:
        return 0.0, 0.0, l * 100
    s = d / (1 - abs(2 * l - 1))
    if mx == r:
        h = ((g - b) / d) % 6
    elif mx == g:
        h = (b - r) / d + 2
    else:
        h = (r - g) / d + 4
    return (h * 60) % 360, s * 100, l * 100

def glossy_theme_colors(base_hex):
    """FLAT colors + tile params derived from one base hex.
    Mirrors glossyThemeColors() in src/lib/glossy.ts — keep in sync!"""
    rgb = hex2rgb(base_hex)
    h, s, l = rgb2hsl(rgb)
    achromatic = s < 22
    light = l > 66
    dark = l < 22
    white = (255, 255, 255)

    if light:
        v_lo, v_hi = 0.42, 0.99
    elif dark:
        v_lo, v_hi = 0.10, 0.62
    elif l < 45:
        v_lo, v_hi = 0.15, 0.92
    else:
        v_lo, v_hi = 0.22, 0.95

    return {
        'base': base_hex,
        'h': h, 's': s, 'l': l,
        'bgTop': rgb2hex(LIGHTEN(rgb, 0.35) if light else DARKEN(rgb, 0.07)),
        'bgBottom': rgb2hex(DARKEN(rgb, 0.22 if light else 0.40)),
        'plate': rgb2hex(DARKEN(rgb, 0.64)),
        'cell': rgb2hex(DARKEN(rgb, 0.42)),
        'line': rgb2hex(DARKEN(rgb, 0.72)),
        'tray': rgb2hex(DARKEN(rgb, 0.70)),
        'iconBtn': rgb2hex(DARKEN(rgb, 0.22)),
        'popupStyle': 'light' if light else 'dark',
        'popupC1': rgb2hex(LIGHTEN(rgb, 0.55) if light else DARKEN(rgb, 0.72)),
        'scoreColor': '#2E3238' if light else '#FFFFFF',
        'scoreStroke': '#FFFFFF' if light else rgb2hex(DARKEN(rgb, 0.75)),
        'bestColor': '#C08A00' if light else '#FFD75E',
        'iconIconColor': '#3A3E48' if light else '#FFFFFF',
        'flash': rgb2hex(mix(rgb, white, 0.85)),
        # tile remap params (runtime canvas recolor uses the same)
        'tileDelta': ((h - SRC_HUE + 540) % 360) - 180,
        # chromatic bases keep the source saturation; low-sat bases target
        # body S = base S (slate/pastel), floor 0.06 for clean nero/bianco
        'tileSat': 1.0 if s >= 50 else min(1.0, max(0.06, s / 100) / 0.96),
        'tileVLo': v_lo, 'tileVHi': v_hi,
    }

# ------------------------------------------------------------ tile recolor ---
def recolor_tile(src_img, delta, sat_scale, v_lo, v_hi):
    """HSV rotate + sat scale + value remap — mirrors recolorGlossyTile() in TS."""
    out = src_img.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            hh = (hh * 360 + delta) % 360 / 360
            ss = min(1.0, ss * sat_scale)
            vv = v_lo + (v_hi - v_lo) * vv
            r2, g2, b2 = colorsys.hsv_to_rgb(hh, ss, vv)
            px[x, y] = (_r(r2 * 255), _r(g2 * 255), _r(b2 * 255))
    return out

# ------------------------------------------------------------- generation ---
src = Image.open(f'{TEX}/red-cell.png').convert('RGB')
report = []
tiles = {}

for vid, name, base in VARIANTS:
    c = glossy_theme_colors(base)
    if vid == 'glossyRosso':
        # the source theme: keep the original extracted tile + hand-tuned colors
        c.update(bgTop='#B11524', bgBottom='#7A0A12', plate='#4A0309',
                 cell='#75010F', line='#30010A', tray='#3E030A')
        tile = src
        tiles[vid] = src
    else:
        tile = recolor_tile(src, c['tileDelta'], c['tileSat'], c['tileVLo'], c['tileVHi'])
        tile.save(f'{TEX}/{vid.replace("glossy", "glossy-cell-").lower()}.png')
        tiles[vid] = tile
    report.append({'id': vid, 'name': name, **c})
    print(f'{vid:20s} base={base}  bg {c["bgTop"]}->{c["bgBottom"]}  plate={c["plate"]}  '
          f'delta={c["tileDelta"]:+.0f} sat={c["tileSat"]} v=[{c["tileVLo"]},{c["tileVHi"]}]')

with open('/home/z/my-project/scripts/glossy-deriv.json', 'w') as f:
    json.dump(report, f, indent=2)

# ------------------------------------------------------------ contact sheet ---
CW, CH, COLS = 300, 470, 7
ROWS = math.ceil(len(VARIANTS) / COLS)
HDR = 84
sheet = Image.new('RGB', (COLS * (CW + 12) + 12, ROWS * (CH + 12) + 12 + HDR), (13, 14, 18))
sd = ImageDraw.Draw(sheet)
try:
    f_big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
    f_sm = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
    f_xs = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
except OSError:
    f_big = f_sm = f_xs = ImageFont.load_default()

sd.text((22, 18), 'TEMA GLOSSY — varianti colore (celle ricolorate + sfondo/piatto derivati)',
        font=f_big, fill=(240, 200, 120))

candy = Image.open(f'{TEX}/choco-shot-1.png').convert('RGB').resize((52, 52), Image.LANCZOS)
candy2 = Image.open(f'{TEX}/choco-shot-4.png').convert('RGB').resize((52, 52), Image.LANCZOS)
candy3 = Image.open(f'{TEX}/choco-shot-6.png').convert('RGB').resize((52, 52), Image.LANCZOS)
cmask = Image.new('L', (52, 52), 0)
ImageDraw.Draw(cmask).rounded_rectangle([1, 1, 51, 51], radius=10, fill=255)

for i, (vid, name, base) in enumerate(VARIANTS):
    c = report[i]
    col, row = i % COLS, i // COLS
    x0 = 12 + col * (CW + 12)
    y0 = 12 + HDR + row * (CH + 12)
    card = Image.new('RGB', (CW, CH))
    cd = ImageDraw.Draw(card)
    top, bot = hex2rgb(c['bgTop']), hex2rgb(c['bgBottom'])
    for y in range(CH):
        t = y / (CH - 1)
        cd.line([(0, y), (CW, y)], fill=tuple(int(top[k] + (bot[k] - top[k]) * t) for k in range(3)))

    # plate 264x264 with 5x5 cells of 48px
    px_, py_, PS = 18, 96, 264
    cd.rounded_rectangle([px_ - 6, py_ - 6, px_ + PS + 6, py_ + PS + 6], radius=26,
                         fill=hex2rgb(c['plate']))
    t48 = tiles[vid].resize((48, 48), Image.LANCZOS)
    tmask = Image.new('L', (48, 48), 0)
    ImageDraw.Draw(tmask).rounded_rectangle([0, 0, 48, 48], radius=13, fill=255)
    for r in range(5):
        for cc in range(5):
            card.paste(t48, (px_ + cc * 52 + 2, py_ + r * 52 + 2), tmask)
    for j, cn in enumerate((candy, candy2, candy3)):
        card.paste(cn, (px_ + 84 + j * 58, py_ + PS - 60), cmask)

    cd.text((18, 14), name, font=f_sm, fill=hex2rgb(c['scoreColor']))
    cd.text((18, 40), f'base {base}', font=f_xs, fill=hex2rgb(c['bestColor']))
    # small score preview
    cd.text((CW - 18, 16), '1 2 4 8', font=f_sm, anchor='ra', fill=hex2rgb(c['scoreColor']))
    # tray preview
    cd.rounded_rectangle([18, CH - 58, 18 + 74, CH - 18], radius=16,
                         fill=hex2rgb(c['tray']))
    cd.rounded_rectangle([18 + 84, CH - 58, 18 + 84 + 74, CH - 18], radius=16,
                         fill=hex2rgb(c['tray']))
    cd.rounded_rectangle([18 + 168, CH - 58, 18 + 168 + 74, CH - 18], radius=16,
                         fill=hex2rgb(c['tray']))
    sheet.paste(card, (x0, y0))

sheet.save(OUT_SHEET)
print('saved', OUT_SHEET, sheet.size)
