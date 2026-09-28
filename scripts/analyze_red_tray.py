#!/usr/bin/env python3
"""Analisi pezzo rosso nel vassoio: dove sta il dito, quale quadrato e' pulito."""
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = '/home/z/my-project/upload/pasted_image_1789462065369.png'
OUT = '/home/z/my-project/download/choco-extract'
im = Image.open(SRC).convert('RGB')
W, H = im.size
a = np.asarray(im).astype(np.int32)

# --- ritrova il pezzo rosso nel vassoio (stesso algoritmo v4) ---
TRAY_Y0, TRAY_Y1 = 1850, 2230
tray = a[TRAY_Y0:TRAY_Y1]
tr, tg, tb = tray[..., 0], tray[..., 1], tray[..., 2]
tsat = tray.max(axis=2) - tray.min(axis=2)
tcand = (tsat > 55) & (tray.mean(axis=2) > 45) & ~((tr - tb > 70) & (tg - tb > 30) & (tb < 120)) & ~(tb >= tr - 5)
tmask = ndimage.binary_closing(tcand, iterations=4)
tlab, tn = ndimage.label(tmask)
cands = []
for i, sl in enumerate(ndimage.find_objects(tlab)):
    h_, w_ = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    if 80 < w_ < 600 and 60 < h_ < 300 and w_ > h_ * 1.5:
        ys, xs = np.where(tlab[sl] == i + 1)
        mean = tray[ys + sl[0].start, xs + sl[1].start].mean(axis=0)
        if mean[2] >= mean[0] - 5:
            continue
        cands.append({'box': (sl[1].start, sl[0].start + TRAY_Y0, sl[1].stop, sl[0].stop + TRAY_Y0),
                      'mean': mean, 'area': w_ * h_})
        print(f'cand box={cands[-1]["box"]} mean=#%02X%02X%02X area={w_*h_}' % tuple(int(v) for v in mean))

if not cands:
    raise SystemExit('nessun pezzo nel vassoio')
best = max(cands, key=lambda c: c['area'])
x0, y0, x1, y1 = best['box']
print(f'\npezzo rosso scelto: x {x0}-{x1}  y {y0}-{y1}  ({x1-x0}x{y1-y0})')

# --- salva il vassoio intero per ispezione ---
im.crop((0, TRAY_Y0, W, TRAY_Y1)).save(f'{OUT}/debug-tray-region.png')

# --- dividi in 3 quadrati e misura "dito" (pelle: chiaro, R>G>B, saturazione media) ---
pw = (x1 - x0) / 3
for k in range(3):
    sx0, sx1 = int(x0 + k * pw), int(x0 + (k + 1) * pw)
    sq = a[y0:y1, sx0:sx1]
    r_, g_, b_ = sq[..., 0], sq[..., 1], sq[..., 2]
    skin = (r_ > 120) & (r_ > g_ + 25) & (g_ > b_ + 8) & (r_ - b_ > 60)
    frac_skin = skin.mean()
    # rosso caramella: R alto ma B molto basso e scuro -> distingui dal dito (chiaro)
    bright = sq.mean(axis=2) > 150
    print('quadrato %d: x %d-%d  skin=%.1f%%  bright=%.1f%%  mean=#%02X%02X%02X'
          % (k, sx0, sx1, frac_skin * 100, bright.mean() * 100,
             int(sq[..., 0].mean()), int(sq[..., 1].mean()), int(sq[..., 2].mean())))
    im.crop((sx0, y0, sx1, y1)).save(f'{OUT}/debug-red-sq{k}.png')
    # istogramma colonna del skin mask: dove sta il dito in orizzontale/verticale
    if frac_skin > 0.02:
        cols = skin.mean(axis=0)
        rows_ = skin.mean(axis=1)
        print(f'   skin per col (10 bucket): ' + ' '.join(f'{v*100:.0f}' for v in np.array_split(cols, 10)))
        print(f'   skin per row (10 bucket): ' + ' '.join(f'{v*100:.0f}' for v in np.array_split(rows_, 10)))
