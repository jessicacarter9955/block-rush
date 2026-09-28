#!/usr/bin/env python3
"""Prepare web assets for the Block Blast Skin Studio (Next.js public/).

- Copies the 77 original sprites -> public/sprites/ (flat names)
- Fixes txtEarnedScore rotation (stored 128x512, true sheet is 512x128)
- Copies the 29 original mp3s -> public/audio/
- Copies local fonts (Riffic original + system) -> public/fonts/
- Downloads game-style Google fonts (woff2, latin) -> public/fonts/
- Probes original colors (board cells, bg gradient, buttons, icons)
- Generates src/lib/assets-data.ts (sprites, audio, shapes, ranking, colors)
"""
import json
import os
import re
import shutil
import urllib.request

ROOT = '/home/z/my-project'
SPRITES_SRC = f'{ROOT}/best-block-blast/assets/sprites-named'
AUDIO_SRC = f'{ROOT}/best-block-blast/assets/audio'
FONT_RIFFIC = f'{ROOT}/game-mirror/fonts/riffic-bold-webfont.woff2'
SHAPES_JSON = f'{ROOT}/original_shapes.json'
RANKING_JSON = f'{ROOT}/best-block-blast/assets/data/ranking.json'

PUB_S = f'{ROOT}/public/sprites'
PUB_A = f'{ROOT}/public/audio'
PUB_F = f'{ROOT}/public/fonts'
OUT_TS = f'{ROOT}/src/lib/assets-data.ts'

for d in (PUB_S, PUB_A, PUB_F):
    os.makedirs(d, exist_ok=True)
for sub in ('score', 'cheerful'):
    os.makedirs(f'{PUB_A}/{sub}', exist_ok=True)

# ---------------------------------------------------------------- sprites ---
manifest = json.load(open(f'{SPRITES_SRC}/manifest.json'))
sprites = {}  # object -> {w,h,frames:[url]}
for e in manifest:
    name = e['object']
    url = '/sprites/' + os.path.basename(e['file'])
    if e['object'] == 'txtEarnedScore':
        url = '/sprites/txtEarnedScore-fixed.png'
    sprites.setdefault(name, {'w': e['src_w'], 'h': e['src_h'], 'frames': []})
    sprites[name]['frames'].append(url)

copied = 0
for e in manifest:
    src = f"{SPRITES_SRC}/{os.path.basename(e['file'])}"
    dst = f"{PUB_S}/{os.path.basename(e['file'])}"
    shutil.copy2(src, dst)
    copied += 1

# --- fix rotated txtEarnedScore (true sheet: 512x128, charset 0-9 and +) ---
from PIL import Image  # noqa: E402

p = f'{PUB_S}/txtEarnedScore-f00.png'
img = Image.open(p).convert('RGBA')
fixed_path = f'{PUB_S}/txtEarnedScore-fixed.png'
if img.width < img.height:
    # stored transposed; rotate 90 deg CCW (same convention as
    # scripts/fix_rotated_sprites.py) to restore the true 512x128 sheet.
    img.transpose(Image.ROTATE_90).save(fixed_path)
    print(f'txtEarnedScore rotated -> {Image.open(fixed_path).size}')
    sprites['txtEarnedScore'] = {
        'w': 512, 'h': 128,
        'frames': ['/sprites/txtEarnedScore-fixed.png'],
    }
else:
    shutil.copy2(p, fixed_path)
    print(f'txtEarnedScore already ok {img.size}')

# ------------------------------------------------------------------ audio ---
audio_files = []
for dirpath, _dirs, files in os.walk(AUDIO_SRC):
    for f in sorted(files):
        if not f.endswith('.mp3'):
            continue
        rel = os.path.relpath(os.path.join(dirpath, f), AUDIO_SRC)[:-4]
        audio_files.append(rel)
        os.makedirs(os.path.dirname(f'{PUB_A}/{rel}.mp3'), exist_ok=True)
        shutil.copy2(f'{dirpath}/{f}', f'{PUB_A}/{rel}.mp3')
print(f'audio: {len(audio_files)} files')

# ------------------------------------------------------------------ fonts ---
shutil.copy2(FONT_RIFFIC, f'{PUB_F}/riffic-bold.woff2')
local_fonts = [
    ('/usr/share/fonts/truetype/english/Carlito-Bold.ttf', 'carlito-bold.ttf'),
    ('/usr/share/fonts/truetype/english/Carlito-Regular.ttf', 'carlito-regular.ttf'),
    ('/usr/share/fonts/truetype/english/Tinos-Bold.ttf', 'tinos-bold.ttf'),
    ('/usr/share/fonts/truetype/lxgw-wenkai/LXGWWenKai-Medium.ttf', 'wenkai-medium.ttf'),
    ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'dejavu-bold.ttf'),
    ('/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf', 'libmono-bold.ttf'),
]
for src, dst in local_fonts:
    shutil.copy2(src, f'{PUB_F}/{dst}')

UA = ('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/120.0.0.0 Safari/537.36')
css_url = ('https://fonts.googleapis.com/css2?'
           'family=Fredoka:wght@600;700'
           '&family=Baloo+2:wght@800'
           '&family=Luckiest+Guy'
           '&family=Bangers'
           '&family=Press+Start+2P'
           '&family=Lilita+One'
           '&display=swap')
req = urllib.request.Request(css_url, headers={'User-Agent': UA})
css = urllib.request.urlopen(req, timeout=20).read().decode()

blocks = re.findall(
    r'/\* (\w[\w-]*) \*/\s*@font-face\s*\{([^}]+)\}', css)
