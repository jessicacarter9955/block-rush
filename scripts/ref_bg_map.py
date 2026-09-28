#!/usr/bin/env python3
"""Coarse bg color map + extract the clean left pink block from the tray."""
from PIL import Image
import os

SRC = 'upload/pasted_image_1789654565369.png'
OUT = 'download/ref-analysis'
img = Image.open(SRC).convert('RGB')
W, H = img.size
sx, sy = W / 1080, H / 1920

# ---- coarse color map of the bg (design grid 18 x 24 cells) ----
print('=== BG COLOR MAP (rows y=40..1900 step 80, cols x=30..1050 step 85) ===')
print('      ' + ''.join(f'{x:>8d}' for x in range(30, 1051, 85)))
for dy in range(40, 1901, 80):
    row = f'y={dy:4d} '
    for dx in range(30, 1051, 85):
        r, g, b = img.getpixel((int(dx * sx), int(dy * sy)))
        row += f' {r:02X}{g:02X}{b:02X}'
    print(row)

# ---- extract clean left pink block ----
# design rect -> px
def crop_design(dx, dy, dw, dh, name, scale=1):
    x0, y0 = int(dx * sx), int(dy * sy)
    x1, y1 = int((dx + dw) * sx), int((dy + dh) * sy)
    c = img.crop((x0, y0, x1, y1))
    if scale != 1:
        c = c.resize((c.width * scale, c.height * scale), Image.LANCZOS)
    c.save(f'{OUT}/{name}.png')
    print(f'{name}: design({dx},{dy},{dw},{dh}) px({x0},{y0},{x1},{y1}) {c.size}')

crop_design(362, 1550, 116, 122, 'redblock-raw')
# the block interior color at center
cx, cy = int(420 * sx), int(1612 * sy)
print('block center px:', img.getpixel((cx, cy)))
# sample a 5x5 average at center
rs = gs = bs = 0
for ddx in range(-8, 9, 4):
    for ddy in range(-8, 9, 4):
        r, g, b = img.getpixel((cx + ddx, cy + ddy))
        rs += r; gs += g; bs += b
n = len(range(-8, 9, 4)) ** 2
print(f'block center avg: #{rs//n:02X}{gs//n:02X}{bs//n:02X}')
