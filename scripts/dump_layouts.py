#!/usr/bin/env python3
"""Extract ALL layout instances: objType, x, y, w, h, per layer, per layout."""
import json

with open('/home/z/my-project/game_data.json') as f:
    proj = json.load(f)
if not isinstance(proj, list):
    proj = proj['project']

obj_names = [t[0] for t in proj[3]]
layouts = proj[5]

out = open('/home/z/my-project/download/original-layouts.txt', 'w')
def w(s=''):
    out.write(s + '\n')

for L in layouts:
    name, lw, lh = L[0], L[1], L[2]
    w(f'{"="*80}')
    w(f'LAYOUT {name} ({lw}x{lh})  sheet={L[7] if len(L)>7 else "?"}')
    w(f'{"="*80}')
    for lay in L[9]:
        lname = lay[0]
        visible = lay[3]
        opacity = lay[4]
        w(f'  LAYER "{lname}" visible={visible} opacity={opacity}')
        insts = lay[14] if len(lay) > 14 else []
        for inst in insts:
            d = inst[0]
            otype = inst[1] if len(inst) > 1 else '?'
            x, y = d[0], d[1]
            width, height = d[3], d[4]
            oname = obj_names[otype] if isinstance(otype, int) and otype < len(obj_names) else str(otype)
            extra = ''
            # instance data may contain instVar values at d[14]? check length
            if len(d) > 15:
                pass
            # inst vars initial values often at inst[2]? or in d beyond 15
            iv = inst[5] if len(inst) > 5 else None
            w(f'    {oname:22s} x={x:7.1f} y={y:7.1f} w={width:6.1f} h={height:6.1f}' + (f'  ivdata={str(iv)[:80]}' if iv else ''))
    w()

out.close()
print('written download/original-layouts.txt')
