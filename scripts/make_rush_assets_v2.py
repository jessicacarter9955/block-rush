#!/usr/bin/env python3
"""Block Rush blocks v2 — sharper 3-band glossy look per VLM feedback:
hard-edged bands (bright top 28%, base mid, dark bottom), plumper corners
(~24% radius), crisp specular reflection. Colors stay pixel-sampled."""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = '/home/z/my-project/public/textures/rush'
os.makedirs(OUT, exist_ok=True)

PALETTE = [
    ('rosso',   (0xC4, 0x0A, 0x0A)),
    ('arancio', (0xD8, 0x8A, 0x00)),
    ('giallo',  (0xF8, 0xD0, 0x00)),
    ('verde',   (0x05, 0xC7, 0x05)),
    ('ciano',   (0x06, 0xC2, 0xC2)),
    ('blu',     (0x10, 0x8A, 0xE8)),
    ('viola',   (0x88, 0x48, 0xE0)),
    ('magenta', (0xC4, 0x0A, 0xC4)),
]


def mix(c, w, t):
    return tuple(int(round(a + (b - a) * t)) for a, b in zip(c, w))


def darken(c, t):
    return tuple(int(round(a * (1 - t))) for a in c)


def make_block(path, base):
    S = 256
    R = 60  # ~24% plump corner
    top_c = mix(base, (255, 255, 255), 0.42)
    hi2 = mix(base, (255, 255, 255), 0.20)
    bot_c = darken(base, 0.38)
    edge_c = darken(base, 0.52)

    body = Image.new('RGB', (S, S))
    px = body.load()
    for y in range(S):
        t = y / (S - 1)
        if t < 0.28:
            # top band: bright → slight-less-bright (hard edge at 28%)
            k = t / 0.28
            c = mix(top_c, hi2, k * 0.55)
        elif t < 0.70:
            k = (t - 0.28) / 0.42
            c = mix(hi2, base, min(1.0, k * 1.6))
        else:
            k = (t - 0.70) / 0.30
            c = mix(base, bot_c, min(1.0, k * 1.7))
        for x in range(S):
            px[x, y] = c

    im = body.convert('RGBA')
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=R, fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)

    # crisp specular: white rounded strip under the top edge
    gl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gl)
    gd.rounded_rectangle([30, 16, S - 30, int(S * 0.20)], radius=26, fill=(255, 255, 255, 120))
    gl = gl.filter(ImageFilter.GaussianBlur(4))
    out = Image.alpha_composite(out, gl)

    # bottom reflection glow (subtle bounce light)
    bl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bl)
    bd.rounded_rectangle([40, int(S * 0.82), S - 40, S - 18], radius=22, fill=mix(base, (255, 255, 255), 0.30) + (46,))
    bl = bl.filter(ImageFilter.GaussianBlur(7))
    out = Image.alpha_composite(out, bl)

    # dark outline
    ol = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(ol).rounded_rectangle([1, 1, S - 2, S - 2], radius=R, outline=edge_c + (255,), width=6)
    out = Image.alpha_composite(out, ol)

    out.save(path)
    print('block v2 ->', path)


for i, (name, c) in enumerate(PALETTE):
    make_block(f'{OUT}/block-{i}-{name}.png', c)
print('done')
