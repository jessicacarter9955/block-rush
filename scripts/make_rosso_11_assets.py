#!/usr/bin/env python3
"""Asset pixel-perfect per il preset 'Block Blast Rosso 1:1'.
Usa SOLO materiale reale estratto dallo screenshot dell'utente:
- bg: bg-clean-rosso.png (1080x1920, sfondo vero ripulito) -> jpg
- blocchi: choco-shot-0..6 (129x139) centrati-crop quadrati -> 256x256 + choco-shot-7
- cella: ref-analysis/cell-rosso.png (estrazione reale)
- vassoio: ref-analysis/tray-rosso.png (estrazione reale)
"""
from PIL import Image
import os

BASE = '/home/z/my-project'
OUT = f'{BASE}/public/textures/candy'
os.makedirs(OUT, exist_ok=True)

# 1) background reale -> jpg compresso
bg = Image.open(f'{BASE}/download/ref-analysis/bg-clean-rosso.png').convert('RGB')
bg.save(f'{OUT}/bg-rosso-1-1.jpg', quality=90)
print('bg-rosso-1-1.jpg', bg.size)

# 2) blocchi: normalizza a quadrato 256x256 (centro-crop del lato minore)
for i in range(8):
    src = Image.open(f'{BASE}/public/textures/choco-shot-{i}.png')
    if src.mode != 'RGBA':
        # choco-shot 0..6 sono RGB: ritaglio del blocco con piccola eps di bordo
        src = src.convert('RGBA')
    w, h = src.size
    if w != h:
        side = min(w, h)
        x0 = (w - side) // 2
        y0 = (h - side) // 2
        src = src.crop((x0, y0, x0 + side, y0 + side))
    src = src.resize((256, 256), Image.LANCZOS)
    src.save(f'{OUT}/block-rosso-{i}.png')
    print(f'block-rosso-{i}.png', src.size, src.mode)

# 3) cella reale (estrazione dallo screenshot, non ricolorata)
cell = Image.open(f'{BASE}/download/ref-analysis/cell-rosso.png').convert('RGB')
cell.save(f'{OUT}/cell-rosso-1-1.png')
print('cell-rosso-1-1.png', cell.size)

# 4) vassoio reale
tray = Image.open(f'{BASE}/download/ref-analysis/tray-rosso.png').convert('RGBA')
tray.save(f'{OUT}/tray-rosso-1-1.png')
print('tray-rosso-1-1.png', tray.size)
print('done')
