#!/usr/bin/env python3
"""Extract candidate empty cells with the CORRECT grid and inspect them."""
from PIL import Image

SRC = 'upload/pasted_image_1789654565369.png'
img = Image.open(SRC).convert('RGB')
W, H = img.size
sx, sy = W / 1080, H / 1920

# grid: cols edges x = [77,193,309,424,540,655,773,887,1004]  (9 edges, 8 cols)
# rows edges y = [330,454,580,703,826,947,1071,1198,1321]     (9 edges, 8 rows)
CE = [77, 193, 309, 424, 540, 655, 773, 887, 1004]
RE = [330, 454, 580, 703, 826, 947, 1071, 1198, 1321]

def cellcrop(r, c, pad=2):
    x0 = (CE[c] - pad) * sx; x1 = (CE[c + 1] + pad) * sx
    y0 = (RE[r] - pad) * sy; y1 = (RE[r + 1] + pad) * sy
    return img.crop((int(x0), int(y0), int(x1), int(y1)))

# stats for every cell: mean lum + std → find emptiest (uniform mid-red, no blocks)
import statistics
print('cell stats (r,c): meanLum / std / avg hex')
results = []
for r in range(8):
    for c in range(8):
        cx0, cy0 = int((CE[c] + 12) * sx), int((RE[r] + 12) * sy)
        cx1, cy1 = int((CE[c + 1] - 12) * sx), int((RE[r + 1] - 12) * sy)
        vals = [img.getpixel((x, y)) for x in range(cx0, cx1, 4) for y in range(cy0, cy1, 4)]
        lums = [sum(v) / 3 for v in vals]
        mean = sum(lums) / len(lums)
        std = statistics.pstdev(lums)
        mr = sum(v[0] for v in vals) // len(vals)
        mg = sum(v[1] for v in vals) // len(vals)
        mb = sum(v[2] for v in vals) // len(vals)
        results.append((r, c, mean, std, f'#{mr:02X}{mg:02X}{mb:02X}'))
        print(f'  ({r},{c}): {mean:5.1f} / {std:5.1f} / #{mr:02X}{mg:02X}{mb:02X}')

# save candidate crops: cells that are dark-red uniform (empty look)
cands = [x for x in results if x[2] < 110 and x[3] < 22]
cands.sort(key=lambda x: x[3])
print('\nbest empty candidates:', [(x[0], x[1]) for x in cands[:6]])
for i, (r, c, m, s, h) in enumerate(cands[:4]):
    cc = cellcrop(r, c)
    cc = cc.resize((384, 384), Image.LANCZOS)
    cc.save(f'download/ref-analysis/cand-{i}-r{r}c{c}.png')
    print(f'saved cand-{i}: r{r}c{c} {h}')
