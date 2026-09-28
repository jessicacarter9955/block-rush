#!/usr/bin/env python3
"""Trova bounding box degli elementi UI su screen2 (home): logo, play, bottoni circolari."""
from PIL import Image

S2 = '/home/z/my-project/uploads-inbox/20260928-134738-screen-2-1.png'
im = Image.open(S2).convert('RGB')
W, H = im.size
px = im.load()

def is_bright(p):
    return (p[0]+p[1]+p[2])/3 > 110

# il bottone play = arancione: r>200, g 120-200, b<90
def is_orange(p):
    r, g, b = p[:3]
    return r > 190 and 100 < g < 210 and b < 100

rows = []
for y in range(0, H):
    c = sum(1 for x in range(0, W, 2) if is_orange(px[x, y]))
    if c > 20: rows.append(y)
def group(seq, gap=6):
    if not seq: return []
    out = [[seq[0]]]
    for v in seq[1:]:
        if v - out[-1][-1] <= gap: out[-1].append(v)
        else: out.append([v])
    return [(g[0], g[-1]) for g in out]
print('righe arancioni (play button):', group(rows))
if rows:
    y0, y1 = group(rows)[0]
    cols = [x for x in range(W) if is_orange(px[x, (y0+y1)//2])]
    cg = group(cols, 4)
    print('colonne arancioni:', cg[:4])

# bottoni circolari in basso: viola scuro con bordo chiaro — cerca cerchi luminosi
# bordo bianco-azzurro: r,g,b tutti alti con b>=r
def is_whiteblue(p):
    r, g, b = p[:3]
    return r > 190 and g > 200 and b > 210
rows2 = []
for y in range(int(H*0.7), H):
    c = sum(1 for x in range(0, W, 2) if is_whiteblue(px[x, y]))
    if c > 8: rows2.append(y)
print('righe bianco-azzurre zona bassa:', group(rows2))

# logo: zona centrale — cerca il rombo viola brillante (754CF8 visto al centro)
def is_purple(p):
    r, g, b = p[:3]
    return 90 < r < 160 and 40 < g < 120 and b > 200
rows3 = []
for y in range(0, H):
    c = sum(1 for x in range(0, W, 2) if is_purple(px[x, y]))
    if c > 15: rows3.append(y)
print('righe viola brillante (logo/diamond):', group(rows3))

# colore play button campionato
if rows:
    ym = (rows[0]+rows[-1])//2
    # colonna centrale del bottone
    mid_cols = [x for x in range(W//4, 3*W//4) if is_orange(px[x, ym])]
    if mid_cols:
        xm = mid_cols[len(mid_cols)//2]
        print('play center sample:', '#%02X%02X%02X' % px[xm, ym][:3], 'at', xm, ym)
        print('play top sample:', '#%02X%02X%02X' % px[xm, rows[0]+5][:3])
        print('play bottom sample:', '#%02X%02X%02X' % px[xm, rows[-1]-5][:3])
