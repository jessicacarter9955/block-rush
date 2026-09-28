#!/usr/bin/env python3
"""Block Rush 1:1 asset generation (web textures).

Reference: real Block Rush gameplay screenshot (1170x2532) analyzed with
pixel probes:
  - background: flat deep purple #4E076D
  - empty cell: #2A0139 with darker seams (~#150122), rounded container
  - blocks: glossy 3D — light band on top (~mix white 32%), base color,
    darker bottom (~-33%), thin dark outline, rounded corners
  - palette (6 sampled + 2 style-consistent completions):
    red #C00000, orange #C87D00, yellow #F8D000, green #01C501,
    cyan #00C0C0, blue #0090F8, purple #8848E0, magenta #C000C0
Outputs to public/textures/rush/:
  bg-game.jpg  bg-home.jpg  cell.png  block-0..7.png
"""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = '/home/z/my-project/public/textures/rush'
os.makedirs(OUT, exist_ok=True)

BG = (0x4E, 0x07, 0x6D)
CELL = (0x2A, 0x01, 0x39)
SEAM = (0x15, 0x01, 0x22)

PALETTE = [
    ('rosso',   (0xC0, 0x00, 0x00)),
    ('arancio', (0xC8, 0x7D, 0x00)),
    ('giallo',  (0xF8, 0xD0, 0x00)),
    ('verde',   (0x01, 0xC5, 0x01)),
    ('ciano',   (0x00, 0xC0, 0xC0)),
    ('blu',     (0x00, 0x90, 0xF8)),
    ('viola',   (0x88, 0x48, 0xE0)),
    ('magenta', (0xC0, 0x00, 0xC0)),
]


def mix(c, w, t):
    """Mix color c toward t (0..1)."""
    return tuple(int(round(a + (b - a) * t)) for a, b in zip(c, w))


def lighten(c, t):
    return mix(c, (255, 255, 255), t)


def darken(c, t):
    return tuple(int(round(a * (1 - t))) for a in c)


def make_bg(path):
    """1080x1920 flat Block Rush purple with ultra-subtle noise (no banding)."""
    import random
    random.seed(42)
    im = Image.new('RGB', (1080, 1920), BG)
    px = im.load()
    for y in range(0, 1920, 2):
        for x in range(0, 1080, 2):
            n = random.randint(-2, 2)
            r, g, b = BG
            px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
    im.save(path, quality=90)
    print('bg ->', path)


def rounded_mask(size, radius):
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def make_cell(path):
    """256x256 seamless empty-cell tile: dark purple #2A0139 with inset bevel
    and darker seam border (matches candy cell format used by cellImg)."""
    S = 256
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    # seam backdrop (slightly larger than the cell → visible dark seam)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=30, fill=SEAM + (255,))
    # main cell body
    inset = 5
    d.rounded_rectangle([inset, inset, S - 1 - inset, S - 1 - inset], radius=26, fill=CELL + (255,))
    # subtle inset bevel: darker top edge, lighter bottom edge (sunken look)
    bevel = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bevel)
    bd.rounded_rectangle([inset, inset, S - 1 - inset, S - 1 - inset], radius=26, outline=(0, 0, 0, 90), width=3)
    # soft inner shadow at top
    sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle([inset + 6, inset + 2, S - 7 - inset, inset + 16], radius=18, fill=(0, 0, 0, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(6))
    im = Image.alpha_composite(im, sh)
    im = Image.alpha_composite(im, bevel)
    im.save(path)
    print('cell ->', path)


def make_block(path, base):
    """256x256 glossy Block Rush block:
    top light band, base mid, darker bottom, dark outline, corner radius."""
    S = 256
    R = 34
    # vertical gradient body
    body = Image.new('RGB', (S, S))
    px = body.load()
    top_c = mix(base, (255, 255, 255), 0.34)
    bot_c = darken(base, 0.34)
    for y in range(S):
        t = y / (S - 1)
        if t < 0.30:
            # top band: top_c -> base
            k = t / 0.30
            c = mix(top_c, base, k)
        elif t < 0.72:
            c = base
        else:
            k = (t - 0.72) / 0.28
            c = mix(base, bot_c, k * k)
        for x in range(S):
            px[x, y] = c
    # horizontal sheen: slightly brighter center
    sheen = Image.new('L', (S, S), 0)
    sd = ImageDraw.Draw(sheen)
    sd.ellipse([-40, -30, S + 40, int(S * 0.55)], fill=46)
    sheen = sheen.filter(ImageFilter.GaussianBlur(24))
    white = Image.new('RGB', (S, S), (255, 255, 255))
    body = Image.composite(white, body, sheen.point(lambda v: v // 3))

    im = body.convert('RGBA')
    # rounded mask
    mask = rounded_mask(S, R)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)

    # dark outline
    ol = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    od = ImageDraw.Draw(ol)
    od.rounded_rectangle([0, 0, S - 1, S - 1], radius=R, outline=darken(base, 0.55) + (255,), width=5)
    out = Image.alpha_composite(out, ol)

    # top gloss highlight (glassy strip)
    gl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gl)
    gd.rounded_rectangle([26, 14, S - 26, int(S * 0.24)], radius=22, fill=(255, 255, 255, 60))
    gl = gl.filter(ImageFilter.GaussianBlur(8))
    out = Image.alpha_composite(out, gl)

    out.save(path)
    print('block ->', path)


make_bg(f'{OUT}/bg-game.jpg')
make_bg(f'{OUT}/bg-home.jpg')
make_cell(f'{OUT}/cell.png')
for i, (name, c) in enumerate(PALETTE):
    make_block(f'{OUT}/block-{i}-{name}.png', c)
print('done')
