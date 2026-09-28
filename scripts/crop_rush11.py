#!/usr/bin/env python3
"""Ritaglia le zone chiave dei due screen per estrazione pixel perfect."""
from PIL import Image

S1 = '/home/z/my-project/uploads-inbox/20260928-134738-screen-1-0.png'
S2 = '/home/z/my-project/uploads-inbox/20260928-134738-screen-2-1.png'
im1 = Image.open(S1).convert('RGB')
im2 = Image.open(S2).convert('RGB')

# SCREEN 1 (gameplay) — board x56-880 y341-1168 pitch 103
crops1 = {
    'top-ui':    (0, 0, 941, 345),        # corona + score + pausa
    'board':     (30, 315, 906, 1195),    # board completa con bordo
    'tray':      (0, 1195, 941, 1672),    # vassoio + pezzo
    'cell-sample': (60, 345, 270, 555),   # celle vuote angolo alto-sx
}
for name, box in crops1.items():
    im1.crop(box).save(f'/tmp/s1-{name}.png')
    print(f's1-{name} {box}')

# SCREEN 2 (home)
W, H = im2.size
crops2 = {
    'top':    (0, 0, 942, 420),
    'logo':   (140, 380, 810, 1000),
    'mid':    (0, 950, 942, 1300),
    'bottom': (0, 1250, 942, 1670),
}
for name, box in crops2.items():
    im2.crop(box).save(f'/tmp/s2-{name}.png')
    print(f's2-{name} {box}')

# probe colori celle vuote (board interna, zona sicura senza blocchi: angolo alto-sx)
px = im1.load()
print('\n--- celle vuote (angolo alto-sx board) ---')
for cy in range(2):
    for cx in range(3):
        x = 56 + cx*103 + 51
        y = 341 + cy*103 + 51
        print(f'  cell({cx},{cy}) centro ({x},{y}) = #%02X%02X%02X' % px[x, y][:3])
        # angoli interni della cella
        for dx, dy in [(15,15),(88,15),(15,88),(88,88),(51,15),(51,88),(15,51),(88,51)]:
            x2, y2 = 56+cx*103+dx, 341+cy*103+dy
            print(f'      ({dx},{dy}) = #%02X%02X%02X' % px[x2, y2][:3])
