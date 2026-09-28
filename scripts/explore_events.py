#!/usr/bin/env python3
"""Dump the C3 event sheet structure of the original Block Blast."""
import json

with open('/home/z/my-project/game_data.json') as f:
    data = json.load(f)
proj = data if isinstance(data, list) else data['project']

sheets = proj[6]
print("SHEETS:", [s[0] for s in sheets])
sheet = sheets[0]  # GameSheet
print("\n=== GameSheet top-level entries ===")
print("name:", sheet[0])
for i, item in enumerate(sheet[1]):
    if isinstance(item, list):
        head = str(item[0]) if item else ''
        print(f"  [{i}] list len={len(item)} first-elem={head!r} :: {str(item[:6])[:150]}")
    else:
        print(f"  [{i}] {type(item).__name__}: {str(item)[:100]}")
