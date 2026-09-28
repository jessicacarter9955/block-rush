#!/usr/bin/env python3
"""Dump full C3 event block structure to decode conditions/actions format."""
import json

with open('/home/z/my-project/game_data.json') as f:
    proj = json.load(f)
if not isinstance(proj, list):
    proj = proj['project']

sheets = proj[6]
game = sheets[0]
events = game[1]

# Event block: [3, [True, name], False, None, id, line, CONDITIONS?, ACTIONS?, SUBS?]
ev = events[22]
print("LEN:", len(ev))
for i, el in enumerate(ev):
    if isinstance(el, list):
        print(f"--- elem[{i}] list len={len(el)}")
        for j, sub in enumerate(el[:3]):
            print(f"    [{j}]: {json.dumps(sub)[:300]}")
    else:
        print(f"--- elem[{i}]: {el!r}")
