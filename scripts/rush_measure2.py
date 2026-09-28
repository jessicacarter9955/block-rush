#!/usr/bin/env python3
"""Measure Block Rush block geometry — corrected grid mapping."""
from PIL import Image

im = Image.open('/tmp/rush-img/img00.png').convert('RGB')
W, H = im.size
px = im.load()
P = 128.25
X0, Y0 = 72, 502

def is_green(p):
    r, g, b = p
    return g > 110 and r < 90 and b < 90

def is_orange(p):
    r, g, b = p
    return 160 < r < 220 and 90 < g < 150 and b < 60

# --- green block r0c1: top edge + left edge corner trace
tx, ty = int(X0 + 1 * P), Y0
print('green block r0c1 tl:', tx, ty)
for dy in range(0, 50, 4):
    y = ty + dy
    xs = [x for x in range(tx - 8, tx + 50) if is_green(px[x, y])]
    print(f'  y+{dy:2d}: green from x offset {min(xs) - tx if xs else None}')

# block width at mid height
y_mid = ty + 64
runs = []
in_g = False
for x in range(tx - 12, tx + int(P) + 20):
    g = is_green(px[x, y_mid])
    if g and not in_g:
        start = x; in_g = True
    elif not g and in_g:
        runs.append((start, x - 1)); in_g = False
if in_g: runs.append((start, tx + int(P) + 19))
print('runs at mid:', runs, 'widths:', [b - a + 1 for a, b in runs])

# vertical profile at block center col (avg ±10px)
bx = tx + 64
print('gradient profile green:')
for dy in range(0, 129, 6):
    y = ty + dy
    rs = [px[bx + dx, y] for dx in range(-10, 11, 5)]
    avg = tuple(sum(v[i] for v in rs) // len(rs) for i in range(3))
    print('  %3d: #%02X%02X%02X' % (dy, *avg))

# horizontal profile at mid height (left→right)
print('horizontal profile green (mid):')
for dx in range(0, 129, 8):
    x = tx + dx
    rs = [px[x, ty + 64 + dy] for dy in range(-10, 11, 5)]
    avg = tuple(sum(v[i] for v in rs) // len(rs) for i in range(3))
    print('  %3d: #%02X%02X%02X' % (dx, *avg))

# orange block r1c0 vertical profile
tx2, ty2 = int(X0), int(Y0 + P)
bx2 = tx2 + 64
print('gradient profile orange r1c0:')
for dy in range(0, 129, 6):
    y = ty2 + dy
    rs = [px[bx2 + dx, y] for dx in range(-10, 11, 5)]
    avg = tuple(sum(v[i] for v in rs) // len(rs) for i in range(3))
    print('  %3d: #%02X%02X%02X' % (dy, *avg))

# crops for reference
im.crop((tx - 6, ty - 6, tx + int(P) + 6, ty + int(P) + 6)).save('/tmp/rush-img/block-green.png')
im.crop((tx2 - 6, ty2 - 6, tx2 + int(P) + 6, ty2 + int(P) + 6)).save('/tmp/rush-img/block-orange.png')
im.crop((int(X0 + 4 * P), int(Y0 + 4 * P), int(X0 + 6 * P), int(Y0 + 6 * P))).save('/tmp/rush-img/cells-empty.png')
print('crops saved')
