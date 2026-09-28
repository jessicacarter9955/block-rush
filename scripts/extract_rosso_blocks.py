#!/usr/bin/env python3
"""Estrazione FINALE pixel-perfect dei blocchi dallo screenshot ROSSO dell'utente.
Geometria misurata: griglia x0=80 pitch 116 (caramella 102px), righe con bande
misurate per colore. Menta inclusa (r7!). Rosso dal pezzo nel vassoio
(choco-shot-7, già pulito). Ogni caramella → 256×256 con angoli arrotondati."""
from PIL import Image, ImageDraw
import numpy as np

BASE = '/home/z/my-project'
red = Image.open(f'{BASE}/upload/pasted_image_1789654090537.png').convert('RGB')
sx, sy = 1536 / 1080, 2730 / 1920
OUT = f'{BASE}/public/textures/candy'

# bande verticali misurate (design y, altezza) per la colonna 3
ROWS = {
    'rosa':     (482, 92),
    'giallo':   (586, 108),
    'lime':     (726, 92),
    'latte':    (850, 104),
    'arancio':  (1098, 92),
    'fondente': (1218, 100),
    'menta':    (1322, 96),
}
CANDY_X0, CANDY_W = 428, 102  # colonna 3: 80 + 3*116 = 428, caramella 102px

def crop_candy(dy0, dh):
    x0 = int(CANDY_X0 * sx); x1 = int((CANDY_X0 + CANDY_W) * sx)
    py0 = int(dy0 * sy); py1 = int((dy0 + dh) * sy)
    return red.crop((x0, py0, x1, py1))

def to_square_tile(im, size=256, radius=40):
    w, h = im.size
    side = max(w, h)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - w) // 2, (side - h) // 2))
    sq = sq.resize((size, size), Image.LANCZOS)
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    sq.putalpha(m)
    return sq

tiles = {}
for name, (y0, h) in ROWS.items():
    im = crop_candy(y0, h)
    tiles[name] = to_square_tile(im)
    arr = np.asarray(im)
    print(f'{name}: crop {im.size} mean {arr.reshape(-1, 3).mean(0).round(0)}')

# rosso: dal vassoio, già estratto pulito (RGBA flood-fill)
tiles['rosso'] = Image.open(f'{BASE}/public/textures/choco-shot-7.png').convert('RGBA').resize((256, 256), Image.LANCZOS)

FINAL = ['rosa', 'giallo', 'lime', 'latte', 'arancio', 'fondente', 'menta', 'rosso']
for i, name in enumerate(FINAL):
    tiles[name].save(f'{OUT}/block-rosso-{i}.png')

sheet = Image.new('RGB', (8 * 150 + 20, 340), (150, 12, 32))
for i, name in enumerate(FINAL):
    t = tiles[name]
    sheet.paste(t, (10 + i * 150, 30), t)
sheet.save(f'{BASE}/download/rosso-11/tiles-sheet.png')
print('saved 8 tiles + sheet')
