#!/usr/bin/env python3
"""FINAL — lattice fit on the 21 board candies inside the VLM bbox, extract
the 7 board colors + the red from the tray. Verifies each tile visually."""
import json
import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

SRC = '/home/z/my-project/upload/pasted_image_1789462065369.png'
OUT = '/home/z/my-project/download/choco-extract'
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert('RGB')
W, H = im.size
a = np.asarray(im).astype(np.int32)

# board region (VLM): x 128-1152, y 576-1792 — with a little margin
BX0, BX1, BY0, BY1 = 140, 1140, 590, 1780

sub = a[BY0:BY1, BX0:BX1]
r, g, b = sub[..., 0], sub[..., 1], sub[..., 2]
sat = sub.max(axis=2) - sub.min(axis=2)
# candies: saturated & warmish or bright; exclude dark blue (B>=R, dark), gold (b low, r&g high, r-b>80)
candy = (sat > 55) & (sub.mean(axis=2) > 45)
gold = (r - b > 70) & (g - b > 30) & (b < 120) & (r > 150)
blue = (b >= r - 5)
candy = candy & ~gold & ~blue

mask = ndimage.binary_erosion(candy, iterations=3)
mask = ndimage.binary_dilation(mask, iterations=3)
lab, n = ndimage.label(mask)

cands = []
for i, sl in enumerate(ndimage.find_objects(lab)):
    h_, w_ = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    if w_ < 35 or h_ < 35 or w_ > 260 or h_ > 260:
        continue
    if abs(w_ - h_) > max(w_, h_) * 0.35:
        continue  # not square-ish
    ys, xs = np.where(lab[sl] == i + 1)
    mean = sub[ys + sl[0].start, xs + sl[1].start].mean(axis=0)
    cands.append({'cx': xs.mean() + sl[1].start, 'cy': ys.mean() + sl[0].start,
                  'w': w_, 'h': h_, 'mean': mean,
                  'sl': (sl[0].start, sl[0].stop, sl[1].start, sl[1].stop)})
print(f'{len(cands)} square candy candidates')

cell = np.median([c['w'] for c in cands] + [c['h'] for c in cands])
print(f'median candy size ~{cell:.0f}px (this is the FULL cell pitch reference)')

# cluster into columns and rows by center
def cluster_axis(vals, tol):
    v = sorted(vals)
    groups = [[v[0]]]
    for x in v[1:]:
        if x - np.mean(groups[-1]) <= tol:
            groups[-1].append(x)
        else:
            groups.append([x])
    return [float(np.mean(g_)) for g_ in groups]

cols = cluster_axis([c['cx'] for c in cands], cell * 0.45)
rows = cluster_axis([c['cy'] for c in cands], cell * 0.45)
print('candy col centers:', [f'{v:.0f}' for v in cols])
print('candy row centers:', [f'{v:.0f}' for v in rows])

# fit pitch: candies are contiguous in columns 4-6 (1-based) → pitch = median gap
pitch_x = np.median(np.diff(cols)) if len(cols) > 1 else cell
pitch_y = np.median(np.diff(rows)) if len(rows) > 1 else cell
print(f'pitch x={pitch_x:.1f} y={pitch_y:.1f}')

# absolute grid: candies occupy 3 adjacent columns (4,5,6 of 8) → extrapolate
ax_cols = [c['cx'] + BX0 for c in cands]
ax_rows = [c['cy'] + BY0 for c in cands]
colc = sorted(cluster_axis(ax_cols, pitch_x * 0.45))
rowc = sorted(cluster_axis(ax_rows, pitch_y * 0.45))
print('ABS col centers:', [f'{v:.0f}' for v in colc])
print('ABS row centers:', [f'{v:.0f}' for v in rowc])
# the candy columns are board columns 4-6 (indices 3,4,5) → col index of first = 3
if len(colc) < 2 or len(rowc) < 2:
    raise SystemExit(f'cluster fail: {len(colc)} cols, {len(rowc)} rows')
first_col_idx = 3
gx = [colc[0] - (first_col_idx + 0.5) * pitch_x + k * pitch_x for k in range(9)]  # left edges
first_row_idx = 0  # top block starts at row 1
gy = [rowc[0] - (first_row_idx + 0.5) * pitch_y + k * pitch_y for k in range(9)]
# sanity: grid must cover a plausible board — clamp within image
if gx[0] < 0 or gx[8] > W or gy[0] < 0 or gy[8] > H:
    print(f'WARNING grid out of bounds: x {gx[0]:.0f}..{gx[8]:.0f} y {gy[0]:.0f}..{gy[8]:.0f}')
    # try: derive from bbox instead — the board region dark area
    # keep going but clamp sampling below


print('grid x left-edges:', [f'{v:.0f}' for v in gx])
print('grid y top-edges :', [f'{v:.0f}' for v in gy])

# ---------------------------------------------------- sample the 64 cells --
def sample_cell(i, j):
    x0, x1 = gx[i], gx[i] + pitch_x
    y0, y1 = gy[j] + 0, gy[j] + pitch_y
    x0, x1 = max(0, int(x0)), min(W, int(x1))
    y0, y1 = max(0, int(y0)), min(H, int(y1))
    pw, ph = int((x1 - x0) * 0.3), int((y1 - y0) * 0.3)
    if x1 - x0 <= 2 * pw or y1 - y0 <= 2 * ph:
        return np.array([0.0, 0.0, 255.0])  # out of image → treat as empty blue
    patch = a[y0 + ph:y1 - ph, x0 + pw:x1 - pw]
    return patch.reshape(-1, 3).mean(axis=0)

