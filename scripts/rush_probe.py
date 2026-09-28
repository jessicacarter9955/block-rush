#!/usr/bin/env python3
"""Probe img00 (Block Rush screenshot) for exact colors and layout."""
from PIL import Image

im = Image.open('/tmp/rush-img/img00.png').convert('RGB')
W, H = im.size
print(f'size: {W}x{H}')

def hexc(p):
    return '#%02X%02X%02X' % p[:3]

# vertical strip at various x (left edge, center-left, right edge) — background gradient
for x in [3, 10, W // 2 - 400, W - 10]:
    col = [im.getpixel((x, y)) for y in range(0, H, H // 12)]
    print(f'x={x}:', ' '.join(f'{hexc(c)}' for c in col))

# horizontal strip near top (above grid) and near bottom (below grid)
for y in [int(H * 0.08), int(H * 0.12), int(H * 0.16)]:
    row = [im.getpixel((x, y)) for x in range(0, W, W // 12)]
    print(f'y={y}:', ' '.join(f'{hexc(c)}' for c in row))

# find the grid: scan for the dark board region — sample center area colors
cx, cy = W // 2, H // 2
print('center area:')
for dy in range(-6, 7, 2):
    row = [hexc(im.getpixel((cx + dx * 30, cy + dy * 30))) for dx in range(-6, 7, 2)]
    print(f'  cy{dy*30:+}:', ' '.join(row))
