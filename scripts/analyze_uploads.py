#!/usr/bin/env python3
"""Prepare uploaded images for VLM analysis: identify unique, resize, probe colors."""
import hashlib, os
from PIL import Image

UP = '/home/z/my-project/upload'
OUT = '/home/z/my-project/scripts/vlm_tmp'
os.makedirs(OUT, exist_ok=True)

files = sorted(f for f in os.listdir(UP) if f.endswith('.png'))
seen = {}
order = []
for f in files:
    p = os.path.join(UP, f)
    h = hashlib.md5(open(p, 'rb').read()).hexdigest()
    if h not in seen:
        seen[h] = f
        order.append((f, h, p))

print(f'{len(files)} files, {len(order)} unique\n')

for i, (f, h, p) in enumerate(order):
    img = Image.open(p).convert('RGB')
    w, ah = img.size
    scale = min(1.0, 900 / max(w, ah))
    if scale < 1.0:
        img = img.resize((int(w * scale), int(ah * scale)), Image.LANCZOS)
    small = os.path.join(OUT, f'uniq{i}.png')
    img.save(small, optimize=True)

    # dominant colors: sample grid
    small_copy = img.copy()
    quant = small_copy.resize((64, 64)).quantize(colors=6, method=Image.MEDIANCUT)
    pal = quant.getpalette()
    counts = sorted(quant.getcolors(), reverse=True)[:6]
    doms = []
    for cnt, idx in counts:
        r, g, b = pal[idx*3:idx*3+3]
        doms.append(f'#{r:02X}{g:02X}{b:02X} ({cnt/4096*100:.0f}%)')

    kb = os.path.getsize(small) // 1024
    print(f'[{i}] {f}  {w}x{ah} -> {img.size[0]}x{img.size[1]} ({kb}KB)')
    print(f'    dominant: {", ".join(doms)}')
