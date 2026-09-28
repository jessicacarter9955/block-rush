#!/usr/bin/env python3
"""Estrazione pixel perfect Block Rush 1:1 dai due screenshot caricati.

产出 (public/textures/rush/):
  block-0..7.png    8 tessere blocchi (7 reali + giallo sintetizzato)
  cell.png          cella vuota (bevel incassato)
  frame.png         board frame neon con alpha (1086x1086, celle a 63-1023)
  bg-game.jpg       sfondo gameplay (board/tray/UI rimossi e inpaintati)
  bg-home.jpg       sfondo home (logo/play/bottoni rimossi e inpaintati)
  logo.png          logo BLOCK RUSH con alpha
  play.png          bottone play con alpha
  btn-music.png / btn-sfx.png / btn-ranking.png / btn-pause.png  (alpha)
  crown.png         corona oro con alpha
Diagnostica: /tmp/rush11-*.png per verifica visiva.
"""
from PIL import Image, ImageFilter
import colorsys

S1 = '/home/z/my-project/uploads-inbox/20260928-134738-screen-1-0.png'  # gameplay 941x1672
S2 = '/home/z/my-project/uploads-inbox/20260928-134738-screen-2-1.png'  # home 942x1670
OUT = '/home/z/my-project/public/textures/rush'

im1 = Image.open(S1).convert('RGB')
im2 = Image.open(S2).convert('RGB')
W1, H1 = im1.size
W2, H2 = im2.size

# griglia board screen1: x0=67, y0=341, pitch 100.1 x 101.5
GX, GY, PX, PY = 67.0, 341.0, 100.1, 101.5

# ---------------------------------------------------------------- helpers ---

def lum(p):
    return (p[0]*0.299 + p[1]*0.587 + p[2]*0.114)

def sat(p):
    return max(p[:3]) - min(p[:3])

def bbox_of(pred, x0, y0, x1, y1, min_count=3):
    """bbox dei pixel che soddisfano pred nel rettangolo, o None."""
    px = im1.load() if False else None
    return None

def find_bbox(img, pred, region, min_count=5):
    x0, y0, x1, y1 = region
    px = img.load()
    xs, ys = [], []
    for y in range(y0, y1):
        for x in range(x0, x1):
            if pred(px[x, y]):
                xs.append(x); ys.append(y)
    if len(xs) < min_count:
        return None
    return (min(xs), min(ys), max(xs)+1, max(ys)+1)

