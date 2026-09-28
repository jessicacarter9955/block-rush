#!/usr/bin/env python3
"""Locate the 8x8 grid in the Block Rush screenshot and extract exact cell/block colors."""
from PIL import Image
from collections import Counter

im = Image.open('/tmp/rush-img/img00.png').convert('RGB')
W, H = im.size
px = im.load()

def is_dark_cell(p):
    r, g, b = p
    return 30 <= r <= 70 and g < 25 and 45 <= b <= 80  # ~#2A0139 family

# find rows with many dark-cell pixels (grid bands)
row_hits = []
for y in range(300, 1900, 2):
    n = sum(1 for x in range(0, W, 4) if is_dark_cell(px[x, y]))
    row_hits.append((y, n))
# print bands
best = max(n for _, n in row_hits)
ys = [y for y, n in row_hits if n > best * 0.55]
print('dark rows span:', min(ys), '->', max(ys), 'best', best)

# column profile within that y range
y0, y1 = min(ys), max(ys)
col_hits = []
for x in range(0, W, 2):
    n = sum(1 for y in range(y0, y1, 6) if is_dark_cell(px[x, y]))
    col_hits.append((x, n))
bestc = max(n for _, n in col_hits)
xs = [x for x, n in col_hits if n > bestc * 0.55]
print('dark cols span:', min(xs), '->', max(xs), 'best', bestc)

# grid pitch: 8 cells across cols span
gx0, gx1 = min(xs), max(xs)
gy0, gy1 = min(ys), max(ys)
pitch_x = (gx1 - gx0) / 8
pitch_y = (gy1 - gy0) / 8
print(f'board bbox: x {gx0}..{gx1} y {gy0}..{gy1} pitch {pitch_x:.1f} x {pitch_y:.1f}')

# sample each cell
cells = []
for r in range(8):
    row = []
    for c in range(8):
        cx = int(gx0 + c * pitch_x + pitch_x / 2)
        cy = int(gy0 + r * pitch_y + pitch_y / 2)
        p = px[cx, cy]
        row.append(p)
    cells.append(row)
    print('  row', r, ' '.join('#%02X%02X%02X' % p for p in row))

# filled cell colors -> cluster by hue
filled = [p for row in cells for p in row if not is_dark_cell(p)]
print('\nfilled cells:', len(filled))

# for each filled cell, sample top and bottom of block for the glossy gradient
print('\nglossy gradient samples (top / mid / bottom of a few blocks):')
for r in range(8):
    for c in range(8):
        cx = int(gx0 + c * pitch_x + pitch_x / 2)
        cyt = int(gy0 + r * pitch_y + pitch_x * 0.22)
        cym = int(gy0 + r * pitch_y + pitch_y / 2)
        cyb = int(gy0 + r * pitch_y + pitch_y - pitch_x * 0.22)
        pt, pm, pb = px[cx, cyt], px[cx, cym], px[cx, cyb]
        if not is_dark_cell(pm) and max(pm) > 60:
            print(f'  r{r}c{c}: top #%02X%02X%02X mid #%02X%02X%02X bot #%02X%02X%02X' % (*pt, *pm, *pb))

# seam color: pixel on the border between two dark cells
sx = int(gx0 + pitch_x)  # boundary between col0 and col1
sy = int(gy0 + pitch_y / 2)
print('\nseam candidates (x at col boundary):', '#%02X%02X%02X' % px[sx, sy], '#%02X%02X%02X' % px[sx + 1, sy], '#%02X%02X%02X' % px[sx - 1, sy])

# outer frame color around the board
print('around board:', '#%02X%02X%02X' % px[int(gx0 - 8), int((gy0 + gy1) / 2)], '#%02X%02X%02X' % px[int(gx1 + 8), int((gy0 + gy1) / 2)])
