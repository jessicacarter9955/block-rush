#!/usr/bin/env python3
"""Probe colori esatti dal mockup rosso: sfondo, cornice board, celle vuote
(top/bottom per il gradiente), gap griglia, blocchi. Verifica geometria griglia."""
import numpy as np
from PIL import Image

SRC = '/home/z/my-project/upload/pasted_image_1789654565369.png'
im = Image.open(SRC).convert('RGB')
W, H = im.size
a = np.asarray(im).astype(np.int32)

def hexof(px):
    return '#%02X%02X%02X' % tuple(int(round(v)) for v in px)

def probe(x, y, r=4):
    x, y = int(x), int(y)
    return hexof(a[y - r:y + r, x - r:x + r].reshape(-1, 3).mean(axis=0))

print('=== SFONDO (fuori dalla board) ===')
for y in (150, 400, 600, 2100, 2400, 2600):
    print(f'  y={y}:', probe(80, y), probe(W // 2, y, 2), probe(W - 80, y))
print('  sinistra x=30:', probe(30, 1300), ' destra x=1506:', probe(1506, 1300))
print('  centro alto (tra title e board) y=560:', probe(W // 2, 560))
print('  centro basso y=2000:', probe(W // 2, 2000), 'y=2200:', probe(W // 2, 2200))

# board: assumiamo stessa geometria dello screenshot precedente (gy 653..1884, gx 187..1339)
print()
print('=== BOARD (ipotesi geometria precendente gx187-1339 pitch144, gy653-1884 pitch154) ===')
gx0, gx1, gy0, gy1 = 187, 1339, 653, 1884
px, py = (gx1 - gx0) / 8, (gy1 - gy0) / 8
print('  pitch:', px, py)
# cornice: sopra la board (y ~ 620-640) e tra board e bordo
print('  sopra board y=630:', probe(W // 2, 630), 'y=600:', probe(W // 2, 600), 'y=575:', probe(W // 2, 575))
print('  sotto board y=1900:', probe(W // 2, 1900), 'y=1930:', probe(W // 2, 1930))
print('  bordo board interno x=170:', probe(170, 1270), 'x=178:', probe(178, 1270))
print('  dentro board (gap tra celle) y=1270 x=182:', probe(182, 1270))

# trova le celle vuote: le righe 4 (index) sono vuote nel mockup (row 5)
print()
print('=== CELLE VUOTE (riga vuota ~ y=1422) ===')
for i in range(8):
    cx, cy = gx0 + px * (i + 0.5), gy0 + py * (4 + 0.5)
    print(f'  cell({i},4) centro:', probe(cx, cy))

# gradiente dentro una cella vuota: campiona top/mid/bottom della cella (0,4)
cx = gx0 + px * 0.5
for fy, lab in ((0.12, 'top'), (0.3, 'upper'), (0.5, 'mid'), (0.7, 'lower'), (0.88, 'bottom')):
    cy = gy0 + py * (4 + fy)
    print(f'  cella(0,4) {lab}:', probe(cx, cy))

# gap / base griglia tra celle
print('  gap tra celle orizzontale (x=187+144, y=1422):', probe(gx0 + px, gy0 + py * 4.5))
print('  gap verticale (x=259, y=653+154):', probe(gx0 + px * 0.5, gy0 + py * 5))

# blocchi: righe 0-3 e 5-7 col 4-6 occupate
print()
print('=== BLOCCHI (colonne 4-6) ===')
for j in range(8):
    row = []
    for i in (3, 4, 5):
        cx, cy = gx0 + px * (i + 0.5), gy0 + py * (j + 0.5)
        row.append(probe(cx, cy))
    print(f'  riga{j}:', ' '.join(row))

print()
print('=== VASSOIO (pezzo in basso) ===')
for y in (2050, 2100, 2150, 2200):
    print(f'  y={y}:', probe(W // 2 - 250, y), probe(W // 2, y), probe(W // 2 + 250, y))
