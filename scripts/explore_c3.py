#!/usr/bin/env python3
"""Explore the Construct 3 data.json structure of the original Block Blast."""
import json, sys

with open('/home/z/my-project/game_data.json') as f:
    data = json.load(f)

proj = data['project'] if isinstance(data, dict) and 'project' in data else data

print("TYPE:", type(proj))
if isinstance(proj, list):
    print("LEN:", len(proj))
    for i, item in enumerate(proj):
        t = type(item).__name__
        if isinstance(item, str):
            print(f"[{i}] str: {item[:80]!r}")
        elif isinstance(item, (int, float, bool)):
            print(f"[{i}] {t}: {item}")
        elif isinstance(item, list):
            print(f"[{i}] list len={len(item)}", "first:", str(item[0])[:60] if item else "")
        elif isinstance(item, dict):
            print(f"[{i}] dict keys={list(item.keys())[:15]}")
        elif item is None:
            print(f"[{i}] None")
