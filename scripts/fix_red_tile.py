#!/usr/bin/env python3
"""Rifà la tessera rossa (choco-7-rosso.png / choco-shot-7.png) estraendola dal
quadrato SINISTRO del pezzo 3-barre nel vassoio — l'unico non coperto dal
guanto/dito. Aggiorna anche report.json e genera il confronto prima/dopo."""
import json
import shutil

import numpy as np
from PIL import Image, ImageDraw

SRC = '/home/z/my-project/upload/pasted_image_1789462065369.png'
OUT = '/home/z/my-project/download/choco-extract'
BUNDLED = '/home/z/my-project/public/textures/choco-shot-7.png'

# pezzo rosso nel vassoio (da analyze_red_tray.py): x 542-968, y 2003-2152
x0, y0, x1, y1 = 542, 2003, 968, 2152
pw = (x1 - x0) / 3
pad = pw * 0.07  # stesso padding della v4

im = Image.open(SRC).convert('RGB')

# --- backup vecchia tessera ---
shutil.copy(f'{OUT}/choco-7-rosso.png', f'{OUT}/choco-7-rosso-VECCHIA.png')

# --- estrazione quadrato SINISTRO (indice 0), come la v4 ma slot 0 ---
box = (int(x0 + pad), int(y0 + pad), int(x0 + pw - pad), int(y1 - pad))
tile = im.crop(box)
tile.save(f'{OUT}/choco-7-rosso.png')
tile.save(BUNDLED)
arr = np.asarray(tile).reshape(-1, 3)
mean = arr.mean(axis=0)

# campione centrale 18% (come il clustering della v4)
w, h = tile.size
cx0, cy0 = int(w * 0.41), int(h * 0.41)
cx1, cy1 = int(w * 0.59), int(h * 0.59)
center = np.asarray(tile)[cy0:cy1, cx0:cx1].reshape(-1, 3).mean(axis=0)

hexc = '#%02X%02X%02X' % tuple(int(round(v)) for v in mean)
hexc_center = '#%02X%02X%02X' % tuple(int(round(v)) for v in center)
print(f'nuova tessera rossa: {tile.size}  media={hexc}  centro={hexc_center}')

# --- report.json: aggiorna/aggiungi voce rosso + nomi gusti corretti ---
with open(f'{OUT}/report.json') as f:
    report = json.load(f)

FLAVORS = {  # nomi REALI per gusto (i filename storici sono per indice di cluster)
    'choco-0-rosa.png': 'latte (marrone chiaro)',
    'choco-1-giallo.png': 'lampone (rosso-rosa)',
    'choco-2-verde.png': 'caramello (giallo)',
    'choco-3-latte.png': 'lime (verde)',
    'choco-4-arancio.png': 'arancio',
    'choco-5-fondente.png': 'menta (verde acqua)',
    'choco-6-menta.png': 'fondente (marrone scuro)',
    'choco-7-rosso.png': 'rosso (pezzo vassoio)',
}
BUNDLED_MAP = {  # quale texture bundled corrisponde a quale file
    'choco-0-rosa.png': 'choco-shot-3.png',
    'choco-1-giallo.png': 'choco-shot-0.png',
    'choco-2-verde.png': 'choco-shot-1.png',
    'choco-3-latte.png': 'choco-shot-2.png',
    'choco-4-arancio.png': 'choco-shot-4.png',
    'choco-5-fondente.png': 'choco-shot-6.png',
    'choco-6-menta.png': 'choco-shot-5.png',
    'choco-7-rosso.png': 'choco-shot-7.png',
}
for c in report['colors']:
    fn = c['file']
    c['flavor'] = FLAVORS.get(fn, '')
    c['bundled'] = BUNDLED_MAP.get(fn, '')

report['colors'] = [c for c in report['colors'] if c['file'] != 'choco-7-rosso.png']
report['colors'].append({
    'idx': 7,
    'hex': hexc,
    'file': 'choco-7-rosso.png',
    'origin': 'tray, quadrato sinistro (il centrale e il destro erano coperti dal guanto/dito)',
    'crop_hex': hexc,
    'center_hex': hexc_center,
    'size': list(tile.size),
    'count': 0,
    'flavor': 'rosso (pezzo vassoio)',
    'bundled': 'choco-shot-7.png',
    'note': 'riestratta: la versione precedente conteneva il dito/guanto',
})
report['note'] = ('La tessera rossa e stata riestratta dal quadrato sinistro del pezzo '
                  'nel vassoio perche centrale e destro erano coperti dal dito/guanto.')
with open(f'{OUT}/report.json', 'w') as f:
    json.dump(report, f, indent=2, ensure_ascii=False)

# --- immagine di confronto prima/dopo (2x, con etichette) ---
old = Image.open(f'{OUT}/choco-7-rosso-VECCHIA.png').convert('RGB')
new = tile
S = 2
ow, oh = old.size[0] * S, old.size[1] * S
nw, nh = new.size[0] * S, new.size[1] * S
H = max(oh, nh)
cmp_im = Image.new('RGB', (ow + nw + 90, H + 110), (24, 24, 32))
d = ImageDraw.Draw(cmp_im)
old_r = old.resize((ow, oh))
new_r = new.resize((nw, nh))
cmp_im.paste(old_r, (30, 80))
cmp_im.paste(new_r, (ow + 60, 80))
try:
    from PIL import ImageFont
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
    font_s = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 22)
except OSError:
    font = font_s = None
d.text((30, 20), 'PRIMA (dito/guanto)', fill=(255, 120, 120), font=font)
d.text((ow + 60, 20), 'DOPO (quadrato sinistro)', fill=(120, 255, 160), font=font)
d.text((30, H + 82), 'rosso vassoio #C23C54 → ' + hexc, fill=(200, 200, 210), font=font_s)
cmp_im.save(f'{OUT}/choco-7-confronto.png')
print('confronto salvato:', f'{OUT}/choco-7-confronto.png', cmp_im.size)

# pulizia file di debug
import os
for f_ in ['debug-tray-region.png', 'debug-red-sq0.png', 'debug-red-sq1.png', 'debug-red-sq2.png']:
    p = f'{OUT}/{f_}'
    if os.path.exists(p):
        os.remove(p)
print('done')