def inpaint(img, box, feather=18, noise=3.0, seed=7, sample=16, mode='both', sample_top=None, sample_bottom=None, feather_tb=False):
    """Riempie box per bg bokeh sfocato. mode='v' usa SOLO le bande sopra/sotto
    (mediate su 20px e sfumate orizzontalmente). feather_tb=True: sfuma solo
    ai bordi alto/basso (taglio netto sui lati, dove il glow UI potrebbe
    sopravvivere nella zona feather)."""
    x0, y0, x1, y1 = [int(v) for v in box]
    W, H = img.size
    px = img.load()
    bw, bh = x1-x0, y1-y0
    import random
    rnd = random.Random(seed)
    st = sample if sample_top is None else sample_top
    sb = sample if sample_bottom is None else sample_bottom

    def band_avg(y_from, y_to):
        """media verticale per colonna + smoothing orizzontale"""
        y_from, y_to = max(0, y_from), min(H-1, y_to)
        acc = [[0.0, 0.0, 0.0] for _ in range(bw)]
        n = max(1, y_to - y_from)
        for y in range(y_from, y_to):
            for i in range(bw):
                p = px[min(max(x0+i,0),W-1), y]
                acc[i][0] += p[0]; acc[i][1] += p[1]; acc[i][2] += p[2]
        cols = [(a[0]/n, a[1]/n, a[2]/n) for a in acc]
        # box blur orizzontale (finestra 61)
        R = 30
        out = []
        for i in range(bw):
            s = [0.0, 0.0, 0.0]; m = 0
            for k in range(max(0, i-R), min(bw, i+R+1)):
                s[0] += cols[k][0]; s[1] += cols[k][1]; s[2] += cols[k][2]; m += 1
            out.append((s[0]/m, s[1]/m, s[2]/m))
        return out

    if mode == 'v':
        top = band_avg(y0-st-20, y0-st)
        bot = band_avg(y1+sb, y1+sb+20)
        fill = Image.new('RGB', (bw, bh))
        fp = fill.load()
        for j in range(bh):
            u = j / (bh-1 if bh > 1 else 1)
            for i in range(bw):
                n = rnd.gauss(0, noise)
                fp[i, j] = tuple(max(0, min(255, int(top[i][k] + (bot[i][k]-top[i][k])*u + n))) for k in range(3))
        fill = fill.filter(ImageFilter.GaussianBlur(min(bw, bh)/7))
    else:
        left  = [px[max(x0-sample,0), min(max(y,0),H-1)] for y in range(y0, y1)]
        right = [px[min(x1+sample-1,W-1), min(max(y,0),H-1)] for y in range(y0, y1)]
        topb  = [px[min(max(x,0),W-1), max(y0-sample,0)] for x in range(x0, x1)]
        botb  = [px[min(max(x,0),W-1), min(y1+sample-1,H-1)] for x in range(x0, x1)]
        fill = Image.new('RGB', (bw, bh))
        fp = fill.load()
        for j in range(bh):
            for i in range(bw):
                fx = bw-1 if bw > 1 else 1
                fy = bh-1 if bh > 1 else 1
                t = i / fx
                u = j / fy
                h1 = [left[j][k] + (right[j][k]-left[j][k])*t for k in range(3)]
                h2 = [topb[i][k]  + (botb[i][k]-topb[i][k])*u   for k in range(3)]
                wv = abs(u-0.5)*2
                c = [ (h1[k]*(1-wv*0.65) + h2[k]*(wv*0.65)) for k in range(3) ]
                n = rnd.gauss(0, noise)
                fp[i, j] = tuple(max(0, min(255, int(c[k]+n))) for k in range(3))
        fill = fill.filter(ImageFilter.GaussianBlur(min(bw, bh)/6))
    # maschera feather (feather_tb: sfuma solo alto/basso, taglio netto sui lati)
    mask = Image.new('L', (bw, bh), 255)
    md = mask.load()
    for i in range(bw):
        for j in range(bh):
            e = min(j, bh-1-j) if feather_tb else min(i, j, bw-1-i, bh-1-j)
            if e < feather:
                md[i, j] = int(255 * e / feather)
    img.paste(fill, (x0, y0), mask)
    return img

def alpha_cut(img, keep_pred, feather=1, cleanup=None):
    """Ritorna RGBA dove keep_pred(px)=True -> opaco, resto trasparente."""
    rgba = img.convert('RGBA')
    px = rgba.load()
    W, H = rgba.size
    for y in range(H):
        for x in range(W):
            if not keep_pred(px[x, y]):
                px[x, y] = (px[x, y][0], px[x, y][1], px[x, y][2], 0)
    if feather > 0:
        a = rgba.split()[3].filter(ImageFilter.GaussianBlur(feather))
        rgba.putalpha(a)
    return rgba

def trim(rgba, thresh=8):
    """Ritaglia ai bounding box dell'alpha."""
    bbox = rgba.split()[3].point(lambda v: 255 if v > thresh else 0).getbbox()
    return rgba.crop(bbox) if bbox else rgba

# ---------------------------------------------------------------- blocchi ---

# righe: 0 viola, 1 azzurro, 2 verde, 3 blu, 4 viola, 5 arancione, 6 rosso, 7 rosa
ROWS = ['viola','azzurro','verde','blu','viola2','arancione','rosso','rosa']
tiles = {}
for r in range(8):
    x0 = int(GX + 3*PX)          # colonna centrale del pezzo da 3
    y0 = int(GY + r*PY)
    tile = im1.crop((x0, y0, x0+int(PX), y0+int(PY))).resize((120, 120), Image.LANCZOS)
    tiles[ROWS[r]] = tile
    tile.save(f'/tmp/rush11-tile-{ROWS[r]}.png')

# il viola: usa la riga 0 (row 4 potrebbe avere la mano/sparkle vicino)
# giallo: hue shift dell'arancione
orange = tiles['arancione'].convert('RGB')
yellow = orange.copy()
op = yellow.load()
for y in range(120):
    for x in range(120):
        r, g, b = op[x, y]
        h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
        h = (h + 0.075) % 1.0     # arancio (~25°) -> giallo oro (~52°)
        s = min(1.0, s*0.92)
        nr, ng, nb = colorsys.hsv_to_rgb(h, s, v)
        op[x, y] = (int(nr*255), int(ng*255), int(nb*255))
