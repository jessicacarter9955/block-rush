#!/usr/bin/env python3
"""Re-extract all ROTATED frames correctly (crop h×w region, rotate 90° CCW).
Also re-extract the new sprites (NoSpaceLeft, TLabels) with rotation handling.
Updates manifest.json sizes."""
import json
import os
from PIL import Image

proj = json.load(open('/home/z/my-project/game_data.json'))['project']
ORIG = '/home/z/my-project/original-assets'
DEST = '/home/z/my-project/best-block-blast/assets/sprites-named'

sheets = {
    'images/shared-0-sheet0.png': Image.open(f'{ORIG}/shared-0-sheet0.png').convert('RGBA'),
    'images/shared-0-sheet1.png': Image.open(f'{ORIG}/shared-0-sheet1.png').convert('RGBA'),
    'images/shared-0-sheet2.png': Image.open(f'{ORIG}/shared-0-sheet2.png').convert('RGBA'),
    'images/shared-0-sheet3.png': Image.open(f'{ORIG}/shared-0-sheet3.png').convert('RGBA'),
    'images/block-sheet0.png': Image.open(f'{ORIG}/block-sheet0.png').convert('RGBA'),
}

# objects to (re)extract with correct rotation handling
targets = {
    'BtnGOReset', 'BtnHome', 'BtnMusic', 'BtnRevive', 'BtnSFX', 'BtnShowRanking',
    'Cheerful', 'GameOver', 'NoSpaceLeft', 'TLabel',
}

manifest_path = f'{DEST}/manifest.json'
manifest = json.load(open(manifest_path))

extracted = []
for t in proj[3]:
    name = t[0]
    if name not in targets:
        continue
    try:
        anims = t[7] or []
    except Exception:
        continue
    idx = 0
    for a in anims:
        for fr in a[7]:
            fname = f'{name}-f{idx:02d}.png'
            sheet = sheets[fr[0]]
            ox, oy, w, h, rot = fr[2], fr[3], fr[4], fr[5], fr[6]
            if rot:
                region = sheet.crop((ox, oy, ox + h, oy + w))   # in-sheet: h wide, w tall
                sprite = region.transpose(Image.ROTATE_90)        # 90° CCW -> w wide, h tall
            else:
                sprite = sheet.crop((ox, oy, ox + w, oy + h))
            sprite.save(f'{DEST}/{fname}')
            extracted.append((fname, sprite.width, sprite.height, rot))
            # fix manifest entry
            manifest = [e for e in manifest if not (e['object'] == name and e['frame'] == idx)]
            manifest.append({
                'object': name, 'animation': 'Animation 1', 'frame': idx,
                'sheet': 'extracted', 'src_x': 0, 'src_y': 0,
                'src_w': sprite.width, 'src_h': sprite.height,
                'file': f'assets/sprites-named/{fname}',
            })
            idx += 1

json.dump(manifest, open(manifest_path, 'w'), indent=2)
for e in extracted:
    print(f'{e[0]:22s} {e[1]}x{e[2]}  rotated={e[3]}')
print(f'\n{len(extracted)} sprites re-extracted; manifest: {len(manifest)} entries')
