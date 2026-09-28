#!/usr/bin/env python3
"""Restore original block colors + extract missing sprites (logo, NoSpaceLeft, TLabels)
from the original Construct 3 sprite sheets into the repo's assets/sprites-named/.
Follows the existing extraction convention: full sprite with 2px padding (clamped)."""
import json
import os
from PIL import Image

ORIG = '/home/z/my-project/original-assets'
DEST = '/home/z/my-project/best-block-blast/assets/sprites-named'
PAD = 2

block_sheet = Image.open(f'{ORIG}/block-sheet0.png').convert('RGBA')
sheets = {
    0: Image.open(f'{ORIG}/shared-0-sheet0.png').convert('RGBA'),
    1: Image.open(f'{ORIG}/shared-0-sheet1.png').convert('RGBA'),
    2: Image.open(f'{ORIG}/shared-0-sheet2.png').convert('RGBA'),
    3: Image.open(f'{ORIG}/shared-0-sheet3.png').convert('RGBA'),
}

def extract(sheet, sx, sy, sw, sh, name):
    """Extract sprite with PAD clamped at sheet borders; save as name."""
    x0 = max(0, sx - PAD)
    y0 = max(0, sy - PAD)
    x1 = min(sheet.width, sx + sw + PAD)
    y1 = min(sheet.height, sy + sh + PAD)
    region = sheet.crop((x0, y0, x1, y1))
    region.save(f'{DEST}/{name}.png')
    return region.width, region.height

manifest_path = f'{DEST}/manifest.json'
manifest = json.load(open(manifest_path))

# --- 1. Restore original Block + BlockBelow (8 frames each, same order as data.json) ---
# Original Block frame order in data.json (sheet coords, 125x125 each):
block_positions = [(129, 385), (1, 385), (129, 257), (1, 257),
                   (129, 129), (1, 129), (129, 1), (1, 1)]
for i, (sx, sy) in enumerate(block_positions):
    w, h = extract(block_sheet, sx, sy, 125, 125, f'Block-f{i:02d}')
    extract(block_sheet, sx, sy, 125, 125, f'BlockBelow-f{i:02d}')
    print(f'Block-f{i:02d} restored {w}x{h}')

# --- 2. Extract missing sprites ---
new_sprites = [
    # (object, frame, sheet_idx, srcx, srcy, w, h, file)
    ('Sprite2',      0, 0, 1117, 68,   837, 888, 'Sprite2-f00'),
    ('NoSpaceLeft',  0, 1, 38,   975,  609, 180, 'NoSpaceLeft-f00'),
    ('TLabel',       0, 3, 137,  55,   146, 45,  'TLabel-f00'),
    ('TLabel',       1, 2, 969,  1661, 262, 45,  'TLabel-f01'),
]
existing_objects = {e['object'] for e in manifest}
for obj, frame, sidx, sx, sy, sw, sh, fname in new_sprites:
    w, h = extract(sheets[sidx], sx, sy, sw, sh, fname)
    print(f'{fname} extracted {w}x{h}')
    # Replace or add manifest entry
    manifest = [e for e in manifest if not (e['object'] == obj and e['frame'] == frame)]
    manifest.append({
        'object': obj, 'animation': 'Animation 1', 'frame': frame,
        'sheet': 'extracted', 'src_x': 0, 'src_y': 0, 'src_w': w, 'src_h': h,
        'file': f'assets/sprites-named/{fname}.png',
    })

json.dump(manifest, open(manifest_path, 'w'), indent=2)
print('manifest updated:', len(manifest), 'entries')

# --- 3. Copy ranking.json as asset for the Flutter port ---
import shutil
os.makedirs('/home/z/my-project/best-block-blast/assets/data', exist_ok=True)
shutil.copy('/home/z/my-project/ranking.json', '/home/z/my-project/best-block-blast/assets/data/ranking.json')
print('ranking.json copied to assets/data/')
