#!/usr/bin/env python3
"""Candy assets part 2: empty-cell tile, clean bg, tray tiles, theme variants."""
from PIL import Image, ImageDraw, ImageFilter
import os, random

SRC = 'upload/pasted_image_1789654565369.png'
OUT_TEX = 'public/textures/candy'
OUT_DIA = 'download/ref-analysis'
os.makedirs(OUT_TEX, exist_ok=True)
os.makedirs(OUT_DIA, exist_ok=True)

img = Image.open(SRC).convert('RGB')
W, H = img.size
sx, sy = W / 1080, H / 1920

def crop_design(dx, dy, dw, dh):
    return img.crop((int(dx * sx), int(dy * sy), int(dx * sx + dw * sx), int(dy * sy + dh * sy)))

# ====================================================== 3. empty cell tile ===
# r0c6 cell: design x 790-915, y 331-456 (full pitch square incl. seams)
cell_full = crop_design(788, 329, 127, 127)  # +2px safety
cell_full.save(f'{OUT_DIA}/cell-raw.png')
cell_big = cell_full.resize((512, 512), Image.LANCZOS)
cell_big.save(f'{OUT_DIA}/cell-raw-512.png')

# probe the cell structure (is the rounded cell visible? seams dark?)
print('cell raw size:', cell_full.size)
for yy in range(0, 127, 15):
    row = []
    for xx in range(0, 127, 15):
        r, g, b = cell_full.getpixel((min(xx, cell_full.width-1), min(yy, cell_full.height-1)))
        row.append(f'{r:02X}{g:02X}{b:02X}')
    print('  ', ' '.join(row))

