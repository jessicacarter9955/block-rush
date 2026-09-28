#!/usr/bin/env python3
"""Trova il rettangolo della board (bordo neon ciano) su screen1 e misura pitch celle."""
from PIL import Image

S1 = '/home/z/my-project/uploads-inbox/20260928-134738-screen-1-0.png'
im = Image.open(S1).convert('RGB')
W, H = im.size
px = im.load()

def is_cyan(p):
    r, g, b = p[:3]
    return b > 150 and g > 130 and r < 120

def is_bright(p):
    r, g, b = p[:3]
    return (r+g+b)/3 > 100

# --- bordo board: per ogni riga, quante colonne sono ciano/bright? ---
# il bordo neon è un rettangolo: righe del bordo hanno molte colonne luminose
rowcount = []
for y in range(0, H):
    c = 0
    for x in range(0, W, 3):
        if is_bright(px[x, y]):
            c += 1
    rowcount.append(c)

colcount = []
for x in range(0, W):
    c = 0
    for y in range(0, H, 3):
        if is_bright(px[x, y]):
            c += 1
    colcount.append(c)

# righe con conteggio alto = bordo orizzontale
rows_peaks = [y for y in range(H) if rowcount[y] > W/3/2]
cols_peaks = [x for x in range(W) if colcount[x] > H/3/2]

def group(seq, gap=5):
    if not seq: return []
    out = [[seq[0]]]
    for v in seq[1:]:
        if v - out[-1][-1] <= gap: out[-1].append(v)
        else: out.append([v])
    return [(g[0], g[-1]) for g in out]

print('righe bordo (gruppi):', group(rows_peaks))
print('colonne bordo (gruppi):', group(cols_peaks))

# --- dentro la board: celle scure incassate → bordi celle = righe leggermente più chiare ---
# ipotesi board x: cols_peaks estremi, y: rows_peaks estremi
if rows_peaks and cols_peaks:
    y0, y1 = rows_peaks[0], rows_peaks[-1]
    x0, x1 = cols_peaks[0], cols_peaks[-1]
    print(f'\nboard bbox: x {x0}-{x1} (w={x1-x0}), y {y0}-{y1} (h={y1-y0})')
    print(f'pitch se 8x8: {(x1-x0)/8:.1f} x {(y1-y0)/8:.1f}')
    # campiona cella vuota al centro della prima riga
    # salva crop per ispezione
    im.crop((x0-30, y0-30, x1+30, y1+30)).save('/tmp/board-crop.png')
    # profilo di luminanza lungo colonna centrale della board: minime = celle, massime = separatori
    xc = (x0+x1)//2
    prof = [sum(px[xc, y][:3])/3 for y in range(y0+5, y1-5)]
    # trova i massimi locali (separatori luminosi)
    peaks = [i+y0+5 for i in range(2, len(prof)-2)
             if prof[i] > prof[i-2]+8 and prof[i] > prof[i+2]+8 and prof[i] > 40]
    print('separatori righe (peak luminanza):', group(peaks, 3))
    xr0 = x0 + (x1-x0)//16  # colonna dentro prima cella
    profx = [sum(px[x, (y0+y1)//2][:3])/3 for x in range(x0+5, x1-5)]
    peaksx = [i+x0+5 for i in range(2, len(profx)-2)
              if profx[i] > profx[i-2]+8 and profx[i] > profx[i+2]+8 and profx[i] > 40]
    print('separatori colonne:', group(peaksx, 3))
