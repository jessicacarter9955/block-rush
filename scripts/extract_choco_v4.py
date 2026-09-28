#!/usr/bin/env python3
"""v4 — block-bbox approach: contiguous candy groups merge into one component;
the top 3x4 block bbox directly yields pitch (w/3, h/4) and grid origin.
Then sample 64 cells, cluster colors, crop tiles + tray red."""
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

BY0, BY1 = 590, 1790  # board vertical range (VLM)

sub = a[BY0:BY1]
r, g, b = sub[..., 0], sub[..., 1], sub[..., 2]
sat = sub.max(axis=2) - sub.min(axis=2)
candy = (sat > 55) & (sub.mean(axis=2) > 45)
gold = (r - b > 70) & (g - b > 30) & (b < 120) & (r > 150)
blue = (b >= r - 5)
candy &= ~gold & ~blue

mask = ndimage.binary_closing(candy, iterations=4)
lab, n = ndimage.label(mask)
print(f'{n} components')

rows = []
for i, sl in enumerate(ndimage.find_objects(lab)):
    h_, w_ = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    # accept candy row-bands: 1-3 candies wide, 1-3 rows tall (pitch ~130-160)
    if w_ < 130 or h_ < 130 or w_ > 560 or h_ > 560:
        continue
    ys, xs = np.where(lab[sl] == i + 1)
    mean = sub[ys + sl[0].start, xs + sl[1].start].mean(axis=0)
    if mean[2] >= mean[0] - 5:
        continue
    rows.append({'x0': sl[1].start, 'x1': sl[1].stop,
                 'y0': sl[0].start + BY0, 'y1': sl[0].stop + BY0,
                 'w': w_, 'h': h_, 'mean': mean})
    print(f'row-band: x {sl[1].start}-{sl[1].stop} y {sl[0].start + BY0}-{sl[0].stop + BY0} '
          f'({w_}x{h_}) mean=#%02X%02X%02X' % tuple(int(v) for v in mean))

if not rows:
    raise SystemExit('no candy rows found')

# estimate single-cell pitch from band heights/widths
import statistics
pitches = []
for rb in rows:
    for n in (1, 2, 3):
        for m in (1, 2, 3):
            if abs(rb['w'] / n - rb['h'] / m) < 12:
                pitches.append((rb['w'] / n + rb['h'] / m) / 2)
pitch0 = statistics.median(pitches) if pitches else 145
print(f'single-cell pitch estimate ~{pitch0:.1f}')

# rows of the strip: split each band into its constituent rows by height
def band_rows(rb):
    return max(1, round(rb['h'] / pitch0))

row_tops = []  # (y_top_of_row, row_index_global)
row0_top = min(rb['y0'] for rb in rows)
for rb in sorted(rows, key=lambda r_: r_['y0']):
    nr = band_rows(rb)
    for k in range(nr):
        row_tops.append(rb['y0'] + k * (rb['h'] / nr))
# cluster row tops → unique rows
def uniq(vals, tol):
    v = sorted(vals)
    out = [[v[0]]]
    for x in v[1:]:
        if x - out[-1][-1] <= tol:
            out[-1].append(x)
        else:
            out.append([x])
    return [float(np.mean(g_)) for g_ in out]
row_tops_u = uniq(row_tops, pitch0 * 0.5)
print('unique row tops:', [f'{v:.0f}' for v in row_tops_u])

# pitch_y from consecutive row gaps + anchored extremes
if len(row_tops_u) >= 2:
    gaps = np.diff(row_tops_u)
    # rows may skip one (empty row 5): gaps ~pitch or ~2*pitch
    pitch_y = np.median([g_ / round(g_ / pitch0) for g_ in gaps])
else:
    pitch_y = pitch0
# anchor: first row top = gy[0]
gy = [row_tops_u[0] + k * pitch_y for k in range(9)]

