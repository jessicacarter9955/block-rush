#!/usr/bin/env python3
"""Candy theme asset pipeline — from the reference screenshot.

Produces (public/textures/candy/):
  bg-{theme}.jpg     1080x1920 clean background (reconstructed + theme recolor)
  cell-{theme}.png   256x256 empty-cell tile (alpha corners, theme recolor)
  tray-{theme}.png   512x512 composed tray holder (theme palette)
Plus:
  public/textures/choco-shot-7.png  -> replaced with the CLEAN red tile
  download/ref-analysis/*           diagnostics + previews
"""
from PIL import Image, ImageDraw, ImageFilter
import os, math, random

SRC = 'upload/pasted_image_1789654565369.png'
OUT_TEX = 'public/textures/candy'
OUT_DIA = 'download/ref-analysis'
os.makedirs(OUT_TEX, exist_ok=True)
os.makedirs(OUT_DIA, exist_ok=True)

img = Image.open(SRC).convert('RGB')
W, H = img.size
sx, sy = W / 1080, H / 1920

def rect_design(dx, dy, dw, dh):
    return (int(dx * sx), int(dy * sy), int(dx + dw) * sx, int(dy + dh) * sy)

def crop_design(dx, dy, dw, dh):
    x0, y0, x1, y1 = rect_design(dx, dy, dw, dh)
    return img.crop((int(x0), int(y0), int(x1), int(y1)))

# ============================================================ 1. red tile ===
# Clean left block of the tray piece: approx design x 362-478, y 1548-1672.
region = crop_design(355, 1542, 130, 134)
rw, rh = region.size
px = region.load()

# flood fill "background" from borders through dark pixels
from collections import deque
BG = bytearray(rw * rh)
q = deque()
def is_bg(p):
    r, g, b = p
    return (r + g + b) / 3 < 95
for x in range(rw):
    for y in (0, rh - 1):
        if is_bg(px[x, y]) and not BG[y * rw + x]:
            BG[y * rw + x] = 1; q.append((x, y))
for y in range(rh):
    for x in (0, rw - 1):
        if is_bg(px[x, y]) and not BG[y * rw + x]:
            BG[y * rw + x] = 1; q.append((x, y))
while q:
    x, y = q.popleft()
    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < rw and 0 <= ny < rh and not BG[ny * rw + nx] and is_bg(px[nx, ny]):
            BG[ny * rw + nx] = 1; q.append((nx, ny))

mask = Image.new('L', (rw, rh), 0)
mask.putdata([0 if BG[i] else 255 for i in range(rw * rh)])
# bbox of the block
bbox = mask.getbbox()
print('red block bbox in region:', bbox, 'region size:', (rw, rh))
block = Image.new('RGBA', (rw, rh))
block.paste(region, (0, 0), mask)
block = block.crop(bbox)
# pad to square + resize 256
bw, bh = block.size
m = max(bw, bh)
sq = Image.new('RGBA', (m, m), (0, 0, 0, 0))
sq.paste(block, ((m - bw) // 2, (m - bh) // 2))
tile256 = sq.resize((256, 256), Image.LANCZOS)
# measure avg color (opaque pixels only)
opaque = tile256.crop().convert('RGB')
rs = gs = bs = n = 0
mp = tile256.load()
for yy in range(40, 216, 4):
    for xx in range(40, 216, 4):
        if mp[xx, yy][3] > 200:
            r, g, b = mp[xx, yy][:3]
            rs += r; gs += g; bs += b; n += 1
avg = (rs // n, gs // n, bs // n)
print(f'red tile avg color: #{avg[0]:02X}{avg[1]:02X}{avg[2]:02X} (n={n})')
tile256.save('public/textures/choco-shot-7.png')
tile256.save(f'{OUT_DIA}/red-tile-clean.png')

# ====================================================== 2. board geometry ===
# detect the bright red board frame: scan column x=540 for bright red rows
def lum(p): return (p[0] + p[1] + p[2]) / 3
col_x = int(540 * sx)
frame_rows = [y for y in range(int(0.15 * H), int(0.75 * H))
              if img.getpixel((col_x, y))[0] > 150 and img.getpixel((col_x, y))[1] < 70]
top_frame = min(frame_rows) if frame_rows else None
# bottom edge: dark shadow row after the board
print('frame top candidates px:', top_frame, '-> design y', top_frame / sy if top_frame else None)

# scan a horizontal line in the middle of the board for the frame columns
mid_y = int(830 * sy)
frame_cols = [x for x in range(0, W)
              if img.getpixel((x, mid_y))[0] > 150 and img.getpixel((x, mid_y))[1] < 70]
print('first/last bright-red col at y=830:', min(frame_cols), max(frame_cols),
      '-> design', min(frame_cols) / sx, max(frame_cols) / sx)

# board frame bounds estimate from bright red extent
bx0 = min(frame_cols) / sx; bx1 = max(frame_cols) / sx
by0 = top_frame / sy
# find bottom: from by0, board is square
BS = bx1 - bx0
by1 = by0 + BS
print(f'board est: x {bx0:.0f}..{bx1:.0f}  y {by0:.0f}..{by1:.0f}  size {BS:.0f}')

# grid the cells and find the emptiest (dark + uniform)
pitch = BS / 8
best = None
stats = []
for r in range(8):
    for c in range(8):
        cx0 = int((bx0 + c * pitch + pitch * 0.3) * sx)
        cy0 = int((by0 + r * pitch + pitch * 0.3) * sy)
        cx1 = int((bx0 + c * pitch + pitch * 0.7) * sx)
        cy1 = int((by0 + r * pitch + pitch * 0.7) * sy)
        vals = [img.getpixel((x, y))
                for x in range(cx0, cx1, 3) for y in range(cy0, cy1, 3)]
        lums = [lum(v) for v in vals]
        mean = sum(lums) / len(lums)
        var = sum((l - mean) ** 2 for l in lums) / len(lums)
        mr = sum(v[0] for v in vals) // len(vals)
        mg = sum(v[1] for v in vals) // len(vals)
        mb = sum(v[2] for v in vals) // len(vals)
        stats.append((r, c, mean, var ** 0.5, f'#{mr:02X}{mg:02X}{mb:02X}'))
stats.sort(key=lambda s: (s[2] + s[3]))
print('emptiest cells (r,c,meanLum,std,avgColor):')
for s in stats[:8]:
    print('  ', s)
