#!/usr/bin/env python3
"""Overview sheet of the two demo praline tile sets (flat + isometric).
Output: download/skin-studio/tessere-demo-cioccolatini.png
"""
from PIL import Image, ImageDraw, ImageFont

FLAVORS = ['Lampone', 'Limone', 'Lime', 'Latte', 'Arancio', 'Menta', 'Fondente', 'Caramello']
SLUGS = ['lampone', 'limone', 'lime', 'latte', 'arancio', 'menta', 'fondente', 'caramello']

W, H = 1560, 860
BG = (16, 26, 76)
PANEL = (24, 34, 90)
INK = (240, 240, 248)
MUTED = (150, 160, 200)
GOLD = (212, 175, 55)

FB = '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'
FR = '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'
F_TITLE = ImageFont.truetype(FB, 38)
F_H = ImageFont.truetype(FB, 24)
F_B = ImageFont.truetype(FR, 17)
F_S = ImageFont.truetype(FR, 14)

img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)

d.text((50, 30), 'Cioccolatini — 2 set di tessere demo', font=F_TITLE, fill=INK)
d.text((50, 78), 'Stessi 8 gusti, due inquadrature. Nel pannello BLOCCHI → "Set demo" si applicano con un clic.',
       font=F_B, fill=MUTED)

def row(prefix, title, subtitle, y):
    d.text((50, y), title, font=F_H, fill=GOLD)
    d.text((50, y + 32), subtitle, font=F_S, fill=MUTED)
    for i, s in enumerate(SLUGS):
        t = Image.open(f'public/textures/{prefix}-{i}-{s}.png').convert('RGBA')
        S = 148
        t = t.resize((S, S), Image.LANCZOS)
        x = 50 + i * 185
        yy = y + 58
        d.rounded_rectangle([x - 4, yy - 4, x + S + 4, yy + S + 4], 16,
                            fill=PANEL, outline=(60, 70, 130), width=2)
        img.paste(t, (x, yy), t)
        d.text((x + S // 2 - 5 * len(FLAVORS[i]) // 2, yy + S + 10), FLAVORS[i], font=F_S, fill=INK)

row('praline', 'DALL\u2019ALTO  (flat)', 'vista esattamente dall\u2019alto \u2014 silhouette quadrata, come i blocchi originali', 120)
row('praline-iso', 'ISOMETRICA  (3/4)', 'vista inclinata ~35\u00b0 con spessore e lati visibili, come nel mockup', 430)

d.text((50, H - 40), 'Generate con AI (stesso identico cioccolatino, camera diversa) \u00b7 scontornate e normalizzate a 256\u00d7256 PNG trasparenti',
       font=F_S, fill=MUTED)

out = 'download/skin-studio/tessere-demo-cioccolatini.png'
img.save(out)
print('OK', out)