yellow.save('/tmp/rush11-tile-giallo.png')

# mapping -> slot del gioco (ordine ORIGINAL_COLORS: lavanda,ciano,verde,giallo,arancio,rosso,magenta,blu)
tiles['giallo'] = yellow
ORDER = ['viola','azzurro','verde','giallo','arancione','rosso','rosa','blu']
for i, name in enumerate(ORDER):
    tiles[name].save(f'{OUT}/block-{i}-{name}.png')
print('blocchi: 8 salvati (giallo = hue-shift arancione)')

# ---------------------------------------------------------------- cella -----

# cella vuota (1,6): lontana da blocchi e bordo
cx, cy = int(GX + 6*PX), int(GY + 1*PY)
cell = im1.crop((cx, cy, cx+int(PX), cy+int(PY))).resize((120, 120), Image.LANCZOS)
cell.save(f'{OUT}/cell.png')
cell.save('/tmp/rush11-cell.png')
print(f'cella: ({cx},{cy})')

# ---------------------------------------------------------------- frame -----

# frame: bordo neon con alpha. Celle a x 67-868, y 341-1153 (801x812).
# immagine 1086x1086: area celle 960x960 a offset 63; bordo spessore 63.
# scala: 960/801 = 1.1985
# ritaglio screenshot: bordo esterno = cell_area - 63/1.1985 = 67-52.6 = 14.4
k = 960.0 / 801.0
S = 1086
fx0 = GX - 63/k      # ~14.4
fy0 = GY - 62/k      # ~289  (rim verticale leggermente diverso: celle y 341-1153)
fx1 = 868 + 63/k
fy1 = 1153 + 62/k
fw, fh = fx1-fx0, fy1-fy0
print(f'frame crop: ({fx0:.1f},{fy0:.1f})-({fx1:.1f},{fy1:.1f}) {fw:.1f}x{fh:.1f}')
frame = im1.crop((int(fx0), int(fy0), int(fx1)+1, int(fy1)+1)).resize((S, S), Image.LANCZOS)

# interior: svuota (celle + blocchi + mano via) -> navy scuro + rumore
import math, random
rnd = random.Random(11)
fp2 = frame.load()
IN0, IN1 = 63, 1023   # area celle in coordinate immagine
for y in range(IN0-6, IN1+6):
    for x in range(IN0-6, IN1+6):
        if 0 <= x < S and 0 <= y < S:
            n = rnd.gauss(0, 2.5)
            fp2[x, y] = (max(0,min(255,int(10+n))), max(0,min(255,int(23+n))), max(0,min(255,int(85+n))))
# alpha: trasparente fuori dall'angolo arrotondato + fade SOLO nei 10px esterni
# (il glow vero è già dentro l'immagine: il fade evita solo il taglio duro al bordo)
fa = Image.new('L', (S, S), 0)
fad = fa.load()
CORNER = 34          # raggio angolo (in px immagine)
for y in range(S):
    for x in range(S):
        dx = max(CORNER - x, x - (S-1-CORNER), 0)
        dy = max(CORNER - y, y - (S-1-CORNER), 0)
        if dx > 0 and dy > 0 and math.hypot(dx, dy) > CORNER:
            continue
        e = min(x, y, S-1-x, S-1-y)
        fad[x, y] = 255 if e >= 10 else int(255 * (e / 10) ** 0.6)
fa = fa.filter(ImageFilter.GaussianBlur(1.0))
frame.putalpha(fa)
frame.save(f'{OUT}/frame.png')
frame.save('/tmp/rush11-frame.png')
print('frame: 1086x1086 salvato (interno svuotato)')

# ---------------------------------------------------------------- crown -----