samples = np.array([sample_cell(i, j) for j in range(8) for i in range(8)])
occupied = np.array([not (m[2] >= m[0] - 8 and m[0] < 115) for m in samples])
print('occupied grid:')
for j in range(8):
    print(' ', ''.join('#' if occupied[j * 8 + i] else '.' for i in range(8)))

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
print(f'{len(clusters)} board colors')

# --------------------------------------------------- tray red extraction ---
TRAY_Y0, TRAY_Y1 = 1850, 2230
tray = a[TRAY_Y0:TRAY_Y1]
tr_, tg_, tb_ = tray[..., 0], tray[..., 1], tray[..., 2]
tsat = tray.max(axis=2) - tray.min(axis=2)
tcand = (tsat > 55) & (tray.mean(axis=2) > 45) & ~((tr_ - tb_ > 70) & (tg_ - tb_ > 30) & (tb_ < 120) & (tr_ > 150)) & ~(tb_ >= tr_ - 5)
tmask = ndimage.binary_erosion(tcand, iterations=3)
tmask = ndimage.binary_dilation(tmask, iterations=3)
tlab, tn = ndimage.label(tmask)
tray_tiles = []
for i, sl in enumerate(ndimage.find_objects(tlab)):
    h_, w_ = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    if w_ < 40 or h_ < 40 or w_ > 300 or h_ > 300 or abs(w_ - h_) > max(w_, h_) * 0.4:
        continue
    ys, xs = np.where(tlab[sl] == i + 1)
    mean = tray[ys + sl[0].start, xs + sl[1].start].mean(axis=0)
    tray_tiles.append({'mean': mean, 'box': (sl[1].start, sl[0].start + TRAY_Y0,
                                             sl[1].stop, sl[0].stop + TRAY_Y0)})
print(f'tray tiles: {len(tray_tiles)}')

# match tray tiles to board colors
new_colors = []
for t in tray_tiles:
    if not any(np.linalg.norm(t['mean'] - c['center']) < 70 for c in clusters):
        # exclude near-empty (dark blue slots caught by noise)
        if t['mean'][2] >= t['mean'][0] - 5:
            continue
        new_colors.append(t)

# ------------------------------------------------------------- extraction ---
NAMES = ['rosa', 'giallo', 'verde', 'latte', 'arancio', 'fondente', 'menta',
         'rosso', 'limone', 'pralina', 'mora', 'nocciola']
report = {'grid': {'pitch_x': round(float(pitch_x), 1), 'pitch_y': round(float(pitch_y), 1),
                   'x_left_edges': [round(float(v), 1) for v in gx],
                   'y_top_edges': [round(float(v), 1) for v in gy]},
          'colors': [], 'source': 'pasted_image_1789462065369.png'}

def crop_cell(i, j, inset_frac=0.045):
    x0 = gx[i] + pitch_x * inset_frac
    x1 = gx[i + 1] - pitch_x * inset_frac
    y0 = gy[j] + pitch_y * inset_frac
    y1 = gy[j + 1] - pitch_y * inset_frac
    return im.crop((int(x0), int(y0), int(x1), int(y1)))

entries = []
for ci, c in enumerate(clusters):
    # prefer a candy far from grid borders (less risk of misalignment)
    best = min(c['members'], key=lambda i: np.linalg.norm(samples[i] - c['center']))
    j, i = divmod(best, 8)
    entries.append({'center': c['center'], 'count': len(c['members']),
                    'crop': crop_cell(i, j), 'origin': f'board ({i},{j})', 'best': best})

for t in new_colors:
    x0, y0, x1, y1 = t['box']
    pad = int(min(x1 - x0, y1 - y0) * 0.06)
    entries.append({'center': t['mean'], 'count': 0,
                    'crop': im.crop((x0 + pad, y0 + pad, x1 - pad, y1 - pad)),
                    'origin': 'tray', 'best': None})

for ci, e in enumerate(entries):
    mean = e['center']
    hexc = '#%02X%02X%02X' % tuple(int(round(v)) for v in mean)
    tile = e['crop']
    tarr = np.asarray(tile).reshape(-1, 3).mean(axis=0)
    name = NAMES[ci] if ci < len(NAMES) else f'col{ci}'
    fname = f'choco-{ci}-{name}.png'
    tile.save(os.path.join(OUT, fname))
    print(f'  [{ci}] mean={hexc} crop=#%02X%02X%02X size={tile.size} {e["origin"]} -> {fname}'
          % (int(tarr[0]), int(tarr[1]), int(tarr[2])))
    report['colors'].append({'idx': ci, 'hex': hexc, 'file': fname,
                             'origin': e['origin'],
                             'crop_hex': '#%02X%02X%02X' % (int(tarr[0]), int(tarr[1]), int(tarr[2])),
                             'size': list(tile.size)})

# --------------------------------------------------------------- preview ---
pv = im.copy()
dr = ImageDraw.Draw(pv)
for k in range(9):
    dr.line([(gx[k], gy[0]), (gx[k], gy[8])], fill=(0, 255, 255), width=4)
    dr.line([(gx[0], gy[k]), (gx[8], gy[k])], fill=(0, 255, 255), width=4)
for ci, e in enumerate(entries):
    if e['best'] is not None:
        j, i = divmod(e['best'], 8)
        dr.text((gx[i] + 8, gy[j] + 6), str(ci), fill=(255, 255, 0))
pv.resize((W // 2, H // 2)).save(os.path.join(OUT, 'preview-grid.png'))
with open(os.path.join(OUT, 'report.json'), 'w') as f:
    json.dump(report, f, indent=2)
print(f'\n{len(entries)} tiles extracted → {OUT}')
