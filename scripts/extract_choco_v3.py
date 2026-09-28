#!/usr/bin/env python3
"""v3 — refine the grid inside the VLM-located bbox (x 128-1152, y 576-1792),
sample all 64 cells, extract distinct color tiles + scan the tray below
for extra colors. Tiles are cropped tight on the candy silhouette."""
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

BX0, BX1, BY0, BY1 = 128, 1152, 576, 1792

# --- refine edges: within the bbox, find the dark-cell area --------------
sub = a[BY0:BY1, BX0:BX1]
r, g, b = sub[..., 0], sub[..., 1], sub[..., 2]
# empty cells / separators are dark & bluish: B >= R
darkish = (b >= r - 5) & (sub.mean(axis=2) < 110)

colfrac = darkish.mean(axis=0)  # per column inside bbox
rowfrac = darkish.mean(axis=1)

def largest_band(frac, thr=0.55):
    idx = np.where(frac > thr)[0]
    return idx.min(), idx.max()

cx0, cx1 = largest_band(colfrac)
cy0, cy1 = largest_band(rowfrac)
print(f'refined dark region inside bbox: cols {cx0}-{cx1} rows {cy0}-{cy1}')

cx0, cx1, cy0, cy1 = int(cx0), int(cx1), int(cy0), int(cy1)
side_x = cx1 - cx0
side_y = cy1 - cy0
side = (side_x + side_y) // 2
print(f'side ~{side}')

# exact cell boundaries: analyze darkness minima (separator lines) —
# project the DARK channel: separators are darkest rows/cols.
gray = sub.mean(axis=2)
dark = (gray < 70).astype(np.float32)
colp = dark[cy0:cy1, cx0:cx1].mean(axis=0)
rowp = dark[cy0:cy1, cx0:cx1].mean(axis=1)

cell = side / 8
xb, yb = [0], [0]
for k in range(1, 8):
    exp = k * side / 8
    lo, hi = int(exp - cell * 0.2), int(exp + cell * 0.2)
    xb.append(lo + int(np.argmax(colp[lo:hi])))
    yb.append(lo + int(np.argmax(rowp[lo:hi])))
xb.append(side)
yb.append(side)
# shift to absolute coords
xbA = [int(BX0 + cx0 + v) for v in xb]
ybA = [int(BY0 + cy0 + v) for v in yb]
print('x edges:', xbA)
print('y edges:', ybA)
print('cell sizes x:', [xbA[i+1]-xbA[i] for i in range(8)])
print('cell sizes y:', [ybA[i+1]-ybA[i] for i in range(8)])

# --- sample all 64 cells ---------------------------------------------------
def cell_center_patch(i, j, frac=0.3):
    x0, x1 = xbA[i], xbA[i + 1]
    y0, y1 = ybA[j], yb[j + 1] if False else (ybA[j], ybA[j + 1])
    pw, ph = int((x1 - x0) * frac), int((y1 - y0) * frac)
    return a[int(y0 + ph):int(y1 - ph), int(x0 + pw):int(x1 - pw)]

samples = []
for j in range(8):
    for i in range(8):
        x0, x1 = xbA[i], xbA[i + 1]
        y0, y1 = ybA[j], ybA[j + 1]
        pw, ph = int((x1 - x0) * 0.3), int((y1 - y0) * 0.3)
        patch = a[int(y0 + ph):int(y1 - ph), int(x0 + pw):int(x1 - pw)]
        samples.append(patch.reshape(-1, 3).mean(axis=0))
samples = np.array(samples)

# occupied = not bluish-dark
occupied = np.array([not (m[2] >= m[0] - 8 and m[0] < 115) for m in samples])
grid_occ = occupied.reshape(8, 8)
print('occupied grid:')
for row in grid_occ.astype(int):
    print(' ', ''.join('#' if v else '.' for v in row))

# --- cluster colors ---------------------------------------------------------
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
print(f'\n{len(clusters)} distinct colors on the board')