# ============================================================= 4. clean bg ===
# Keep: side strips (x<42, x>1040) + top band (y<70). Fill center with g(y)+noise.
print('\n--- building clean bg ---')
# per-row bg estimate from strips (design x 8..36 and x 1042..1052)
def row_bg(y_design):
    ypx = min(int(y_design * sy), H - 1)
    left = [img.getpixel((x, ypx)) for x in range(int(8 * sx), int(36 * sx), 2)]
    right = [img.getpixel((x, ypx)) for x in range(int(1042 * sx), int(1053 * sx), 2)]
    pts = left + right
    return tuple(sum(p[i] for p in pts) // len(pts) for i in range(3))

rows = [row_bg(y) for y in range(0, 1920, 4)]
# smooth
smooth = []
K = 9
for i in range(len(rows)):
    win = rows[max(0, i - K):i + K + 1]
    smooth.append(tuple(sum(w[j] for w in win) // len(win) for j in range(3)))

# noise estimation from clean strip patches
patch = [img.getpixel((x, y)) for x in range(int(10 * sx), int(34 * sx), 2)
         for y in range(int(500 * sy), int(700 * sy), 3)]
import statistics
noise_r = statistics.pstdev([p[0] for p in patch])
noise_g = statistics.pstdev([p[1] for p in patch])
noise_b = statistics.pstdev([p[2] for p in patch])
print(f'noise stdev rgb: {noise_r:.1f} {noise_g:.1f} {noise_b:.1f}')

bg = Image.new('RGB', (1080, 1920))
random.seed(7)
bpx = bg.load()
for y in range(1920):
    gy = smooth[min(y // 4, len(smooth) - 1)]
    for x in range(1080):
        keep = (x < 42 or x > 1040) or y < 70
        # erase the Pippit watermark zone (top-left, y<55, x<300)
        if y < 55 and x < 300:
            keep = False
        if keep:
            bpx[x, y] = img.getpixel((min(int(x * sx), W - 1), min(int(y * sy), H - 1)))
        else:
            nr = random.gauss(0, noise_r * 0.9)
            ng = random.gauss(0, noise_g * 0.9)
            nb = random.gauss(0, noise_b * 0.9)
            bpx[x, y] = (
                max(0, min(255, int(gy[0] + nr))),
                max(0, min(255, int(gy[1] + ng))),
                max(0, min(255, int(gy[2] + nb))),
            )
# feather the x=42 and x=1040 boundaries
for x0, x1, direction in [(30, 54, 'L'), (1028, 1052, 'R')]:
    for x in range(x0, x1):
        t = (x - x0) / (x1 - x0)
        for y in range(70, 1920):
            gy = smooth[min(y // 4, len(smooth) - 1)]
            nr = random.gauss(0, noise_r * 0.9)
            ng = random.gauss(0, noise_g * 0.9)
            nb = random.gauss(0, noise_b * 0.9)
            fill = (max(0, min(255, int(gy[0] + nr))),
                    max(0, min(255, int(gy[1] + ng))),
                    max(0, min(255, int(gy[2] + nb))))
            orig = bpx[x, y]
            w = t if direction == 'L' else 1 - t
            bpx[x, y] = tuple(int(fill[i] * (1 - w) + orig[i] * w) for i in range(3))
# feather y=70 boundary
for y in range(70, 96):
    t = (y - 70) / 26
    for x in range(42, 1040):
        if bpx[x, y] == bpx[x, min(y - 1, 69)]:
            continue
        gy = smooth[min(y // 4, len(smooth) - 1)]
        orig = img.getpixel((min(int(x * sx), W - 1), min(int(y * sy), H - 1)))
        bpx[x, y] = tuple(int(gy[i] * (1 - t) + orig[i] * t) for i in range(3))

bg.save(f'{OUT_DIA}/bg-clean-rosso.png')
print('clean bg saved', bg.size)

# =========================================================== 5. tray tile ===
def vgrad(size, stops):
    """stops: list of (pos 0..1, (r,g,b))"""
    im = Image.new('RGB', (size, size))
    d = ImageDraw.Draw(im)
    for y in range(size):
        t = y / (size - 1)
        # find segment
        for i in range(len(stops) - 1):
            p0, c0 = stops[i]; p1, c1 = stops[i + 1]
            if p0 <= t <= p1:
                k = 0 if p1 == p0 else (t - p0) / (p1 - p0)
                c = tuple(int(c0[j] + (c1[j] - c0[j]) * k) for j in range(3))
                break
        else:
            c = stops[-1][1]
        d.line([(0, y), (size, y)], fill=c)
    return im

def hexc(s): return tuple(int(s[i:i+2], 16) for i in (1, 3, 5))

def make_tray(rim_hi, rim_md, rim_lo, inner_top, inner_bot, size=512):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    m, R, rim, r_in = 18, 68, 44, 34
    outer = (m, m, size - m, size - m)
    inner = (m + rim, m + rim, size - m - rim, size - m - rim)
    # drop shadow
    sh = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        (m + 4, m + 16, size - m + 4, size - m + 22), R, fill=(0, 0, 0, 150))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(11)))
    # rim gradient
    mk = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mk).rounded_rectangle(outer, R, fill=255)
    rim_g = vgrad(size, [(0, hexc(rim_hi)), (0.45, hexc(rim_md)), (1, hexc(rim_lo))]).convert('RGBA')
    im.paste(rim_g, (0, 0), mk)
    # top gloss arc (light stroke along top of rim)
    gl = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(gl).arc((m + 8, m + 8, size - m - 8, size - m - 8), 200, 340,
                           fill=(255, 255, 255, 110), width=7)
    gl = gl.filter(ImageFilter.GaussianBlur(3))
    im.alpha_composite(gl)
    # interior (recessed): darker at top, lighter at bottom
    mk2 = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mk2).rounded_rectangle(inner, r_in, fill=255)
    in_g = vgrad(size, [(0, hexc(inner_top)), (1, hexc(inner_bot))]).convert('RGBA')
    im.paste(in_g, (0, 0), mk2)
    # inner shadow at interior top (recess depth)
    ish = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ix0, iy0, ix1, iy1 = inner
    ImageDraw.Draw(ish).rounded_rectangle(
        (ix0, iy0 - 2, ix1, iy0 + 34), r_in, fill=(0, 0, 0, 130))
    im.alpha_composite(ish.filter(ImageFilter.GaussianBlur(8)))
    # bottom inner reflection
    ref = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(ref).rounded_rectangle(
        (ix0, iy1 - 22, ix1, iy1 + 2), r_in, fill=(255, 255, 255, 22))
    im.alpha_composite(ref.filter(ImageFilter.GaussianBlur(6)))
    return im

tray_rosso = make_tray('#E2314E', '#A5071D', '#6E0311', '#1C0104', '#3A0208')
tray_rosso.save(f'{OUT_DIA}/tray-rosso.png')
print('tray rosso saved')
