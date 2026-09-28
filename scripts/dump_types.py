#!/usr/bin/env python3
"""Dump full object type entries from C3 data.json."""
import json

with open('/home/z/my-project/game_data.json') as f:
    proj = json.load(f)
if not isinstance(proj, list):
    proj = proj['project']

types = proj[3]
# Print the shape of the first few object types
for t in types[:3]:
    print("="*70)
    print("NAME:", t[0])
    for i, el in enumerate(t):
        if isinstance(el, list):
            print(f"  [{i}] list len={len(el)}: {json.dumps(el[:2])[:200]}")
        else:
            print(f"  [{i}]: {el!r}")
print()
print("ALL 87 TYPE NAMES:")
for i, t in enumerate(types):
    print(f"  {i:2d} {t[0]}")
