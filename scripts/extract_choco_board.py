#!/usr/bin/env python3
"""Detect the 8x8 board in the pasted screenshot, sample occupied cells,
cluster distinct tile colors, and crop one clean tile per color.

Outputs to /home/z/my-project/download/choco-extract/:
  - report.json          (grid geometry + colors)
  - tile-<i>-<name>.png  (one crop per distinct color, upscaled x2 for clarity)
  - preview-grid.png     (board crop with detected grid overlay + numbered clusters)
"""
import json
import os
from collections import Counter

import numpy as np
from PIL import Image, ImageDraw

SRC = '/home/z/my-project/upload/pasted_image_1789462065369.png'
OUT = '/home/z/my-project/download/choco-extract'
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert('RGB')
W, H = im.size
a = np.asarray(im).astype(np.int32)
print(f'image {W}x{H}')

# ---------------------------------------------------------------- board ----
# The board is the big square of dark-blue slots. Find the largest square
# region whose pixels are "dark blue" (B明显大于R和G, 低亮度).
r, g, b = a[..., 0], a[..., 1], a[..., 2]
dark_blue = (b > r + 20) & (b > g + 20) & (b < 160) & (r < 110)

# column/row profiles of dark-blue density
colp = dark_blue.sum(axis=0)
rowp = dark_blue.sum(axis=1)

def span(profile, frac):
    thr = profile.max() * frac
    idx = np.where(profile > thr)[0]
    return idx.min(), idx.max()

x0, x1 = span(colp, 0.25)
y0, y1 = span(rowp, 0.25)
print(f'board bbox ~ ({x0},{y0})-({x1},{y1})  {x1-x0}x{y1-y0}')

# square it up: the board is square — take the tighter/wider compromise
side = (x1 - x0 + y1 - y0) // 2
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
bx0, by0 = cx - side // 2, cy - side // 2
print(f'square board: ({bx0},{by0}) side={side}')

# ---------------------------------------------------------------- grid -----
# 8x8. Detect exact cell edges inside the board via dark-blue line minima.
sub = dark_blue[by0:by0 + side, bx0:bx0 + side]
colsum = sub.sum(axis=0)  # per-column count of dark-blue pixels
rowsum = sub.sum(axis=1)

