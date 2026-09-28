#!/usr/bin/env python3
"""Detect the real cell grid in the reference: seams via dark-run scanning."""
from PIL import Image

SRC = 'upload/pasted_image_1789654565369.png'
img = Image.open(SRC).convert('RGB')
W, H = img.size
sx, sy = W / 1080, H / 1920

def dark_runs(vals, thresh=42, min_len=2):
    runs = []
    start = None
    for i, v in enumerate(vals):
        d = v < thresh
        if d and start is None:
            start = i
        elif not d and start is not None:
            if i - start >= min_len:
                runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, len(vals)))
    return runs

# --- vertical seams: scan a row inside the grid ---
for y_d in (600, 700, 900, 1100):
    ypx = int(y_d * sy)
    vals = [sum(img.getpixel((x, ypx))) / 3 for x in range(0, W, 1)]
    runs = dark_runs(vals)
    # design coords, merge close
    centers = [((a + b) / 2) / sx for a, b in runs if (b - a) / sx > 1.5]
    print(f'y={y_d}: dark-run centers (design x):', [f'{c:.0f}' for c in centers])

# --- horizontal seams: scan a column ---
for x_d in (540, 350, 700):
    xpx = int(x_d * sx)
    vals = [sum(img.getpixel((xpx, y))) / 3 for y in range(0, H, 1)]
    runs = dark_runs(vals)
    centers = [((a + b) / 2) / sy for a, b in runs if (b - a) / sy > 1.5]
    print(f'x={x_d}: dark-run centers (design y):', [f'{c:.0f}' for c in centers])
