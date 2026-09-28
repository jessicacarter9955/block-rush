#!/usr/bin/env python3
"""Explore the screenshot structure: find gold frame + board via color segmentation."""
import numpy as np
from PIL import Image

im = Image.open('/home/z/my-project/upload/pasted_image_1789462065369.png').convert('RGB')
W, H = im.size
a = np.asarray(im).astype(np.int32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]

# gold: warm, high R and G, B notably lower
gold = (r > 140) & (g > 100) & (b < 140) & (r - b > 60) & (abs(r - g) < 80)
print(f'gold pixels: {gold.sum()} ({gold.mean()*100:.2f}%)')

# print row bands where gold density is high
rowp = gold.sum(axis=1)
bands = []
in_band = False
for y in range(H):
    if rowp[y] > W * 0.15 and not in_band:
        start = y; in_band = True
    elif rowp[y] <= W * 0.15 and in_band:
        bands.append((start, y)); in_band = False
if in_band: bands.append((start, H))
print('gold row bands (y0,y1):', [(s, e) for s, e in bands if e - s > 8])

# for the middle band (board frame?), find gold col extents
if bands:
    mid = bands[len(bands) // 2] if len(bands) >= 2 else bands[0]
    # actually pick the tallest band
    tall = max(bands, key=lambda be: be[1] - be[0])
    print('tallest gold band:', tall)
    seg = gold[tall[0]:tall[1]]
    colp = seg.sum(axis=0)
    cols = np.where(colp > (tall[1] - tall[0]) * 0.3)[0]
    if len(cols):
        print('gold cols in band:', cols.min(), cols.max())

# Also dump a coarse color map (24 cols x 42 rows) to see the layout
small = im.resize((24, 42))
sa = np.asarray(small)
def sym(px):
    R, G, B = int(px[0]), int(px[1]), int(px[2])
    if R > 200 and G > 160 and B < 130: return 'G'  # gold
    if B > R + 20 and B > G + 20:
        if B > 180: return 'B'  # bright blue
        return 'b'  # dark blue
    if R > 150 and G > 80 and B < 90: return 'O'  # orange/brown
    if R > 150 and G < 100: return 'R'  # red/pink
    if G > 150 and R < 160: return 'V'  # green
    if R > 180 and G > 180 and B > 120: return 'Y'  # yellow
    if R > 200 and G > 200 and B > 200: return 'W'  # white
    return '.'
print('\ncoarse map (24x42):')
for row in sa:
    print(''.join(sym(px) for px in row))
