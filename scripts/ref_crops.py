#!/usr/bin/env python3
"""Crop key areas of the reference image for VLM analysis + asset extraction."""
from PIL import Image, ImageFilter
import os

SRC = 'upload/pasted_image_1789654565369.png'
OUT = 'download/ref-analysis'
os.makedirs(OUT, exist_ok=True)

img = Image.open(SRC).convert('RGB')
W, H = img.size  # 1536x2730
sx, sy = W / 1080, H / 1920

def crop_design(dx, dy, dw, dh, name, scale=2):
    """Crop design-space rect and optionally upscale."""
    x0, y0 = int(dx * sx), int(dy * sy)
    x1, y1 = int((dx + dw) * sx), int((dy + dh) * sy)
    c = img.crop((x0, y0, x1, y1))
    if scale != 1:
        c = c.resize((c.width * scale, c.height * scale), Image.LANCZOS)
    c.save(f'{OUT}/{name}.png')
    print(f'{name}: design({dx},{dy},{dw},{dh}) -> px({x0},{y0},{x1},{y1}) size={c.size}')

# Full screenshot downscaled for context
img.resize((W // 3, H // 3), Image.LANCZOS).save(f'{OUT}/full-small.png')

# Icon row (bottom, y 1685-1855, all 3 icons with gaps)
crop_design(60, 1660, 960, 220, 'icon-row', 2)
# Single icon button (icon1 @ 175,1770 170x170)
crop_design(90, 1685, 340, 220, 'icon1-zoom', 3)
# Icon2
crop_design(455, 1685, 340, 220, 'icon2-zoom', 3)
# Icon3
crop_design(821, 1685, 340, 220, 'icon3-zoom', 3)
# Tray full row (y 1490-1760)
crop_design(60, 1490, 960, 270, 'tray-row', 2)
# Board top-left corner (frame + cells)
crop_design(30, 320, 340, 340, 'board-corner', 3)
# Board center cells
crop_design(420, 730, 240, 240, 'board-cells', 3)
# Top area (logo/score zone)
crop_design(0, 0, 1080, 400, 'top-zone', 1)
# Background strip left of board
crop_design(0, 400, 45, 900, 'bg-left-strip', 1)
# Piece in tray closeup (3 blocks pink, middle has finger)
crop_design(100, 1500, 750, 270, 'tray-piece', 2)
# Blocks on board closeup
crop_design(60, 340, 500, 400, 'board-blocks', 2)

print('done')