# corona oro in alto a sx su screen1
is_gold = lambda p: p[0] > 165 and p[1] > 115 and p[2] < 120 and (p[0]-p[2]) > 70
box = find_bbox(im1, is_gold, (10, 10, 320, 240))
print('crown bbox:', box)
if box:
    pad = 6
    c = im1.crop((max(box[0]-pad,0), max(box[1]-pad,0), box[2]+pad, box[3]+pad))
    crown = alpha_cut(c, lambda p: lum(p) > 95 or sat(p) > 70, feather=1)
    # separa corona e '0': colonna-valle sul profilo ORO (non alpha: il glow connette)
    cp = crown.load()
    cw, ch = crown.size
    is_gold_p = lambda p: p[0] > 165 and p[1] > 115 and p[2] < 130 and (p[0]-p[2]) > 60
    colsum = [sum(1 for yy in range(ch) if is_gold_p(cp[xx, yy])) for xx in range(cw)]
    first_peak = next((xx for xx in range(cw) if colsum[xx] > 3), 0)
    valley_x, valley_v = None, 10**9
    for xx in range(first_peak + 8, cw - 4):
        if colsum[xx] < valley_v:
            valley_v, valley_x = colsum[xx], xx
        if valley_v == 0 and xx > first_peak + 30:
            break
    if valley_x is not None and valley_v <= 2:
        for xx in range(valley_x + 1, cw):
            for yy in range(ch):
                if cp[xx, yy][3] > 0:
                    cp[xx, yy] = (0, 0, 0, 0)
        print(f'  crown: taglio a x={valley_x} (valley={valley_v})')
    crown = trim(crown)
    crown.save(f'{OUT}/crown.png')
    crown.save('/tmp/rush11-crown.png')
    print('  crown size:', crown.size)

# ---------------------------------------------------------------- pause -----

# bottone pausa viola in alto a dx su screen1
is_btn = lambda p: sat(p) > 60 and p[2] > 130 and p[0] > 90 and lum(p) > 55
box = find_bbox(im1, is_btn, (770, 10, 941, 200))
print('pause bbox:', box)
if box:
    pad = 4
    c = im1.crop((max(box[0]-pad,0), max(box[1]-pad,0), min(box[2]+pad,W1), min(box[3]+pad,H1)))
    pause = alpha_cut(c, lambda p: lum(p) > 45 or sat(p) > 55, feather=1.5)
    pause = trim(pause)
    pause.save(f'{OUT}/btn-pause.png')
    pause.save('/tmp/rush11-pause.png')
    print('  pause size:', pause.size)

# ----------------------------------------------------------- tray piece ----

# pezzo viola 3x1 in basso (da rimuovere dal bg): cerca blob viola saturo
is_purple = lambda p: sat(p) > 80 and p[2] > 120 and p[0] > 60 and lum(p) > 45 and lum(p) < 200
box = find_bbox(im1, is_purple, (300, 1250, 641, 1620), min_count=40)
print('tray piece bbox:', box)
tray_box = box

# ---------------------------------------------------------------- bg game --

bg = im1.copy()
# board completa (incluso glow largo): x 0-941, y 255-1235
bg = inpaint(bg, (0, 255, 941, 1235), feather=30, noise=3, sample=24)
# tray piece
if tray_box:
    bg = inpaint(bg, (tray_box[0]-36, tray_box[1]-36, tray_box[2]+36, min(tray_box[3]+36,H1)), feather=24, noise=3, sample=14)
# crown + best text
bg = inpaint(bg, (12, 12, 310, 160), feather=20, noise=3, sample=12)
# score 0 centro
bg = inpaint(bg, (315, 30, 655, 270), feather=20, noise=3, sample=12)
# pause btn
bg = inpaint(bg, (765, 8, 941, 175), feather=18, noise=3, sample=12)
bg.save(f'{OUT}/bg-game.jpg', quality=95)
bg.save('/tmp/rush11-bg-game.png')
print('bg-game salvato')

# ---------------------------------------------------------------- bg home --

