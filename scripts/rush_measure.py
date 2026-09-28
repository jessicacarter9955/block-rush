#!/usr/bin/env python3
"""Measure the REAL Block Rush block geometry from the screenshot:
corner radius + exact gradient profile, and crop a reference block."""
from PIL import Image

im = Image.open('/tmp/rush-img/img00.png').convert('RGB')
px = im.load()

# Grid: x 72..1098, y 502..1528, pitch 128.25
P = 128.25
X0, Y0 = 72, 502

def cell_tl(r, c):
    return int(X0 + c * P), int(Y0 + r * P)

# The green run at row0 col4..7 — top edge of the block at r0c4
# measure: for each y from top, the x where green starts (left edge of block)
def is_green(p):
    r, g, b = p
    return g > 120 and r < 90 and b < 90

tx, ty = cell_tl(0, 4)
print('block r0c4 top-left at', tx, ty)
# find the leftmost green x for each y in the first 40 px of the block
for dy in range(0, 46, 3):
    y = ty + dy
    xs = [x for x in range(tx - 6, tx + 40) if is_green(px[x, y])]
    if xs:
        print(f'  y+{dy:2d}: green starts at x={min(xs)} (offset from cell left: {min(xs) - tx})')
    else:
        print(f'  y+{dy:2d}: no green in scan window')

# measure the gap between adjacent blocks in a run (r0: c4..c7 all green)
# find green column boundaries
row_y = ty + 64  # middle of the block
runs = []
in_g = False
for x in range(tx - 10, tx + int(4 * P) + 10):
    g = is_green(px[x, row_y])
    if g and not in_g:
        start = x; in_g = True
    elif not g and in_g:
        runs.append((start, x - 1)); in_g = False
print('green runs at mid-height:', runs)
print('pitch check: cell width', P, '-> block width', [b - a + 1 for a, b in runs])

# gradient profile at block center column (avg over central 20px)
bx = tx + 64
print('\ngradient profile r0c4 (every 6px):')
prev = None
for dy in range(0, 129, 6):
    y = ty + dy
    rs = [px[bx + dx, y] for dx in range(-10, 11, 5)]
    avg = tuple(sum(v[i] for v in rs) // len(rs) for i in range(3))
    print('  %3d: #%02X%02X%02X' % (dy, *avg))

# crop the green block for reference
im.crop((tx - 4, ty - 4, tx + int(P) + 4, ty + int(P) + 4)).save('/tmp/rush-img/block-green.png')
# crop an orange block r1c5
tx2, ty2 = cell_tl(1, 5)
im.crop((tx2 - 4, ty2 - 4, tx2 + int(P) + 4, ty2 + int(P) + 4)).save('/tmp/rush-img/block-orange.png')
# crop 2x2 empty cells
im.crop((cell_tl(4, 2)[0], cell_tl(4, 2)[1], cell_tl(6, 4)[0], cell_tl(6, 4)[1])).save('/tmp/rush-img/cells-empty.png')
print('\ncrops saved')
