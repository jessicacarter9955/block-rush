#!/usr/bin/env python3
"""Block Rush blocks v3 — EXACT measured parameters from the real screenshot:

Measured on a 128.25px cell:
  - block = 118px (inset 8px/side = 6.25% gap → 12.5% visible seam between blocks)
  - corner radius ~10px on 118px block (~9%)
  - pure vertical 3-band shading, NO outline, NO specular:
      light band 0-33%  = mix(base, white, 0.22)
      blend    33-39%
      base     39-82%
      blend    82-87%
      dark     87-100% = darken(base, 0.23)
  - empty board = FLAT #2A0139 panel (no grid lines between empty cells)

Tile = 256px = one cell pitch; block 224px centered; radius 20px.
"""
import os
from PIL import Image, ImageDraw

OUT = '/home/z/my-project/public/textures/rush'
os.makedirs(OUT, exist_ok=True)

PALETTE = [
    ('rosso',   (0xC4, 0x0A, 0x0A)),
    ('arancio', (0xC8, 0x7D, 0x00)),
    ('giallo',  (0xF8, 0xD0, 0x00)),
    ('verde',   (0x01, 0xC5, 0x01)),
    ('ciano',   (0x00, 0xC0, 0xC0)),
    ('blu',     (0x00, 0x90, 0xF8)),
    ('viola',   (0x88, 0x48, 0xE0)),
    ('magenta', (0xC4, 0x0A, 0xC4)),
]

S = 256          # tile = cell pitch
INSET = 16       # 6.25%
B = S - 2 * INSET  # block 224
R = 20           # ~9%


def mix(c, w, t):
    return tuple(int(round(a + (b - a) * t)) for a, b in zip(c, w))


def darken(c, t):
    return tuple(int(round(a * (1 - t))) for a in c)


def make_block(path, base):
    light = mix(base, (255, 255, 255), 0.22)
    dark = darken(base, 0.23)
    # build one column of colors then tile horizontally (flat horizontally)
    col = []
    for y in range(B):
        t = y / (B - 1)
        if t < 0.33:
            c = light
        elif t < 0.39:
            c = mix(light, base, (t - 0.33) / 0.06)
        elif t < 0.82:
            c = base
        elif t < 0.87:
            c = mix(base, dark, (t - 0.82) / 0.05)
        else:
            c = dark
        col.append(c)
    body = Image.new('RGB', (B, B))
    px = body.load()
    for y in range(B):
        c = col[y]
        for x in range(B):
            px[x, y] = c

    im = body.convert('RGBA')
    mask = Image.new('L', (B, B), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, B - 1, B - 1], radius=R, fill=255)
    tile = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    tile.paste(im, (INSET, INSET), mask)
    tile.save(path)
    print('block v3 ->', path)


def make_cell(path):
    """Flat empty cell — the real board shows NO grid lines between
    empty cells, just a uniform #2A0139 panel."""
    Image.new('RGBA', (256, 256), (0x2A, 0x01, 0x39, 255)).save(path)
    print('cell v3 (flat) ->', path)


make_cell(f'{OUT}/cell.png')
for i, (name, c) in enumerate(PALETTE):
    make_block(f'{OUT}/block-{i}-{name}.png', c)

# verification sheet: my blocks vs real cropped blocks side by side
real_g = Image.open('/tmp/rush-img/block-green.png').convert('RGB').resize((256, 256))
real_o = Image.open('/tmp/rush-img/block-orange.png').convert('RGB').resize((256, 256))
mine_g = Image.open(f'{OUT}/block-3-verde.png').convert('RGB')
mine_o = Image.open(f'{OUT}/block-1-arancio.png').convert('RGB')
sheet = Image.new('RGB', (256 * 4, 256), (30, 30, 40))
sheet.paste(real_g, (0, 0)); sheet.paste(mine_g, (256, 0))
sheet.paste(real_o, (512, 0)); sheet.paste(mine_o, (768, 0))
sheet.save('/tmp/rush-compare.png')
print('compare sheet -> /tmp/rush-compare.png')
