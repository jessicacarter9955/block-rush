#!/usr/bin/env python3
"""Verify port shapes.dart vs original_shapes.json (5x5 grids)."""
import json
import re

shapes = json.load(open('/home/z/my-project/original_shapes.json'))['Shapes']
print('original shapes:', len(shapes))

src = open('/home/z/my-project/best-block-blast/lib/game/shapes.dart').read()
start = src.index('kShapes = [') + len('kShapes = ')
# find matching bracket
depth = 0
i = start
while i < len(src):
    if src[i] == '[':
        depth += 1
    elif src[i] == ']':
        depth -= 1
        if depth == 0:
            break
    i += 1
list_src = src[start:i + 1]
list_src = re.sub(r'//[^\n]*', '', list_src)
list_src = re.sub(r',\s*([\]}])', r'\1', list_src)
port_shapes = json.loads(list_src.replace('const', ''))
print('port shapes:', len(port_shapes))


def to_grid(shape):
    g = [[0] * 5 for _ in range(5)]
    for r, row in enumerate(shape):
        for c, v in enumerate(row):
            if r < 5 and c < 5:
                g[r][c] = v
    return g


mismatches = 0
for i in range(max(len(shapes), len(port_shapes))):
    if i >= len(shapes) or i >= len(port_shapes):
        print(f'shape {i}: MISSING in one list')
        mismatches += 1
        continue
    og = shapes[i]
    pg = to_grid(port_shapes[i])
    if og != pg:
        mismatches += 1
        print(f'shape {i} MISMATCH: orig={og} port={pg}')
print('mismatches:', mismatches)