dl = []
for subset, body in blocks:
    if subset != 'latin':
        continue
    fam = re.search(r"font-family:\s*'([^']+)'", body).group(1)
    weight = re.search(r'font-weight:\s*(\d+)', body).group(1)
    url = re.search(r'src:\s*url\(([^)]+)\)', body).group(1)
    safe = fam.lower().replace(' ', '') + '-' + weight + '.woff2'
    dl.append((fam, weight, url, safe))

for fam, weight, url, safe in dl:
    r = urllib.request.Request(url, headers={'User-Agent': UA})
    data = urllib.request.urlopen(r, timeout=30).read()
    with open(f'{PUB_F}/{safe}', 'wb') as fh:
        fh.write(data)
    print(f'font: {fam} {weight} -> {safe} ({len(data)//1024} KB)')
print(f'google fonts: {len(dl)}')

# ----------------------------------------------------------------- probes ---
def avg_color(path, box=None):
    im = Image.open(path).convert('RGBA')
    if box:
        im = im.crop(box)
    im = im.resize((1, 1), Image.LANCZOS)
    r, g, b, a = im.getpixel((0, 0))
    return f'#{r:02X}{g:02X}{b:02X}', (r, g, b)

def px(path, x, y):
    r, g, b, a = Image.open(path).convert('RGBA').getpixel((x, y))
    return f'#{r:02X}{g:02X}{b:02X}'

probes = {
    'bgTop': px(f'{PUB_S}/Bg-f00.png', 13, 4),
    'bgMid': px(f'{PUB_S}/Bg-f00.png', 13, 960),
    'bgBottom': px(f'{PUB_S}/Bg-f00.png', 13, 1915),
    'boardCorner': px(f'{PUB_S}/Board-f00.png', 8, 8),
    'boardCell00': px(f'{PUB_S}/Board-f00.png', 80, 80),
    'boardCellCenter': px(f'{PUB_S}/Board-f00.png', 497, 497),
    'boardBetween': px(f'{PUB_S}/Board-f00.png', 497, 430),
    'btnPlayAvg': avg_color(f'{PUB_S}/BtnPlay-f00.png')[0],
    'btnPlayCenter': px(f'{PUB_S}/BtnPlay-f00.png', 168, 60),
    'heartAvg': avg_color(f'{PUB_S}/Heart-f00.png')[0],
    'cupAvg': avg_color(f'{PUB_S}/CupIcon-f00.png')[0],
    'txtScoreGlyph': avg_color(f'{PUB_S}/txtScore-f00.png')[0],
    'logoAvg': avg_color(f'{PUB_S}/Sprite2-f00.png')[0],
    'pausePopupAvg': avg_color(f'{PUB_S}/PausePopup-f00.png')[0],
    'trayPhAvg': avg_color(f'{PUB_S}/PlaceHolder-f00.png')[0],
}
print(json.dumps(probes, indent=2))

# ---------------------------------------------------------------- ranking ---
ranking_rows = []
try:
    rk = json.load(open(RANKING_JSON))
    if isinstance(rk, dict):
        for v in rk.values():
            if isinstance(v, list):
                rk = v
                break
    for row in rk[:8]:
        if isinstance(row, dict):
            ranking_rows.append({
                'name': str(row.get('name', row.get('nickname', '?')))[:14],
                'score': int(row.get('score', row.get('best', 0))),
            })
        elif isinstance(row, (list, tuple)) and len(row) >= 2:
            ranking_rows.append({'name': str(row[0])[:14], 'score': int(row[1])})
except Exception as ex:
    print('ranking parse fallback:', ex)
    ranking_rows = [
        {'name': 'Ava', 'score': 4520}, {'name': 'Liam', 'score': 3980},
        {'name': 'Sofia', 'score': 3410}, {'name': 'Marco', 'score': 2870},
        {'name': 'Giulia', 'score': 2140}, {'name': 'Luca', 'score': 1580},
    ]

# ----------------------------------------------------------------- shapes ---
raw = json.load(open(SHAPES_JSON))['Shapes']
shapes = []
for m in raw:
    cells = []
    for r in range(5):
        for c in range(5):
            if m[r][c]:
                cells.append([r, c])
    shapes.append(cells)

# ------------------------------------------------------------- generate TS ---
def ts_str(s):
    return "'" + str(s).replace('\\', '\\\\').replace("'", "\\'") + "'"

lines = ['// AUTO-GENERATED by scripts/prepare_skin_studio.py — do not edit by hand.',
         '',
         'export interface SpriteInfo { w: number; h: number; frames: string[] }',
         '',
         'export const SPRITES: Record<string, SpriteInfo> = {']
for name in sorted(sprites):
    s = sprites[name]
    lines.append(f"  {ts_str(name)}: {{ w: {s['w']}, h: {s['h']}, frames: ["
                 + ', '.join(ts_str(f) for f in s['frames']) + '] },')
lines.append('};')
lines.append('')
lines.append('export const AUDIO_FILES: string[] = [')
lines.append(', '.join(ts_str(a) for a in audio_files))
lines.append('];')
lines.append('')
lines.append('export const PROBED = ' + json.dumps(probes, indent=2) + ' as const;')
lines.append('')
lines.append('export const RANKING_ROWS: { name: string; score: number }[] = '
             + json.dumps(ranking_rows) + ';')
lines.append('')
lines.append('export const SHAPES: number[][][] = ' + json.dumps(shapes) + ';')
lines.append('')

with open(OUT_TS, 'w') as fh:
    fh.write('\n'.join(lines))
print(f'wrote {OUT_TS} ({len(lines)} lines)')
print(f'sprites copied: {copied}')
