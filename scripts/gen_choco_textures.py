#!/usr/bin/env python3
"""Generate chocolate block textures for the Skin Studio.

Two grayscale textures (tinted at runtime via CSS multiply-blend so the
user's RGB colors keep working):
  - public/textures/choco-bar.png    -> chocolate-bar segment (raised square,
                                        bevel, groove ring, molded noise)
  - public/textures/choco-bonbon.png -> praline / cioccolatino (dome, stamped
                                        ring + diamond, rim, bottom shade)
Also writes a color preview montage (multiply-tinted with the chocolate
palette) for verification.
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageChops

S = 256
OUT = '/home/z/my-project/public/textures'
os.makedirs(OUT, exist_ok=True)


def clamp(v):
    return max(0, min(255, int(v)))


# ----------------------------------------------------------------- barretta --
def gen_bar():
    img = Image.new('L', (S, S), 150)  # rim (the "land" between segments)
    d = ImageDraw.Draw(img)
    # recessed groove ring around the segment
    d.rounded_rectangle([6, 6, S - 7, S - 7], radius=26, fill=88)
    # raised segment
    ib = 20
    d.rounded_rectangle([ib, ib, S - ib - 1, S - ib - 1], radius=18, fill=206)
    # molded bevel: top/left catch the light, bottom/right fall into shadow
    b = 8
    d.rounded_rectangle([ib, ib, S - ib - 1, ib + b], radius=10, fill=238)
    d.rectangle([ib, ib + b, ib + b, S - ib - 1], fill=230)
    d.rounded_rectangle([ib, S - ib - 1 - b, S - ib - 1, S - ib - 1], radius=10, fill=126)
    d.rectangle([S - ib - 1 - b, ib + b, S - ib - 1, S - ib - 1 - b], fill=138)
    img = img.filter(ImageFilter.GaussianBlur(1.1))

    # soft radial light from top-left + chocolate speckle
    cx, cy = S * 0.46, S * 0.42
    maxr = S * 0.72
    px = img.load()
    random.seed(42)
    for y in range(S):
        for x in range(S):
            v = px[x, y]
            dist = math.hypot(x - cx, y - cy)
            v += max(0.0, 1 - dist / maxr) * 15
            v += random.uniform(-4.5, 4.5)
            px[x, y] = clamp(v)
    return img


# --------------------------------------------------------------- cioccolatino --
def gen_bonbon():
    img = Image.new('L', (S, S), 0)
    px = img.load()
    cx, cy = S / 2, S / 2
    R = S / 2
    random.seed(7)
    for y in range(S):
        for x in range(S):
            dx, dy = x - cx, y - cy
            dist = math.hypot(dx, dy)
            t = dist / R
            v = 220 - 102 * (t ** 1.15)              # dome falloff
            if t > 0.80:
                v = 96                                # dark outer rim
            if 0.40 <= t <= 0.50:
                v -= 42                               # stamped ring
            m = abs(dx) + abs(dy)                     # embossed diamond
            if m < 30:
                v += 16
            elif m < 40:
                v -= 28
            v += (-(dx + dy)) / R * 14                # directional key light
            if dy > R * 0.55:                         # bottom shade
                v -= (dy - R * 0.55) / R * 62
            v += random.uniform(-4, 4)
            px[x, y] = clamp(v)
    return img.filter(ImageFilter.GaussianBlur(0.6))


def tint(gray, hexcolor):
    r = int(hexcolor[1:3], 16)
    g = int(hexcolor[3:5], 16)
    b = int(hexcolor[5:7], 16)
    solid = Image.new('RGB', gray.size, (r, g, b))
    return ImageChops.multiply(solid, gray.convert('RGB'))


bar = gen_bar()
bon = gen_bonbon()
bar.save(f'{OUT}/choco-bar.png', optimize=True)
bon.save(f'{OUT}/choco-bonbon.png', optimize=True)

# ------------------------------------------------------------ verification --
CHOCO_PALETTE = ['#C2185B', '#FDD835', '#7CB342', '#4E342E',
                 '#EF6C00', '#00ACC1', '#AD1457', '#8D6E63']
cell = 128
mont = Image.new('RGB', (cell * 8 * 2 + 30, cell + 60), (26, 35, 126))
for i, c in enumerate(CHOCO_PALETTE):
    mont.paste(tint(bar, c).resize((cell, cell), Image.LANCZOS), (10 + i * cell, 10))
    mont.paste(tint(bon, c).resize((cell, cell), Image.LANCZOS), (10 + (8 + i) * cell + 10, 10))
mont.save('/home/z/my-project/download/skin-studio/21-choco-textures.png', optimize=True)

print('bar    :', f'{OUT}/choco-bar.png', os.path.getsize(f"{OUT}/choco-bar.png") // 1024, 'KB')
print('bonbon :', f'{OUT}/choco-bonbon.png', os.path.getsize(f"{OUT}/choco-bonbon.png") // 1024, 'KB')
print('preview: download/skin-studio/21-choco-textures.png')