def mirror_fill(img, box, feather=30, blur=5, noise=2.0, seed=5):
    """Riempie box con contenuto VERO del bg: mirror-tiling della striscia
    pulita a sinistra del box (stesse righe -> i gradienti verticali continuano)."""
    import random
    x0, y0, x1, y1 = [int(v) for v in box]
    W, H = img.size
    rw, rh = x1-x0, y1-y0
    sw = min(x0, 200)              # larghezza striscia sorgente (a sinistra del box)
    src = img.crop((x0-sw, y0, x0, y1))
    # tile speculare: [src][flip][src][flip]...
    tiles = [src if i % 2 == 0 else src.transpose(Image.FLIP_LEFT_RIGHT) for i in range((rw // sw) + 2)]
    band = Image.new('RGB', (sw * len(tiles), rh))
    for i, t in enumerate(tiles):
        band.paste(t, (i*sw, 0))
    fill = band.crop((0, 0, rw, rh))
    fill = fill.filter(ImageFilter.GaussianBlur(blur))
    rnd = random.Random(seed)
    fp = fill.load()
    for j in range(rh):
        for i in range(rw):
            n = rnd.gauss(0, noise)
            r, g, b = fp[i, j]
            fp[i, j] = (max(0,min(255,int(r+n))), max(0,min(255,int(g+n))), max(0,min(255,int(b+n))))
    # maschera feather morbida
    mask = Image.new('L', (rw, rh), 255)
    md = mask.load()
    for i in range(rw):
        for j in range(rh):
            e = min(i, j, rw-1-i, rh-1-j)
            if e < feather:
                md[i, j] = int(255 * (e / feather) ** 0.8)
    img.paste(fill, (x0, y0), mask)
    return img

bgh = im2.copy()
# ORDINE: play -> bottoni -> logo (il fill logo campiona la zona play GIÀ riempita)
# feather_tb: taglio netto sui lati (il glow UI non sopravvive nella zona feather)
bgh = inpaint(bgh, (150, 1010, 870, 1290), feather=34, noise=1.1,
              mode='v', sample_top=15, sample_bottom=5, feather_tb=True)
bgh = inpaint(bgh, (50, 1345, 275, 1540), feather=28, noise=1.1, mode='v', sample_top=20, sample_bottom=42, feather_tb=True)
bgh = inpaint(bgh, (345, 1345, 565, 1540), feather=28, noise=1.1, mode='v', sample_top=20, sample_bottom=42, feather_tb=True)
bgh = inpaint(bgh, (635, 1345, 855, 1540), feather=28, noise=1.1, mode='v', sample_top=20, sample_bottom=42, feather_tb=True)
bgh = inpaint(bgh, (95, 75, 942, 985), feather=40, noise=1.1,
              mode='v', sample_top=70, sample_bottom=30, feather_tb=True)
bgh.save(f'{OUT}/bg-home.jpg', quality=95)
bgh.save('/tmp/rush11-bg-home.png')
print('bg-home salvato')

# ---------------------------------------------------------------- logo -----

# logo su screen2: area COMPLETA del rombo + ellisse dorata + sparkles.
lx0, ly0, lx1, ly1 = 100, 75, 940, 985
logo_c = im2.crop((lx0, ly0, lx1, ly1))
logo = alpha_cut(logo_c, lambda p: lum(p) > 60 or sat(p) > 70, feather=1.5)
# rimuovi blob piccoli isolati (bokeh): componenti connessi sull'alpha
la = logo.split()[3]
# etichettatura componenti connessi (BFS, soglia alpha>60)
from collections import deque
lw, lh = la.size
lap = la.load()
labels = [[0]*lw for _ in range(lh)]
cur = 0
comps = []
for y in range(lh):
    for x in range(lw):
        if lap[x, y] > 60 and labels[y][x] == 0:
            cur += 1
            q = deque([(x, y)]); labels[y][x] = cur; n = 0
            while q:
                cx, cy = q.popleft(); n += 1
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx, ny = cx+dx, cy+dy
                    if 0 <= nx < lw and 0 <= ny < lh and lap[nx, ny] > 60 and labels[ny][nx] == 0:
                        labels[ny][nx] = cur; q.append((nx, ny))
            comps.append((cur, n))
big = max(comps, key=lambda t: t[1])[0] if comps else 0
big_ids = {c for c, n in comps if n > 1600}
lp = logo.load()
for y in range(lh):
    for x in range(lw):
        if labels[y][x] not in big_ids and lp[x, y][3] > 0 and labels[y][x] != 0:
            lp[x, y] = (lp[x, y][0], lp[x, y][1], lp[x, y][2], 0)
logo = trim(logo)
logo.save(f'{OUT}/logo.png')
logo.save('/tmp/rush11-logo.png')
print('logo:', logo.size)

# ---------------------------------------------------------------- play -----

is_play = lambda p: (p[0] > 170 and 80 < p[1] < 215 and p[2] < 110) or (lum(p) > 200)
box = find_bbox(im2, is_play, (150, 1040, 800, 1280), min_count=200)
print('play bbox:', box)
if box:
    pad = 5
    c = im2.crop((max(box[0]-pad,0), max(box[1]-pad,0), min(box[2]+pad,W2), min(box[3]+pad,H2)))
    play = alpha_cut(c, lambda p: lum(p) > 70 or sat(p) > 90, feather=2.0)
    from PIL import ImageFilter as IF2
    r_, g_, b_, a_ = play.split()
    r_ = r_.filter(IF2.UnsharpMask(radius=2, percent=70, threshold=2))
    g_ = g_.filter(IF2.UnsharpMask(radius=2, percent=70, threshold=2))
    b_ = b_.filter(IF2.UnsharpMask(radius=2, percent=70, threshold=2))
    play = Image.merge('RGBA', (r_, g_, b_, a_))
    play = trim(play)
    play.save(f'{OUT}/play.png')
    play.save('/tmp/rush11-play.png')
    print('  play:', play.size)

# ---------------------------------------------------------- circle btns ---

def extract_circle(cx_guess, out_name):
    # trova il cerchio: bordo bianco-azzurro luminoso attorno a x~cx, y 1395-1500
    is_ring = lambda p: p[0] > 175 and p[1] > 185 and p[2] > 195
    box = find_bbox(im2, is_ring, (cx_guess-70, 1380, cx_guess+70, 1510), min_count=15)
    print(f'{out_name} ring bbox:', box)
    if not box:
        return
    cx0, cy0, cx1, cy1 = box
    w = cx1-cx0; h = cy1-cy0
    r = max(w, h) / 2
    ccx, ccy = (cx0+cx1)/2, (cy0+cy1)/2
    # ritaglio AMPIO: tutto il glow attorno (+40px)
    side = int(r*2 + 80)
    x0 = int(ccx - side/2); y0 = int(ccy - side/2)
    c = im2.crop((x0, y0, x0+side, y0+side)).convert('RGBA')
    # alpha: dentro il cerchio bottone = 255; fuori = proporzionale al glow
    # (il bg bokeh e' scuro ~lum 25, il glow 45-120: mantiene tutto l'alone)
    import math as _m
    rbtn = r * 1.06          # raggio bottone incl. anello
    cp = c.load()
    for yy in range(side):
        for xx in range(side):
            px_ = cp[xx, yy]
            d = _m.hypot(xx - side/2, yy - side/2)
            if d <= rbtn:
                a = 255
            else:
                l = px_[0]*0.299 + px_[1]*0.587 + px_[2]*0.114
                a = max(0, min(255, int((l - 38) * 255 / 55)))
            cp[xx, yy] = (px_[0], px_[1], px_[2], a)
    # feather leggero + unsharp per compensare l'upscale
    from PIL import ImageFilter as IF
    a_ = c.split()[3].filter(IF.GaussianBlur(1.2))
    r_, g_, b_ = c.split()[:3]
    r_ = r_.filter(IF.UnsharpMask(radius=2, percent=85, threshold=2))
    g_ = g_.filter(IF.UnsharpMask(radius=2, percent=85, threshold=2))
    b_ = b_.filter(IF.UnsharpMask(radius=2, percent=85, threshold=2))
    btn = Image.merge('RGBA', (r_, g_, b_, a_))
    # normalizza: canvas 240x240, centro bottone al centro, diametro cerchio 144 (60%)
    # -> nel renderer l'img si disegna a size/0.6 e il cerchio occupa esattamente `size`
    btn = btn.resize((240, 240), Image.LANCZOS) if side != 240 else btn
    # ricentra: sposta il centro del ring al centro canvas (il crop era gia' centrato)
    btn.save(f'{OUT}/{out_name}.png')
    btn.save(f'/tmp/rush11-{out_name}.png')
    print(f'  {out_name}: 240x240 normalizzato (ring {w}x{h})')

extract_circle(157, 'btn-sfx')
extract_circle(452, 'btn-ranking')
extract_circle(751, 'btn-music')

print('\nTUTTO ESTRATTO -> verifiare /tmp/rush11-*.png')
