#!/usr/bin/env python3
"""Deep-dive: bg texture patches + locate the clean left pink block in tray."""
from PIL import Image
import os

SRC = 'upload/pasted_image_1789654565369.png'
OUT = 'download/ref-analysis'
img = Image.open(SRC).convert('RGB')
W, H = img.size
sx, sy = W / 1080, H / 1920

def crop_design(dx, dy, dw, dh, name, scale=3):
    x0, y0 = int(dx * sx), int(dy * sy)
    x1, y1 = int((dx + dw) * sx), int((dy + dh) * sy)
    c = img.crop((x0, y0, x1, y1))
    if scale != 1:
        c = c.resize((c.width * scale, c.height * scale), Image.LANCZOS)
    c.save(f'{OUT}/{name}.png')
    return c

# bg texture patches (clean areas)
crop_design(4, 300, 34, 400, 'patch-left', 4)
crop_design(1042, 300, 34, 400, 'patch-right', 4)
crop_design(80, 1350, 280, 130, 'patch-midband', 3)
crop_design(380, 1490, 320, 120, 'patch-above-tray', 3)

# tray left block region — generous crop around expected clean block
crop_design(330, 1530, 200, 190, 'tray-leftblock', 3)

# grid probes over the left block area to find exact block bounds
print('=== left block area probes (design coords) ===')
for dy in range(1540, 1700, 12):
    row = []
    for dx in range(340, 500, 10):
        r, g, b = img.getpixel((int(dx * sx), int(dy * sy)))
        row.append(f'{r:3d},{g:3d},{b:3d}')
    print(f'y={dy}: ' + ' | '.join(row))

# Also probe where the tray stadium actually is: scan row y=1626 for the rim
print()
print('=== tray rim scan y=1626 (design) ===')
prev = None
for dx in range(0, 1080, 6):
    r, g, b = img.getpixel((int(dx * sx), int(1626 * sy)))
    lum = (r + g + b) / 3
    tag = 'D' if lum < 60 else ('R' if r > 120 and g < 90 else '.')
    if tag != prev:
        print(f'  x={dx:4d} {tag} #{r:02X}{g:02X}{b:02X}')
        prev = tag
