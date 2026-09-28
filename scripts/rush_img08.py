#!/usr/bin/env python3
"""Probe img08 (Block Rush, blue theme) for exact colors: bg, cells, blocks incl. purple."""
from PIL import Image
from collections import Counter

im = Image.open('/tmp/rush-img/img08.png').convert('RGB')
W, H = im.size
px = im.load()
print('size:', W, H)

def hx(p):
    return '#%02X%02X%02X' % p[:3]

# background: left edge column
print('bg left edge:', ' '.join(hx(px[2, y]) for y in range(0, H, H // 10)))
print('bg right edge:', ' '.join(hx(px[W - 3, y]) for y in range(0, H, H // 10)))

# saturated color families across the whole image
import colorsys
cnt = Counter()
for y in range(0, H, 2):
    for x in range(0, W, 2):
        r, g, b = px[x, y]
        mx, mn = max(r, g, b), min(r, g, b)
        if mx and (mx - mn) / mx > 0.45 and mx / 255 > 0.35:
            cnt[(r // 8 * 8, g // 8 * 8, b // 8 * 8)] += 1

fams = {}
for (r, g, b), n in cnt.most_common(80):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    key = int(h * 360) // 30 * 30
    if key not in fams or n > fams[key][1]:
        fams[key] = (f'#{r:02X}{g:02X}{b:02X}', n)
print('hue families:')
for k in sorted(fams):
    print(f'  hue~{k:3d}: {fams[k][0]} x{fams[k][1]}')

# grid cells: find the dark cell color (dark navy)
cellcnt = Counter()
for y in range(0, H, 3):
    for x in range(0, W, 3):
        r, g, b = px[x, y]
        if max(r, g, b) < 90 and b > r and b >= g:
            cellcnt[(r // 8 * 8, g // 8 * 8, b // 8 * 8)] += 1
print('dark cell candidates:', [(f'#{r:02X}{g:02X}{b:02X}', n) for (r, g, b), n in cellcnt.most_common(6)])
