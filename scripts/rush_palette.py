#!/usr/bin/env python3
"""Extract the full block color palette from the Block Rush screenshot."""
from PIL import Image
from collections import Counter

im = Image.open('/tmp/rush-img/img00.png').convert('RGB')
W, H = im.size
# scan the board+tray area for saturated colors
cnt = Counter()
for y in range(400, 2200, 3):
    for x in range(0, W, 3):
        r, g, b = im.getpixel((x, y))
        mx, mn = max(r, g, b), min(r, g, b)
        sat = (mx - mn) / mx if mx else 0
        val = mx / 255
        if sat > 0.45 and val > 0.35:
            # quantize to 24-level bins
            cnt[(r // 16 * 16, g // 16 * 16, b // 16 * 16)] += 1

print('top saturated color bins (quantized hex, count):')
for (r, g, b), n in cnt.most_common(24):
    print(f'  #{r:02X}{g:02X}{b:02X}  x{n}')

# cluster into hue families
import colorsys
fams = {}
for (r, g, b), n in cnt.most_common(60):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    deg = int(h * 360)
    key = (deg // 30) * 30
    if key not in fams or n > fams[key][1]:
        fams[key] = (f'#{r:02X}{g:02X}{b:02X}', n, deg)
print('\nhue families (30deg bins, dominant color):')
for k in sorted(fams):
    c, n, deg = fams[k]
    print(f'  hue~{deg:3d}: {c}  x{n}')
