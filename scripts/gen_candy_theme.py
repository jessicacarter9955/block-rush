#!/usr/bin/env python3
"""Analyze reference bg gradient + extract assets for the candy theme family.

Outputs (download/ref-analysis/):
  - bg-analysis.txt  : sampled gradient structure
  - red-tile.png     : clean red candy block (from tray piece, LEFT block)
  - cell-tile.png    : empty board cell with bevel (alpha corners)
  - bg-full.png      : reconstructed clean background 1080x1920
"""
from PIL import Image
import os

SRC = 'upload/pasted_image_1789654565369.png'
OUT = 'download/ref-analysis'
os.makedirs(OUT, exist_ok=True)

img = Image.open(SRC).convert('RGB')
W, H = img.size
sx, sy = W / 1080, H / 1920

def P(dx, dy):
    """Sample design-space point."""
    return img.getpixel((min(int(dx * sx), W - 1), min(int(dy * sy), H - 1)))

def hx(p):
    return f'#{p[0]:02X}{p[1]:02X}{p[2]:02X}'

# ---------------------------------------------------------------- bg study --
# Clean background regions: left strip (x 2..36), right strip (x 1044..1078),
# band between board bottom (y 1331) and tray top (~y 1500), bottom band (y 1860+)
print('=== BG STRUCTURE ===')
print('--- left strip x=15, varying y ---')
for dy in range(0, 1920, 160):
    print(f'  y={dy:4d}  {hx(P(15, dy))}')
print('--- right strip x=1065, varying y ---')
for dy in range(0, 1920, 160):
    print(f'  y={dy:4d}  {hx(P(1065, dy))}')
print('--- horizontal profile y=1390 (between board and tray) ---')
for dx in range(0, 1080, 120):
    print(f'  x={dx:4d}  {hx(P(dx, 1390))}')
print('--- horizontal profile y=60 (top, away from center title) ---')
for dx in range(0, 1080, 135):
    print(f'  x={dx:4d}  {hx(P(dx, 60))}')
print('--- horizontal profile y=1890 (very bottom) ---')
for dx in range(0, 1080, 135):
    print(f'  x={dx:4d}  {hx(P(dx, 1890))}')
print('--- vertical center profile x=540 (top region y<331, above board) ---')
for dy in range(0, 340, 40):
    print(f'  y={dy:4d}  {hx(P(540, dy))}')

# local variance (texture or smooth?)
import statistics
def patch_var(x, y, r=6):
    vals = []
    for ddx in range(-r, r + 1, 2):
        for ddy in range(-r, r + 1, 2):
            p = P(x + ddx, y + ddy)
            vals.append(sum(p) / 3)
    return statistics.pstdev(vals)

print('--- smoothness (stdev of luminance in 13px patches) ---')
for (x, y) in [(15, 200), (15, 1000), (1065, 600), (540, 1400), (15, 1700), (1065, 1400)]:
    print(f'  ({x},{y}) stdev={patch_var(x, y):.2f}')

# ------------------------------------------------------------- red tile ------
# The tray piece: 3 pink blocks around y~1626. Find them by scanning the tray
# band for saturated pink/red blobs that differ from the dark tray interior.
print()
print('=== TRAY PIECE SCAN (y band 1560..1700) ===')
# The tray is a wide stadium; find the piece: scan for rows of bright pixels
band_y0, band_y1 = int(1520 * sy), int(1720 * sy)
bright_cols = []
for x in range(0, W, 4):
    lum_max = 0
    for y in range(band_y0, band_y1, 6):
        r, g, b = img.getpixel((x, y))
        lum = (r + g + b) / 3
        if lum > lum_max:
            lum_max = lum
    bright_cols.append((x, lum_max))
# piece columns: contiguous run with lum > 120
runs = []
in_run = False
for x, l in bright_cols:
    if l > 120 and not in_run:
        start = x; in_run = True
    elif l <= 120 and in_run:
        runs.append((start, x)); in_run = False
if in_run:
    runs.append((start, bright_cols[-1][0]))
runs = [(a, b) for a, b in runs if b - a > 30]
print('bright column runs (px):', runs)
for a, b in runs:
    mid = (a + b) // 2
    # find vertical extent of the block at column mid
    ys = [y for y in range(band_y0, band_y1)
          if sum(img.getpixel((mid, y))) / 3 > 120]
    if ys:
        print(f'  run x[{a}..{b}] y[{min(ys)}..{max(ys)}] '
              f'center-color={hx(img.getpixel((mid, (min(ys)+max(ys))//2)))}')
