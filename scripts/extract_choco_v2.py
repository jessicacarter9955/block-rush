#!/usr/bin/env python3
"""v2 — find the 8x8 grid by locating saturated colored tiles (the chocolate
squares), fitting a lattice to their centers, then sampling all 64 cells.

Outputs in /home/z/my-project/download/choco-extract/:
  report.json, tile-*.png, preview-grid.png
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw

SRC = '/home/z/my-project/upload/pasted_image_1789462065369.png'
OUT = '/home/z/my-project/download/choco-extract'
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert('RGB')
W, H = im.size
a = np.asarray(im).astype(np.int32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mx = a.max(axis=2)
mn = a.min(axis=2)
sat = mx - mn

# saturated, mid-bright pixels = colored tiles (exclude gold frame: gold is
# r~230 g~180 b~60 → also saturated; exclude dark blue slots: low sat)
colored = (sat > 60) & (mx > 70)

# remove small noise via morphological-ish erosion using a 5x5 min filter
from scipy import ndimage
mask = ndimage.binary_erosion(colored, iterations=3)
mask = ndimage.binary_dilation(mask, iterations=3)

lab, n = ndimage.label(mask)
print(f'{n} raw components')
boxes = ndimage.find_objects(lab)
centers = []
sizes = []
for i, sl in enumerate(boxes):
    h = sl[0].stop - sl[0].start
    w = sl[1].stop - sl[1].start
    if w < 20 or h < 20 or w > 400 or h > 400:
        continue
    # mean color of component
    ys, xs = np.where(lab[sl] == i + 1)
    ys = ys + sl[0].start
    xs = xs + sl[1].start
    mean = a[ys, xs].mean(axis=0)
    # exclude gold frame (r-b>60, g-b>40, b low) and blue
    R, G, B = mean
    if B > R or (R - B > 80 and G - B > 40 and B < 110):
        continue  # gold / blue → skip
    centers.append(((xs.mean() + sl[1].start - sl[1].start), (ys.mean()), w, h))
    centers[-1] = (float(xs.mean()), float(ys.mean()), int(w), int(h))
    sizes.append((w, h))

print(f'{len(centers)} colored tile candidates')
ws = [s[0] for s in sizes]
hs = [s[1] for s in sizes]
cell_guess = float(np.median(ws + hs))
print(f'median tile size ~{cell_guess:.0f}px')

cx = np.array([c[0] for c in centers])
cy = np.array([c[1] for c in centers])

# lattice fit: cluster center-x values (tiles in the same column share x)
def cluster_1d(vals, tol):
    v = np.sort(vals)
    groups = [[v[0]]]
    for x in v[1:]:
        if x - groups[-1][-1] <= tol:
            groups[-1].append(x)
        else:
            groups.append([x])
    return [float(np.mean(g)) for g in groups if len(g) >= 1]

xs_cols = cluster_1d(cx, cell_guess * 0.4)
ys_rows = cluster_1d(cy, cell_guess * 0.4)
print('column x centers:', [f'{v:.0f}' for v in xs_cols])
print('row y centers:', [f'{v:.0f}' for v in ys_rows])

# grid step = median gap between consecutive centers
def step(centers):
    if len(centers) < 2:
        return None
    gaps = np.diff(centers)
    return float(np.median(gaps))

sx = step(xs_cols)
sy = step(ys_rows)
print(f'step x ~{sx:.1f}, step y ~{sy:.1f}')

# extrapolate to 8 columns / 8 rows (some may be empty → missing anchors)
# find best contiguous 8-run around the detected centers
def to_edges(centers, step):
    # edges from centers: cell edges at c ± step/2
    lo = min(centers) - step / 2
    idx0 = round((min(centers) - lo) / step)
    n_before = idx0
    n_after = 7 - (len(centers) - 1 - idx0)
    e0 = lo - n_before * step
    return [e0 + k * step for k in range(9)]

if len(xs_cols) >= 4 and sx and sy:
    xb = to_edges(xs_cols, sx)
    yb = to_edges(ys_rows, sy)
else:
    raise SystemExit('not enough anchors')

print('x edges:', [f'{v:.0f}' for v in xb])
print('y edges:', [f'{v:.0f}' for v in yb])

# ------------------------------------------------------------ sample cells --
samples = []
for j in range(8):
    for i in range(8):
        x0, x1 = xb[i], xb[i + 1]
        y0, y1 = yb[j], yb[j + 1]
        pw, ph = int((x1 - x0) * 0.3), int((y1 - y0) * 0.3)
        patch = a[int(y0 + ph):int(y1 - ph), int(x0 + pw):int(x1 - pw)]
        samples.append(patch.reshape(-1, 3).mean(axis=0))
samples = np.array(samples)

def is_empty(m):
    R, G, B = m
    return (B >= R - 10) and (B > 100 or (R < 80 and G < 80)) or (sat_patch_empty(m))

def sat_patch_empty(m):
    return abs(m[2] - m[0]) > 15 and m[0] < 100

# simpler: a cell is EMPTY if bluish (B >= R) and darkish
occupied = np.array([not (m[2] >= m[0] - 5 and m[0] < 110) for m in samples])
print(f'occupied: {occupied.sum()}/64')

# cluster occupied colors
CLUSTER_T = 55
clusters = []
for idx in np.where(occupied)[0]:
    m = samples[idx]
    for c in clusters:
        if np.linalg.norm(m - c['center']) < CLUSTER_T:
            c['members'].append(idx)
            c['center'] = samples[c['members']].mean(axis=0)
            break
    else:
        clusters.append({'center': m.copy(), 'members': [idx]})
clusters.sort(key=lambda c: -len(c['members']))
print(f'{len(clusters)} distinct colors')

NAMES = ['lampone', 'limone', 'lime', 'fondente', 'arancio', 'menta', 'pralina', 'caramello',
         'latte', 'pistacchio']
report = {'grid': {'xb': [round(v, 1) for v in xb], 'yb': [round(v, 1) for v in yb],
                   'cell_x': round(sx, 1), 'cell_y': round(sy, 1)}, 'colors': []}

for ci, c in enumerate(clusters[:10]):
    mean = c['center']
    hexc = '#%02X%02X%02X' % tuple(int(round(v)) for v in mean)
    best = min(c['members'], key=lambda i: np.linalg.norm(samples[i] - mean))
    j, i = divmod(best, 8)
    x0, x1 = xb[i], xb[i + 1]
    y0, y1 = yb[j], yb[j + 1]
    inset = (x1 - x0) * 0.05
    tile = im.crop((int(x0 + inset), int(y0 + inset), int(x1 - inset), int(y1 - inset)))
    tarr = np.asarray(tile).reshape(-1, 3).mean(axis=0)
    name = NAMES[ci] if ci < len(NAMES) else f'col{ci}'
    fname = f'tile-{ci}-{name}.png'
    tile.save(os.path.join(OUT, fname))
    print(f'  [{ci}] {hexc}  n={len(c["members"]):2d}  crop=#%02X%02X%02X  cell=({i},{j})  {fname}'
          % (int(tarr[0]), int(tarr[1]), int(tarr[2])))
    report['colors'].append({'idx': ci, 'hex': hexc, 'count': len(c['members']),
                             'file': fname, 'cell': [int(i), int(j)],
                             'crop_hex': '#%02X%02X%02X' % (int(tarr[0]), int(tarr[1]), int(tarr[2]))})

# preview with grid overlay
pv = im.copy()
dr = ImageDraw.Draw(pv)
for i in range(9):
    dr.line([(xb[i], yb[0]), (xb[i], yb[8])], fill=(0, 255, 255), width=4)
    dr.line([(xb[0], yb[i]), (xb[8], yb[i])], fill=(0, 255, 255), width=4)
# label cells
for j in range(8):
    for i in range(8):
        idx = j * 8 + i
        ci = next((k for k, c in enumerate(clusters) if idx in c['members']), None)
        if ci is not None and ci < 10:
            dr.text((xb[i] + 8, yb[j] + 8), str(ci), fill=(255, 255, 0))
pv = pv.resize((W // 2, H // 2))
pv.save(os.path.join(OUT, 'preview-grid.png'))
with open(os.path.join(OUT, 'report.json'), 'w') as f:
    json.dump(report, f, indent=2)
print('saved preview + report')
