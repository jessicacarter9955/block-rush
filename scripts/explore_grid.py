#!/usr/bin/env python3
"""Find the board via structural analysis: the grid has periodic cell structure,
the background doesn't. Use local variance + periodicity."""
import numpy as np
from PIL import Image

im = Image.open('/home/z/my-project/upload/pasted_image_1789462065369.png').convert('RGB')
W, H = im.size
a = np.asarray(im).astype(np.float32)
gray = a.mean(axis=2)

# local gradient magnitude
gx = np.abs(np.diff(gray, axis=1))  # W-1 wide
gy = np.abs(np.diff(gray, axis=0))  # H-1 tall

# row activity: mean gradient along the row
row_act = gx.mean(axis=1)  # len H
col_act = gy.mean(axis=0)  # len W-1

def bands(profile, thr_mult=1.3, min_len=100):
    """contiguous bands above threshold"""
    thr = profile.mean() * thr_mult
    out = []
    in_b = False
    for i, v in enumerate(profile):
        if v > thr and not in_b:
            s = i; in_b = True
        elif v <= thr and in_b:
            if i - s > min_len: out.append((s, i))
            in_b = False
    if in_b and len(profile) - s > min_len: out.append((s, len(profile)))
    return out

rb = bands(row_act)
cb = bands(col_act)
print('active row bands:', rb)
print('active col bands:', cb)

# The board should be the tall square band; the tray below is another band.
for (s, e) in rb:
    print(f'rows {s}-{e}: height={e-s}')
for (s, e) in cb:
    print(f'cols {s}-{e}: width={e-s}')

# Focus: pick the band pair that forms a square in the middle
# Then check periodicity inside: autocorrelation of column activity
if rb and cb:
    # try the middle-large row band and col band
    rs, re = max(rb, key=lambda be: be[1]-be[0])
    cs, ce = max(cb, key=lambda be: be[1]-be[0])
    seg = col_act[cs:ce]
    seg = seg - seg.mean()
    ac = np.correlate(seg, seg, 'full')[len(seg)-1:]
    ac /= ac[0]
    # find first strong peak after lag ~ (ce-cs)/16
    side = ce - cs
    cell = side / 8
    peaks = [(lag, ac[lag]) for lag in range(int(cell*0.6), int(cell*1.6)) if ac[lag] > 0.25]
    print(f'\ncandidate board: rows {rs}-{re}, cols {cs}-{ce}, side~{side}, expected cell~{cell:.0f}px')
    print('autocorr peaks near cell size:', peaks[:5])
