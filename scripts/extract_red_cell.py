#!/usr/bin/env python3
"""Estrae una cella vuota pulita dal mockup rosso: individua il corpo rosso
(R>90) del componente connesso piu' grande in una zona di celle vuote,
crop quadrato + pad + 256x256. Genera anche un report dei colori medi."""
import numpy as np
from PIL import Image
from scipy import ndimage

im = Image.open('/home/z/my-project/upload/pasted_image_1789654565369.png').convert('RGB')
a = np.asarray(im).astype(np.int32)

# zona: colonne 0-2 (x 150..620), righe 0-2 (y 620..1120): tutte vuote
x0, y0, x1, y1 = 150, 620, 640, 1140
sub = a[y0:y1, x0:x1]
r = sub[..., 0]
cell_mask = r > 90  # corpo cella rosso vs base quasi nera

lab, n = ndimage.label(cell_mask)
sizes = ndimage.sum(cell_mask, lab, range(1, n + 1))
order = np.argsort(sizes)[::-1]
print(f'{n} componenti; top sizes: {sizes[order[:6]].astype(int)}')

best = None
for k in order[:6]:
    sl = ndimage.find_objects(lab == k + 1)[0]
    h_, w_ = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    if 100 < w_ < 220 and 100 < h_ < 220 and abs(w_ - h_) < 30:
        best = (k, sl, w_, h_)
        print(f'candidato cella: {w_}x{h_} at x {x0+sl[1].start} y {y0+sl[0].start}')
        break

if not best:
    raise SystemExit('nessuna cella trovata')

k, sl, w_, h_ = best
# crop con margine 2px dentro la bbox rilevata (la bbox include il bevel)
cx0, cy0 = x0 + sl[1].start, y0 + sl[0].start
side = max(w_, h_)
pad = 2
cell = im.crop((cx0 + pad, cy0 + pad, cx0 + w_ - pad, cy0 + h_ - pad))
cw, ch = cell.size
# pad quadrato con il colore della base (quasi nero rosso)
sq = Image.new('RGB', (side, side), (46, 2, 8))
sq.paste(cell, ((side - cw) // 2, (side - ch) // 2))
tile = sq.resize((256, 256), Image.LANCZOS)
tile.save('/home/z/my-project/public/textures/red-cell.png')
tile.save('/home/z/my-project/download/choco-extract/red-cell.png')

arr = np.asarray(tile).reshape(-1, 3)
print('cella media: #%02X%02X%02X' % tuple(int(v) for v in arr.mean(axis=0)))
# campiona: angolo alto-sx (bevel), centro, basso
t = np.asarray(tile)
print('bevel top: #%02X%02X%02X' % tuple(int(v) for v in t[18, 128]))
print('centro: #%02X%02X%02X' % tuple(int(v) for v in t[128, 128]))
print('fondo: #%02X%02X%02X' % tuple(int(v) for v in t[236, 128]))

# --- probe sfondo accurato (evitando UI): fasce laterali tra board e bordi ---
print()
print('=== SFONDO fasce laterali ===')
for y in (200, 500, 700, 1000, 1400, 1800, 2100, 2400, 2650):
    l = a[y, 70:95].mean(axis=0)
    rr = a[y, 1440:1465].mean(axis=0)
    print(f'  y={y}: L #%02X%02X%02X  R #%02X%02X%02X' % (*[int(v) for v in l], *[int(v) for v in rr]))
print('=== base board (gap) ===')
for (px_, py_) in ((259, 822), (259, 1170), (259, 1518), (150, 1000), (200, 660)):
    c = a[py_ - 3:py_ + 3, px_ - 3:px_ + 3].reshape(-1, 3).mean(axis=0)
    print(f'  ({px_},{py_}): #%02X%02X%02X' % tuple(int(v) for v in c))
