#!/usr/bin/env python3
"""Draw a labeled coordinate grid on the screenshot for VLM localization."""
from PIL import Image, ImageDraw, ImageFont

im = Image.open('/home/z/my-project/upload/pasted_image_1789462065369.png').convert('RGB')
W, H = im.size
dr = ImageDraw.Draw(im)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 42)
except Exception:
    font = ImageFont.load_default()

# grid every 256px, labels at intersections
for x in range(0, W + 1, 256):
    dr.line([(x, 0), (x, H)], fill=(255, 0, 255), width=2)
    dr.text((x + 6, 8), str(x), fill=(255, 0, 255), font=font)
for y in range(0, H + 1, 256):
    dr.line([(0, y), (W, y)], fill=(255, 0, 255), width=2)
    dr.text((6, y + 6), str(y), fill=(255, 0, 255), font=font)

im.save('/tmp/annotated.png')
print('saved /tmp/annotated.png', im.size)