# --- also scan the TRAY area below the board for extra colors -------------
TRAY_Y0, TRAY_Y1 = BY1 + 40, min(H, BY1 + 420)
tray = a[TRAY_Y0:TRAY_Y1]
tr_, tg_, tb_ = tray[..., 0], tray[..., 1], tray[..., 2]
tmx = tray.max(axis=2)
tsat = tmx - tray.min(axis=2)
tcolored = (tsat > 70) & (tmx > 80) & ~((tr_ - tb_ > 80) & (tg_ - tb_ > 40) & (tb_ < 110))  # no gold
from scipy import ndimage
tmask = ndimage.binary_erosion(tcolored, iterations=4)
tmask = ndimage.binary_dilation(tmask, iterations=4)
tlab, tn = ndimage.label(tmask)
tray_colors = []
for i, sl in enumerate(ndimage.find_objects(tlab)):
    h_, w_ = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    if w_ < 30 or h_ < 30 or w_ > 300 or h_ > 300:
        continue
    ys, xs = np.where(tlab[sl] == i + 1)
    mean = tray[ys + sl[0].start, xs + sl[1].start].mean(axis=0)
    tray_colors.append((mean, sl))
print(f'tray: {len(tray_colors)} tile candidates')

# match tray colors against board clusters
for mean, sl in tray_colors:
    if any(np.linalg.norm(mean - c['center']) < 70 for c in clusters):
        continue
    # new color found in tray → add as cluster with best crop from tray
    print('  new color in tray:', '#%02X%02X%02X' % tuple(int(v) for v in mean))
    clusters.append({'center': mean, 'members': [], 'tray_sl': (sl, TRAY_Y0)})

# --- extract crops ----------------------------------------------------------
NAMES = ['lampone', 'limone', 'lime', 'fondente', 'arancio', 'menta', 'pralina',
         'caramello', 'latte', 'pistacchio', 'mora', 'nocciola']
report = {'grid': {'x_edges': [int(v) for v in xbA], 'y_edges': [int(v) for v in ybA], 'cell': round(float(cell), 1)}, 'colors': []}
tiles = []
for ci, c in enumerate(clusters):
    if c['members']:
        best = min(c['members'], key=lambda i: np.linalg.norm(samples[i] - c['center']))
        j, i = divmod(best, 8)
        x0, x1 = xbA[i], xbA[i + 1]
        y0, y1 = ybA[j], ybA[j + 1]
        inset = (x1 - x0) * 0.06
        tile = im.crop((int(x0 + inset), int(y0 + inset), int(x1 - inset), int(y1 - inset)))
        origin = f'board cell ({i},{j})'
    else:
        sl, offy = c['tray_sl']
        pad = 2
        tile = im.crop((sl[1].start + pad, sl[0].start + offy + pad,
                        sl[1].stop - pad, sl[0].stop + offy - pad))
        origin = 'tray'
    hexc = '#%02X%02X%02X' % tuple(int(round(v)) for v in c['center'])
    tarr = np.asarray(tile).reshape(-1, 3).mean(axis=0)
    name = NAMES[ci] if ci < len(NAMES) else f'col{ci}'
    fname = f'tile-{ci}-{name}.png'
    tile.save(os.path.join(OUT, fname))
    tiles.append((fname, tile.size))
    print(f'  [{ci}] {hexc} n={len(c["members"])} crop=#%02X%02X%02X %s -> %s' %
          (int(tarr[0]), int(tarr[1]), int(tarr[2]), origin, fname))
    report['colors'].append({'idx': ci, 'hex': hexc, 'count': int(len(c['members'])),
                             'file': fname, 'origin': origin,
                             'crop_hex': '#%02X%02X%02X' % (int(tarr[0]), int(tarr[1]), int(tarr[2]))})

# --- preview ----------------------------------------------------------------
pv = im.copy()
dr = ImageDraw.Draw(pv)
for i in range(9):
    dr.line([(xbA[i], ybA[0]), (xbA[i], ybA[8])], fill=(0, 255, 255), width=4)
    dr.line([(xbA[0], ybA[i]), (xbA[8], ybA[i])], fill=(0, 255, 255), width=4)
for idx in range(64):
    j, i = divmod(idx, 8)
    ci = next((k for k, c in enumerate(clusters) if idx in c['members']), None)
    if ci is not None:
        dr.text((xbA[i] + 10, ybA[j] + 10), str(ci), fill=(255, 255, 0))
pv = pv.resize((W // 2, H // 2))
pv.save(os.path.join(OUT, 'preview-grid.png'))
with open(os.path.join(OUT, 'report.json'), 'w') as f:
    json.dump(report, f, indent=2)
print('\nsaved:', ', '.join(t[0] for t in tiles))