# pitch_x: bands are 3 candies wide (432px) — use the widest band's span / count
widths = [rb['x1'] - rb['x0'] for rb in rows]
# x0 of the strip: most common left edge
x0s = [rb['x0'] for rb in rows]
strip_x0 = statistics.median(x0s)
# how many candies per band? round(width/pitch0)
ncols_band = [max(1, round(w_ / pitch0)) for w_ in widths]
# full strip = 3 columns (VLM: cols 4-6) → use bands with 3 cols
three = [rb for rb, nc in zip(rows, ncols_band) if nc == 3]
if three:
    strip_x0 = min(rb['x0'] for rb in three)
    strip_x1 = max(rb['x1'] for rb in three)
    pitch_x = (strip_x1 - strip_x0) / 3
else:
    pitch_x = pitch0

# grid: strip starts at column index 3 (cols 4-6 of 8)
gx = [strip_x0 - 3 * pitch_x + k * pitch_x for k in range(9)]
print(f'pitch: x={pitch_x:.1f} y={pitch_y:.1f}')
print('gx:', [f'{v:.0f}' for v in gx])
print('gy:', [f'{v:.0f}' for v in gy])

# ------------------------------------------------ sample all 64 cells -------
def sample_cell(i, j, frac=0.18):
    x0 = max(0, int(gx[i])); x1 = min(W, int(gx[i + 1]))
    y0 = max(0, int(gy[j])); y1 = min(H, int(gy[j + 1]))
    pw, ph = int((x1 - x0) * frac), int((y1 - y0) * frac)
    if x1 - x0 <= 2 * pw or y1 - y0 <= 2 * ph:
        return np.array([0, 0, 255.0])
    patch = a[y0 + ph:y1 - ph, x0 + pw:x1 - pw]
    return patch.reshape(-1, 3).mean(axis=0)

samples = np.array([sample_cell(i, j) for j in range(8) for i in range(8)])
# empty slot = bluish AND dark (teal candies are bluish but BRIGHT)
occupied = np.array([not (m[2] >= m[0] - 8 and m.max() < 110) for m in samples])
print('cell colors (hex):')
for j in range(8):
    print('  row%d:' % j, ' '.join('#%02X%02X%02X' % tuple(int(v) for v in samples[j*8+i]) if occupied[j*8+i] else '  ----  ' for i in range(8)))
print('occupied:')
for j in range(8):
    print(' ', ''.join('#' if occupied[j * 8 + i] else '.' for i in range(8)))

CLUSTER_T = 28  # separates the two browns (#4D1902 vs #3A1302)
clusters = []
for idx in np.where(occupied)[0]:
    m = samples[idx]
    for c in clusters:
        if np.linalg.norm(m - c['center']) < CLUSTER_T:
            c['members'].append(idx); c['center'] = samples[c['members']].mean(axis=0)
            break
    else:
        clusters.append({'center': m.copy(), 'members': [idx]})
clusters.sort(key=lambda c: -len(c['members']))
print(f'{len(clusters)} board colors')

# ------------------------------------------------------- tray red piece ----
TRAY_Y0, TRAY_Y1 = 1850, 2230
tray = a[TRAY_Y0:TRAY_Y1]
tr_, tg_, tb_ = tray[..., 0], tray[..., 1], tray[..., 2]
tsat = tray.max(axis=2) - tray.min(axis=2)
tcand = (tsat > 55) & (tray.mean(axis=2) > 45) & ~((tr_ - tb_ > 70) & (tg_ - tb_ > 30) & (tb_ < 120)) & ~(tb_ >= tr_ - 5)
tmask = ndimage.binary_closing(tcand, iterations=4)
tlab, tn = ndimage.label(tmask)
tray_tile = None
best_area = 0
for i, sl in enumerate(ndimage.find_objects(tlab)):
    h_, w_ = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    if w_ * h_ > best_area and 80 < w_ < 600 and 60 < h_ < 300 and w_ > h_ * 1.5:
        ys, xs = np.where(tlab[sl] == i + 1)
        mean = tray[ys + sl[0].start, xs + sl[1].start].mean(axis=0)
        if mean[2] >= mean[0] - 5:
            continue
        best_area = w_ * h_
        tray_tile = {'mean': mean, 'box': (sl[1].start, sl[0].start + TRAY_Y0,
                                           sl[1].stop, sl[0].stop + TRAY_Y0)}
