#!/usr/bin/env python3
"""Sample the red tray piece and yellow blocks precisely + block bevel profile."""
from PIL import Image
from collections import Counter

im = Image.open('/tmp/rush-img/img00.png').convert('RGB')
W, H = im.size
px = im.load()

# tray area: find saturated red region below y=1700
reds = Counter()
for y in range(1700, 2350, 2):
    for x in range(0, W, 2):
        r, g, b = px[x, y]
        if r > 110 and g < 90 and b < 90 and r - max(g, b) > 50:
            reds[(r // 8 * 8, g // 8 * 8, b // 8 * 8)] += 1
print('red bins:', [(f'#{r:02X}{g:02X}{b:02X}', n) for (r, g, b), n in reds.most_common(6)])

# yellow anywhere
yellows = Counter()
for y in range(400, 2200, 2):
    for x in range(0, W, 2):
        r, g, b = px[x, y]
        if r > 190 and g > 170 and b < 90 and r - b > 120:
            yellows[(r // 8 * 8, g // 8 * 8, b // 8 * 8)] += 1
print('yellow bins:', [(f'#{r:02X}{g:02X}{b:02X}', n) for (r, g, b), n in yellows.most_common(5)])

# magenta + cyan exact
mags, cyans, greens = Counter(), Counter(), Counter()
for y in range(400, 2200, 2):
    for x in range(0, W, 2):
        r, g, b = px[x, y]
        if r > 150 and b > 150 and g < 80:
            mags[(r // 8 * 8, g // 8 * 8, b // 8 * 8)] += 1
        if g > 140 and b > 140 and r < 70:
            cyans[(r // 8 * 8, g // 8 * 8, b // 8 * 8)] += 1
        if g > 150 and r < 90 and b < 90:
            greens[(r // 8 * 8, g // 8 * 8, b // 8 * 8)] += 1
print('magenta bins:', [(f'#{r:02X}{g:02X}{b:02X}', n) for (r, g, b), n in mags.most_common(4)])
print('cyan bins:', [(f'#{r:02X}{g:02X}{b:02X}', n) for (r, g, b), n in cyans.most_common(4)])
print('green bins:', [(f'#{r:02X}{g:02X}{b:02X}', n) for (r, g, b), n in greens.most_common(4)])

# vertical profile through a clean orange block (r1c5): x = 72+5*128.25+64, y across cell
bx = int(72 + 5 * 128.25 + 64)
print('\nvertical profile of orange block r1c5 (x=%d):' % bx)
for i in range(0, 11):
    yy = int(502 + 1 * 128.25 + i * 128.25 / 10)
    print('  %3d%%: #%02X%02X%02X' % (i * 10, *px[bx, yy]))
