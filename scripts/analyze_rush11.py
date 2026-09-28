#!/usr/bin/env python3
"""Probe pixel dei due screen Block Rush 1:1 (941x1672, 942x1670).
Trova: colori sfondo, griglia board, celle vuote, colori blocchi, posizioni UI."""
from PIL import Image
import sys

S1 = '/home/z/my-project/uploads-inbox/20260928-134738-screen-1-0.png'  # gameplay
S2 = '/home/z/my-project/uploads-inbox/20260928-134738-screen-2-1.png'  # home

def hexc(px):
    return '#%02X%02X%02X' % px[:3]

def probe(im, name):
    W, H = im.size
    px = im.load()
    print(f'=== {name} {W}x{H} ===')
    # campioni angoli e centro (sfondo)
    pts = [(30, 30), (W-30, 30), (30, H-30), (W-30, H-30), (W//2, 60), (W//2, H-40), (W//2, H//2)]
    for x, y in pts:
        print(f'  bg({x},{y}) = {hexc(px[x,y])}')

    # scansiona colonna centrale per trovare board (righe: dove il colore cambia)
    # board = area celle scure quasi nere
    x = W // 2
    runs = []
    cur = None
    for y in range(0, H, 2):
        r, g, b = px[x, y][:3]
        dark = r < 60 and g < 60 and b < 80
        if dark and cur is None:
            cur = y
        elif not dark and cur is not None:
            if y - cur > 40:
                runs.append((cur, y))
            cur = None
    if cur is not None and H - cur > 40:
        runs.append((cur, H))
    print(f'  strisce scure su colonna centrale: {runs}')

    # scansione riga in zona board per bordi orizzontali
    return px

im1 = Image.open(S1).convert('RGB')
im2 = Image.open(S2).convert('RGB')
probe(im1, 'SCREEN1 gameplay')
probe(im2, 'SCREEN2 home')

# ---- griglia board su screen1: trova colonne/righe celle ----
im = im1
W, H = im.size
px = im.load()

# varianza per riga/colonna: le celle hanno bordi → pattern periodico
import statistics
def row_profile(y0, y1):
    # media luminanza per colonna in banda
    prof = []
    for x in range(0, W):
        vals = []
        for y in range(y0, y1, 4):
            r, g, b = px[x, y][:3]
            vals.append(r+g+b)
        prof.append(sum(vals)/len(vals) if vals else 0)
    return prof

def col_profile(x0, x1):
    prof = []
    for y in range(0, H):
        vals = []
        for x in range(x0, x1, 4):
            r, g, b = px[x, y][:3]
            vals.append(r+g+b)
        prof.append(sum(vals)/len(vals) if vals else 0)
    return prof

# ipotesi: board tra y 500 e y 1400 (dalle strisce scure), centrata
# prendiamo la banda scura più grande
print('\n=== ricerca bordi board (screen1) ===')
# bordo board = linea luminosa ciano → cerca righe con alta componente blu-verde
for y in range(300, 1500, 1):
    r, g, b = px[W//2, y][:3]
    if b > 150 and g > 130 and r < 120:  # ciano luminoso
        print(f'  riga ciano y={y} rgb=({r},{g},{b})')
for x in range(0, W, 1):
    r, g, b = px[x, 800][:3]
    if b > 150 and g > 130 and r < 120:
        print(f'  col ciano x={x} rgb=({r},{g},{b})')
