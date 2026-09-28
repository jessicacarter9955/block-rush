#!/usr/bin/env python3
"""Candy theme FINAL asset generation.
- bg: bilinear strip interpolation fill + matched noise; keep edge zones.
- cell: extract r7c6 pitch square; theme remap (seam/body segments).
- tray: composed per theme.
Outputs -> public/textures/candy/{bg,cell,tray}-<theme>.jpg/png
"""
from PIL import Image, ImageDraw, ImageFilter
import os, random, statistics

SRC = 'upload/pasted_image_1789654565369.png'
OUT_TEX = 'public/textures/candy'
OUT_DIA = 'download/ref-analysis'
os.makedirs(OUT_TEX, exist_ok=True)
os.makedirs(OUT_DIA, exist_ok=True)

img = Image.open(SRC).convert('RGB')
W, H = img.size
sx, sy = W / 1080, H / 1920

def hexc(s): return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))

# ============================================================ clean bg ======
print('building clean bg...')
random.seed(11)

def strip_means(y_design):
    """left (x 44-100) and right (x 995-1048) per-row means in design coords."""
    ypx = min(max(int(y_design * sy), 0), H - 1)
    left = [img.getpixel((x, ypx)) for x in range(int(44 * sx), int(100 * sx), 2)]
    right = [img.getpixel((x, ypx)) for x in range(int(995 * sx), int(1048 * sx), 2)]
    L = tuple(sum(p[i] for p in left) // len(left) for i in range(3))
    R = tuple(sum(p[i] for p in right) // len(right) for i in range(3))
    return L, R

rows = [strip_means(y) for y in range(0, 1920, 4)]
# smooth vertically
K = 7
smooth = []
for i in range(len(rows)):
    win = rows[max(0, i - K):i + K + 1]
    L = tuple(sum(w[0][j] for w in win) // len(win) for j in range(3))
    R = tuple(sum(w[1][j] for w in win) // len(win) for j in range(3))
    smooth.append((L, R))

SIG = (3.0, 2.2, 2.5)
bg = Image.new('RGB', (1080, 1920))
bpx = bg.load()
X0, X1 = 40, 1053
for y in range(1920):
    L, R = smooth[min(y // 4, len(smooth) - 1)]
    for x in range(1080):
        if x < X0 or x > X1:
            bpx[x, y] = img.getpixel((min(int(x * sx), W - 1), min(int(y * sy), H - 1)))
            continue
        t = (x - X0) / (X1 - X0)
        base = [L[i] + (R[i] - L[i]) * t for i in range(3)]
        n = [random.gauss(0, SIG[i]) for i in range(3)]
        bpx[x, y] = tuple(max(0, min(255, int(base[i] + n[i]))) for i in range(3))
# feather boundaries x=X0 and x=X1
FE = 14
for x in range(X0, X0 + FE):
    w = (x - X0) / FE  # 0 at X0 -> 1
    for y in range(1920):
        L, R = smooth[min(y // 4, len(smooth) - 1)]
        t = (x - X0) / (X1 - X0)
        base = [L[i] + (R[i] - L[i]) * t for i in range(3)]
        n = [random.gauss(0, SIG[i]) for i in range(3)]
        fill = tuple(max(0, min(255, int(base[i] + n[i]))) for i in range(3))
        o = bpx[x, y]
        bpx[x, y] = tuple(int(fill[i] * w + o[i] * (1 - w)) for i in range(3))
for x in range(X1 - FE, X1 + 1):
    w = (X1 - x) / FE  # 1 at X1-FE -> 0 at X1
    for y in range(1920):
        L, R = smooth[min(y // 4, len(smooth) - 1)]
        t = (x - X0) / (X1 - X0)
        base = [L[i] + (R[i] - L[i]) * t for i in range(3)]
        n = [random.gauss(0, SIG[i]) for i in range(3)]
        fill = tuple(max(0, min(255, int(base[i] + n[i]))) for i in range(3))
        o = bpx[x, y]
        bpx[x, y] = tuple(int(fill[i] * w + o[i] * (1 - w)) for i in range(3))

bg.save(f'{OUT_DIA}/bg-clean-rosso.png')
print('  clean bg saved')

# luminance remap
def lum(p): return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]

def remap_bg(source, c1, c2, p_lo=2, p_hi=98):
    lums = [lum(bpx[x, y]) for y in range(0, 1920, 6) for x in range(0, 1080, 6)]
    lums.sort()
    lo = lums[int(len(lums) * p_lo / 100)]
    hi = lums[int(len(lums) * p_hi / 100)]
    if hi <= lo:
        hi = lo + 1
    out = Image.new('RGB', (1080, 1920))
    opx = out.load()
    spx = source.load()
    for y in range(1920):
        for x in range(1080):
            t = (lum(spx[x, y]) - lo) / (hi - lo)
            t = max(0.0, min(1.0, t))
            opx[x, y] = tuple(int(c2[i] + (c1[i] - c2[i]) * t) for i in range(3))
    return out

# ============================================================ cell tile =====
CE = [77, 193, 309, 424, 540, 655, 773, 887, 1004]
RE = [330, 454, 580, 703, 826, 947, 1071, 1198, 1321]
r, c = 7, 6
x0, x1 = int(CE[c] * sx), int(CE[c + 1] * sx)
y0, y1 = int(RE[r] * sy), int(RE[r + 1] * sy)
cell = img.crop((x0, y0, x1, y1)).resize((256, 256), Image.LANCZOS)
cell.save(f'{OUT_DIA}/cell-rosso.png')

def remap_cell(source, cell_dark, cell_light, seam):
    """two-segment: near-black seam zone -> seam color; body -> dark..light."""
    out = Image.new('RGB', (256, 256))
    opx = out.load()
    spx = source.load()
    for y in range(256):
        for x in range(256):
            p = spx[x, y]
            l = lum(p)
            if l < 34:  # seam zone
                t = max(0.0, min(1.0, l / 34))
                opx[x, y] = tuple(int(seam[i] * 0.55 + (seam[i] * 1.9 * t) * 0.45) for i in range(3))
            else:
                t = max(0.0, min(1.0, (l - 34) / 66))
                opx[x, y] = tuple(int(cell_dark[i] + (cell_light[i] - cell_dark[i]) * t) for i in range(3))
    return out

# ============================================================ tray tile =====
def vgrad(size, stops):
    im = Image.new('RGB', (size, size))
    d = ImageDraw.Draw(im)
    for y in range(size):
        t = y / (size - 1)
        c = stops[-1][1]
        for i in range(len(stops) - 1):
            p0, c0 = stops[i]; p1, c1_ = stops[i + 1]
            if p0 <= t <= p1:
                k = 0 if p1 == p0 else (t - p0) / (p1 - p0)
                c = tuple(int(c0[j] + (c1_[j] - c0[j]) * k) for j in range(3))
                break
        d.line([(0, y), (size, y)], fill=c)
    return im

def make_tray(rim_hi, rim_md, rim_lo, inner_top, inner_bot, size=512):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    m, R, rim, r_in = 18, 68, 44, 34
    outer = (m, m, size - m, size - m)
    inner = (m + rim, m + rim, size - m - rim, size - m - rim)
    sh = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        (m + 4, m + 16, size - m + 4, size - m + 22), R, fill=(0, 0, 0, 150))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(11)))
    mk = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mk).rounded_rectangle(outer, R, fill=255)
    rim_g = vgrad(size, [(0, hexc(rim_hi)), (0.45, hexc(rim_md)), (1, hexc(rim_lo))]).convert('RGBA')
    im.paste(rim_g, (0, 0), mk)
    gl = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(gl).arc((m + 8, m + 8, size - m - 8, size - m - 8), 200, 340,
                           fill=(255, 255, 255, 110), width=7)
    im.alpha_composite(gl.filter(ImageFilter.GaussianBlur(3)))
    mk2 = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mk2).rounded_rectangle(inner, r_in, fill=255)
    in_g = vgrad(size, [(0, hexc(inner_top)), (1, hexc(inner_bot))]).convert('RGBA')
    im.paste(in_g, (0, 0), mk2)
    ish = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ix0, iy0, ix1, iy1 = inner
    ImageDraw.Draw(ish).rounded_rectangle(
        (ix0, iy0 - 2, ix1, iy0 + 34), r_in, fill=(0, 0, 0, 130))
    im.alpha_composite(ish.filter(ImageFilter.GaussianBlur(8)))
    ref = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(ref).rounded_rectangle(
        (ix0, iy1 - 22, ix1, iy1 + 2), r_in, fill=(255, 255, 255, 22))
    im.alpha_composite(ref.filter(ImageFilter.GaussianBlur(6)))
    return im

# ============================================================= THEMES =======
THEMES = {
  'rosso':  dict(bg1='#B01220', bg2='#3E030A', frame='#B00E20',
                 cdark='#7A0512', clight='#D01528', seam='#160204',
                 rim=('#E2314E', '#A5071D', '#6E0311'), inn=('#1C0104', '#3A0208')),
  'nero':   dict(bg1='#4A505C', bg2='#101318', frame='#3A404C',
                 cdark='#151920', clight='#4A525E', seam='#030407',
                 rim=('#6A7280', '#3A404C', '#23272F'), inn=('#0A0C10', '#161A20')),
  'bianco': dict(bg1='#FFFFFF', bg2='#CFCBC5', frame='#E8E4DE',
                 cdark='#B9B5AE', clight='#F4F2EE', seam='#4A4844',
                 rim=('#FFFFFF', '#E6E2DC', '#B8B3AB'), inn=('#8F8B85', '#ABA7A1')),
  'viola':  dict(bg1='#9A54EE', bg2='#3D1580', frame='#7C3DE0',
                 cdark='#3C0E74', clight='#9A4FE0', seam='#0D021C',
                 rim=('#B26BF5', '#7C3DE0', '#54209E'), inn=('#170430', '#2E0B5E')),
  'giallo': dict(bg1='#F7C924', bg2='#A06A04', frame='#E8AF08',
                 cdark='#6E4502', clight='#F2B40D', seam='#1A1001',
                 rim=('#FFD84D', '#EAB308', '#A87405'), inn=('#2E1E02', '#4A3103')),
  'verde':  dict(bg1='#A5E36A', bg2='#35701F', frame='#6FBE3C',
                 cdark='#28550F', clight='#8AD44F', seam='#061702',
                 rim=('#B4EC6A', '#7CC93F', '#4E8F27'), inn=('#12300A', '#1F4A10')),
  'azzurro':dict(bg1='#8EDBFF', bg2='#1E75A8', frame='#56BBEA',
                 cdark='#0E4B6E', clight='#5EBCEC', seam='#02141F',
                 rim=('#A5E3FF', '#5FC2F0', '#2E8FC0'), inn=('#0A2E44', '#124563')),
  'blu':    dict(bg1='#4A78F7', bg2='#182E80', frame='#3358DC',
                 cdark='#12246E', clight='#5578EC', seam='#030821',
                 rim=('#6D95FF', '#3360E8', '#1E3FA8'), inn=('#0A1236', '#152457')),
  'arancio':dict(bg1='#FFAE4D', bg2='#B04C03', frame='#F08415',
                 cdark='#6E3002', clight='#F79524', seam='#1B0B01',
                 rim=('#FFB970', '#F97B1C', '#B5540A'), inn=('#301402', '#4A2004')),
  'rosa':   dict(bg1='#FF9EC2', bg2='#BC3A78', frame='#EE6AA2',
                 cdark='#74144A', clight='#F583B4', seam='#1C0310',
                 rim=('#FFB3D0', '#F76CA3', '#C13E75'), inn=('#360820', '#521030')),
  'menta':  dict(bg1='#8FF0D4', bg2='#1E7E62', frame='#48C8A2',
                 cdark='#0F5C44', clight='#5FDDB6', seam='#021812',
                 rim=('#A5F2DC', '#4ECDAA', '#268F72'), inn=('#0A3A2C', '#12523E')),
}

for name, th in THEMES.items():
    # bg
    if name == 'rosso':
        bg_t = bg
    else:
        bg_t = remap_bg(bg, hexc(th['bg1']), hexc(th['bg2']))
    bg_t.save(f'{OUT_TEX}/bg-{name}.jpg', quality=82)
    # cell
    cell_t = remap_cell(cell, hexc(th['cdark']), hexc(th['clight']), hexc(th['seam']))
    cell_t.save(f'{OUT_TEX}/cell-{name}.png')
    # tray
    tray_t = make_tray(*th['rim'], *th['inn'])
    tray_t.save(f'{OUT_TEX}/tray-{name}.png')
    print(f'theme {name}: done')

# preview sheet
prev = Image.new('RGB', (11 * 300, 420), (24, 24, 28))
d = ImageDraw.Draw(prev)
for i, (name, th) in enumerate(THEMES.items()):
    b = Image.open(f'{OUT_TEX}/bg-{name}.jpg').resize((100, 178))
    ce = Image.open(f'{OUT_TEX}/cell-{name}.png').resize((90, 90))
    tr = Image.open(f'{OUT_TEX}/tray-{name}.png').resize((90, 90))
    x = i * 300 + 10
    prev.paste(b, (x, 30))
    prev.paste(ce, (x + 110, 74))
    prev.paste(tr, (x + 210, 74), tr)
    d.text((x, 12), name, fill=(255, 255, 255))
prev.save(f'{OUT_DIA}/theme-preview.png')
print('preview saved')
import subprocess
print(subprocess.run(['ls', '-la', OUT_TEX], capture_output=True, text=True).stdout)
