#!/usr/bin/env python3
"""Check all repo sprites vs data.json frames: find rotated frames and broken extractions."""
import json
import os
from PIL import Image

proj = json.load(open('/home/z/my-project/game_data.json'))['project']
DEST = '/home/z/my-project/best-block-blast/assets/sprites-named'

# Collect all frames: object -> [(frameIdx, file, size, offsetX, offsetY, w, h, isRotated)]
frames = {}
for t in proj[3]:
    name = t[0]
    try:
        anims = t[7] or []
    except Exception:
        continue
    if not anims:
        continue
    idx = 0
    for a in anims:
        for fr in a[7]:
            frames.setdefault(name, []).append((idx, fr[0], fr[1], fr[2], fr[3], fr[4], fr[5], fr[6]))
            idx += 1

print(f'{"object":18s} {"frame":5s} {"rot":5s} {"expected":11s} {"repo file":12s} {"actual":11s} status')
broken = []
for name, fl in sorted(frames.items()):
    for (idx, file, size, ox, oy, w, h, rot) in fl:
        fname = f'{name}-f{idx:02d}.png'
        path = os.path.join(DEST, fname)
        if not os.path.exists(path):
            continue
        im = Image.open(path)
        ok = (im.width == w and im.height == h)
        status = 'OK' if ok else f'MISMATCH (exp {w}x{h})'
        if not ok:
            broken.append((name, idx, file, size, ox, oy, w, h, rot, fname))
        print(f'{name:18s} {idx:5d} {str(rot):5s} {w}x{h:5d}   {fname:12s} {im.width}x{im.height:5d}  {status}')

print()
print('BROKEN/ROTATED summary:')
for b in broken:
    name, idx, file, size, ox, oy, w, h, rot, fname = b
    print(f'  {fname}: expected {w}x{h} rotated={rot} at ({ox},{oy}) in {file}')
