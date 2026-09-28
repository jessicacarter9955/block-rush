#!/usr/bin/env python3
"""Analyze red-cell.png HSV distribution to calibrate the glossy recolor algorithm."""
import colorsys
from collections import Counter
from PIL import Image

im = Image.open('/home/z/my-project/public/textures/red-cell.png').convert('RGB')
w, h = im.size
px = im.load()

hues = Counter()
vmin, vmax = 1.0, 0.0
sat_lo, sat_hi = 1.0, 0.0
samples = []
for y in range(0, h, 2):
    for x in range(0, w, 2):
        r, g, b = px[x, y]
        hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        vmin = min(vmin, vv); vmax = max(vmax, vv)
        sat_lo = min(sat_lo, ss); sat_hi = max(sat_hi, ss)
        if ss > 0.25:
            hues[round(hh * 360)] += 1
        samples.append((x, y, hh * 360, ss, vv))

print(f'size {w}x{h}')
print(f'V range: {vmin:.3f} .. {vmax:.3f}')
print(f'S range (all px): {sat_lo:.3f} .. {sat_hi:.3f}')
print('top hues (S>0.25):')
for hue, cnt in hues.most_common(12):
    print(f'  H={hue:3d}  n={cnt}')

# key pixels
for label, (x, y) in {
    'corner(2,2)': (2, 2), 'corner(20,20)': (20, 20),
    'center(128,128)': (128, 128), 'top-left bevel(30,12)': (30, 12),
    'body(60,128)': (60, 128), 'body2(190,180)': (190, 180),
    'bottom-right(220,230)': (220, 230),
}.items():
    r, g, b = px[x, y]
    hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    print(f'{label:22s} rgb=({r:3d},{g:3d},{b:3d}) #{r:02X}{g:02X}{b:02X}  H={hh*360:5.1f} S={ss:.2f} V={vv:.2f}')