# grid lines are columns/rows where dark blue is maximal (separator lines)
# cells are separated by dark frame lines; find 9 boundaries per axis.
# Strategy: cells are ~side/8 wide. Look for local maxima of darkness near
# the expected positions k*side/8.
def boundaries(profile, n_cells):
    s = len(profile)
    bounds = [0]
    for k in range(1, n_cells):
        exp = int(round(k * s / n_cells))
        lo, hi = max(0, exp - s // 40), min(s, exp + s // 40)
        seg = profile[lo:hi]
        bounds.append(lo + int(np.argmax(seg)))
    bounds.append(s)
    return bounds

xb = boundaries(colsum, 8)
yb = boundaries(rowsum, 8)
print('x bounds:', xb)
print('y bounds:', yb)

cells = []  # (x0,x1,y0,y1)
for j in range(8):
    for i in range(8):
        cells.append((xb[i], xb[i + 1], yb[j], yb[j + 1]))

# ------------------------------------------------------------- sampling ----
# For each cell sample the center patch (25% of the cell) and compute mean
# color; empty cells are dark blue (the slot), occupied are the candies.
EMPTY = None
samples = []
for (cx0, cx1, cy0, cy1) in cells:
    pw, ph = max(2, (cx1 - cx0) // 4), max(2, (cy1 - cy0) // 4)
    mx0, mx1 = cx0 + pw, cx1 - pw
    my0, my1 = cy0 + ph, cy1 - ph
    patch = a[by0 + my0:by0 + my1, bx0 + mx0:bx0 + mx1]
    mean = patch.reshape(-1, 3).mean(axis=0)
    samples.append(mean)

samples = np.array(samples)

def is_empty(m):
    return (m[2] > m[0] + 15) and (m[2] > m[1] + 15) and (m[2] < 170) and (m[0] < 120)

occupied = np.array([not is_empty(m) for m in samples])
print(f'occupied cells: {occupied.sum()}/64')

# cluster occupied mean-colors with a simple threshold greedy clustering
CLUSTER_T = 60  # euclidean distance in RGB
clusters = []  # list of {center, members:[cell_idx]}
for idx in np.where(occupied)[0]:
    m = samples[idx]
    placed = False
    for c in clusters:
        if np.linalg.norm(m - c['center']) < CLUSTER_T:
            c['members'].append(idx)
            c['center'] = samples[c['members']].mean(axis=0)
            placed = True
            break
    if not placed:
        clusters.append({'center': m.copy(), 'members': [idx]})

clusters.sort(key=lambda c: -len(c['members']))
print(f'\n{len(clusters)} distinct tile colors:')
report = {'grid': {'bx0': int(bx0), 'by0': int(by0), 'side': int(side),
                   'xb': [int(v) for v in xb], 'yb': [int(v) for v in yb]},
          'colors': []}

NAMES = ['rosso', 'giallo', 'verde', 'marrone', 'arancio', 'blu', 'viola', 'ciano',
         'rosa', 'nero', 'latte', 'menta']

for ci, c in enumerate(clusters[:10]):
    mean = c['center']
    hexc = '#%02X%02X%02X' % tuple(int(round(v)) for v in mean)
    # pick the best member: closest to the cluster center
    best = min(c['members'], key=lambda i: np.linalg.norm(samples[i] - mean))
    # crop that cell with a small inset to avoid separator lines
    cx0, cx1, cy0, cy1 = cells[best]
    inset = max(2, int((cx1 - cx0) * 0.06))
    tile = im.crop((bx0 + cx0 + inset, by0 + cy0 + inset,
                    bx0 + cx1 - inset, by0 + cy1 - inset))
    # verify crop color (crop mean should be close to sample mean)
    tarr = np.asarray(tile).reshape(-1, 3).mean(axis=0)
    name = NAMES[ci] if ci < len(NAMES) else f'col{ci}'
    fname = f'tile-{ci}-{name}.png'
    # upscale x2 with NEAREST for crisp pixels
    tile2 = tile.resize((tile.width * 2, tile.height * 2), Image.NEAREST)
    tile2.save(os.path.join(OUT, fname))
    print(f'  [{ci}] {hexc}  n={len(c["members"]):2d}  crop_mean=#%02X%02X%02X  {fname}' %
          (int(tarr[0]), int(tarr[1]), int(tarr[2])))
    report['colors'].append({'idx': ci, 'hex': hexc, 'count': len(c['members']),
                             'file': fname, 'crop_hex': '#%02X%02X%02X' % (int(tarr[0]), int(tarr[1]), int(tarr[2]))})

# ------------------------------------------------------------ preview ------
pv = im.crop((bx0, by0, bx0 + side, by0 + side)).copy()
dr = ImageDraw.Draw(pv)
for i in range(9):
    dr.line([(xb[i], 0), (xb[i], side)], fill=(0, 255, 255), width=3)
    dr.line([(0, yb[i]), (side, yb[i])], fill=(0, 255, 255), width=3)
for ci, c in enumerate(clusters[:10]):
    for m in c['members'][:]:
        cx0, cx1, cy0, cy1 = cells[m]
        dr.text(((cx0 + cx1) // 2 - 8, (cy0 + cy1) // 2 - 10), str(ci), fill=(255, 255, 0))
pv.save(os.path.join(OUT, 'preview-grid.png'))
print(f'\npreview -> {OUT}/preview-grid.png')

with open(os.path.join(OUT, 'report.json'), 'w') as f:
    json.dump(report, f, indent=2)
print('report -> report.json')