if tray_tile:
    print('tray piece found: mean=#%02X%02X%02X' % tuple(int(v) for v in tray_tile['mean']))
    if not any(np.linalg.norm(tray_tile['mean'] - c['center']) < 70 for c in clusters):
        print('  → NEW color (red) in tray')
    else:
        tray_tile = None  # duplicate of a board color
else:
    print('no new tray color (matches board)')

# ---------------------------------------------------------- extraction -----
NAMES = ['rosa', 'giallo', 'verde', 'latte', 'arancio', 'fondente', 'menta', 'rosso',
         'limone', 'pralina', 'mora', 'nocciola']
entries = []
for c in clusters:
    best = min(c['members'], key=lambda i: np.linalg.norm(samples[i] - c['center']))
    j, i = divmod(best, 8)
    entries.append({'center': c['center'], 'count': len(c['members']), 'cell': (i, j)})
if tray_tile:
    entries.append({'center': tray_tile['mean'], 'count': 0, 'tray': tray_tile['box']})

report = {'grid': {'pitch_x': round(float(pitch_x), 1), 'pitch_y': round(float(pitch_y), 1),
                   'gx': [round(float(v), 1) for v in gx], 'gy': [round(float(v), 1) for v in gy]},
          'colors': []}

for ci, e in enumerate(entries):
    mean = e['center']
    hexc = '#%02X%02X%02X' % tuple(int(round(v)) for v in mean)
    if 'cell' in e:
        i, j = e['cell']
        inset = 0.05
        tile = im.crop((int(gx[i] + pitch_x * inset), int(gy[j] + pitch_y * inset),
                        int(gx[i + 1] - pitch_x * inset), int(gy[j + 1] - pitch_y * inset)))
        origin = f'board ({i},{j})'
    else:
        x0, y0, x1, y1 = e['tray']
        pw_ = (x1 - x0) / 3  # 3 squares in a row
        pad = pw_ * 0.07
        tile = im.crop((int(x0 + pw_ + pad), int(y0 + pad), int(x0 + 2 * pw_ - pad), int(y1 - pad)))
        origin = 'tray'
    tarr = np.asarray(tile).reshape(-1, 3).mean(axis=0)
    name = NAMES[ci] if ci < len(NAMES) else f'col{ci}'
    fname = f'choco-{ci}-{name}.png'
    tile.save(os.path.join(OUT, fname))
    print(f'  [{ci}] mean={hexc} crop=#%02X%02X%02X {tile.size} {origin} -> {fname}'
          % (int(tarr[0]), int(tarr[1]), int(tarr[2])))
    report['colors'].append({'idx': ci, 'hex': hexc, 'file': fname, 'origin': origin,
                             'crop_hex': '#%02X%02X%02X' % (int(tarr[0]), int(tarr[1]), int(tarr[2])),
                             'size': list(tile.size), 'count': int(e['count'])})

# ------------------------------------------------------------- preview -----
pv = im.copy()
dr = ImageDraw.Draw(pv)
for k in range(9):
    dr.line([(gx[k], gy[0]), (gx[k], gy[8])], fill=(0, 255, 255), width=4)
    dr.line([(gx[0], gy[k]), (gx[8], gy[k])], fill=(0, 255, 255), width=4)
for ci, e in enumerate(entries):
    if 'cell' in e:
        i, j = e['cell']
        dr.text((gx[i] + 8, gy[j] + 6), str(ci), fill=(255, 255, 0))
pv.resize((W // 2, H // 2)).save(os.path.join(OUT, 'preview-grid.png'))
with open(os.path.join(OUT, 'report.json'), 'w') as f:
    json.dump(report, f, indent=2)
print(f'\n{len(entries)} tiles -> {OUT}')
