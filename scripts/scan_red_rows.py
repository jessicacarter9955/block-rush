#!/usr/bin/env python3
"""Scansione verticale fine sulla colonna centrale (strip caramelle) e colonna 0
per mappare le righe esatte della board del mockup rosso."""
import numpy as np
from PIL import Image

im = Image.open('/home/z/my-project/upload/pasted_image_1789654565369.png').convert('RGB')
a = np.asarray(im).astype(np.int32)

def hexof(px):
    return '#%02X%02X%02X' % tuple(int(round(v)) for v in px)

def probe(x, y):
    x, y = int(x), int(y)
    return a[max(0, y - 3):y + 4, max(0, x - 3):x + 4].reshape(-1, 3).mean(axis=0)

print('=== striscia verticale x=835 (centro colonna 4) y 600..2150 step 12 ===')
prev = None
for y in range(600, 2151, 12):
    c = probe(835, y)
    h = hexof(c)
    if prev is None or np.linalg.norm(c - prev) > 40:
        print(f'  y={y}: {h}  <- cambio')
    prev = c

print()
print('=== striscia verticale x=259 (colonna 0, celle vuote) y 600..2150 step 12 ===')
prev = None
for y in range(600, 2151, 12):
    c = probe(259, y)
    h = hexof(c)
    if prev is None or np.linalg.norm(c - prev) > 40:
        print(f'  y={y}: {h}')
    prev = c

print()
print('=== striscia orizzontale y=1270 (centro riga 4 ipotetica) x 100..1450 step 10 ===')
prev = None
for x in range(100, 1451, 10):
    c = probe(x, 1270)
    h = hexof(c)
    if prev is None or np.linalg.norm(c - prev) > 40:
        print(f'  x={x}: {h}')
    prev = c

# bordi board: trova estremi orizzontali della zona celle (colore base brillante vs sfondo)
print()
print('=== bordi board orizzontali y=1000 ===')
for x in (60, 100, 140, 160, 175, 185, 200, 1340, 1350, 1370, 1390, 1420, 1460):
    print(f'  x={x}:', hexof(probe(x, 1000)))
print('=== bordi board verticali x=768 ===')
for y in (560, 580, 600, 620, 640, 655, 2050, 2070, 2090, 2110, 2130, 2150):
    print(f'  y={y}:', hexof(probe(768, y)))
