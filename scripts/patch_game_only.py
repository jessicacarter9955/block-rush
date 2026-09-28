#!/usr/bin/env python3
"""Patcha il tree game-only:
1. BP (basePath) su tutti i path pubblici in skin.ts / Kit.tsx / audio.ts
2. play/page.tsx: lock su 'rush' (Block Rush 1:1), rimozione selettore versioni
"""
import re, sys

D = '/home/z/my-project/web-game-only'

def patch(path, subs, must=()):
    s = open(path).read()
    for old, new in subs:
        if old not in s:
            raise SystemExit(f'MANCA in {path}: {old[:80]!r}')
        s = s.replace(old, new)
    open(path, 'w').write(s)
    print(f'ok {path}')

# ---------------------------------------------------------------- skin.ts --
p = f'{D}/src/lib/skin.ts'
s = open(p).read()
# importa BP
s = s.replace("import { darken, lighten, withAlpha } from '@/lib/color';",
              "import { darken, lighten, withAlpha } from '@/lib/color';\nimport { BP } from '@/lib/bp';", 1)
# stringhe statiche '/xxx/...' → `${BP}/xxx/...`
s = re.sub(r"'(/(?:textures|sprites|audio|fonts)/[^']*)'", r"`${BP}\1`", s)
# template literals `/xxx/...` → `${BP}/xxx/...`
s = re.sub(r"`/(textures|sprites|audio|fonts)/", r"`${BP}/\1/", s)
open(p, 'w').write(s)
residual = re.findall(r"(?<![\$\w])/(?:textures|sprites|audio|fonts)/", s.replace('`${BP}', ''))
print('skin.ts residui:', residual[:5] or 'NESSUNO')

# ----------------------------------------------------------------- Kit.tsx --
p = f'{D}/src/components/game/Kit.tsx'
s = open(p).read()
if "from '@/lib/bp'" not in s:
    m = re.search(r"^import .*?;$", s, re.M)
    s = s[:m.end()] + "\nimport { BP } from '@/lib/bp';" + s[m.end():]
s = s.replace("'url(/sprites/Board-f00.png)'", "`url(${BP}/sprites/Board-f00.png)`")
s = s.replace("backgroundImage: `url(${b.img})`", "backgroundImage: `url(${BP}${b.img})`")
s = s.replace("backgroundImage: `url(${b.cellImg})`", "backgroundImage: `url(${BP}${b.cellImg})`")
s = s.replace("src={`/sprites/${spriteObj}-f${String(frame).padStart(2, '0')}.png`}",
              "src={`${BP}/sprites/${spriteObj}-f${String(frame).padStart(2, '0')}.png`}")
s = s.replace('sprite="/sprites/Heart-f00.png"', 'sprite={`${BP}/sprites/Heart-f00.png`}')
# altri eventuali background url con variabili
s = re.sub(r"url\(\$\{BP\}/", "url(${BP}/", s)  # no-op safety
open(p, 'w').write(s)
left = re.findall(r"url\(/(?:sprites|textures)", s)
print('Kit.tsx url() residui:', left or 'NESSUNO')

# --------------------------------------------------------------- audio.ts --
p = f'{D}/src/lib/audio.ts'
s = open(p).read()
s = s.replace("const res = await fetch(`/audio/${file}.mp3`);",
              "const res = await fetch(`${BP}/audio/${file}.mp3`);")
if "from './bp'" not in s:
    s = s.replace("import type { SoundRef } from './skin';",
                  "import type { SoundRef } from './skin';\nimport { BP } from './bp';", 1)
open(p, 'w').write(s)
print('audio.ts ok')

# ---------------------------------------------------------- play/page.tsx --
p = f'{D}/src/app/play/page.tsx'
s = open(p).read()

# 1) init: versione bloccata a rush, niente ?list
old_init = """    const q = new URLSearchParams(window.location.search);
    if (q.get('clean') === '1') setClean(true);
    if (q.get('list') === '1') setView('list');
    const vq = q.get('version');
    const saved = localStorage.getItem(VERSION_KEY);
    const v = vq && PRESETS.some((p) => p.id === vq)
      ? vq
      : saved && PRESETS.some((p) => p.id === saved) ? saved : 'rush';
    setVersionId(v);"""
new_init = """    const q = new URLSearchParams(window.location.search);
    if (q.get('clean') === '1') setClean(true);
    // build "solo gioco": un'unica versione, Block Rush 1:1
    const v = 'rush';
    setVersionId(v);"""
assert old_init in s, 'init non trovato'
s = s.replace(old_init, new_init)

# 2) rimuove pickVersion
old_pv = """  const pickVersion = (id: string) => {
    setVersionId(id);
    localStorage.setItem(VERSION_KEY, id);
    applyPreset(id, 'all');
    setView('app');
    pushLog(`versione: ${PRESETS.find((p) => p.id === id)?.name ?? id}`);
  };

"""
assert old_pv in s
s = s.replace(old_pv, '')

# 3) view: sempre app
s = s.replace("  const [view, setView] = useState<View>('app');", "  const [view] = useState<'app'>('app');")
s = s.replace("type View = 'list' | 'app';\n\n", "")

# 4) render: niente VersionList
old_render = """          {view === 'list' ? (
            <VersionList current={versionId} onPick={pickVersion} onBack={() => setView('app')} />
          ) : playing ? ("""
new_render = """          {playing ? ("""
assert old_render in s
s = s.replace(old_render, new_render)

# 5) bottone Versioni via (tiene solo Schermo intero)
old_btn = """          <div className="absolute left-3 top-3 z-40 flex gap-1.5">
            {view === 'app' && (
              <button
                onClick={() => setView('list')}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-[12px] font-bold text-white/85 backdrop-blur transition hover:bg-black/75"
              >
                <ListVideo size={14} />
                <span className="hidden sm:inline">Versioni</span>
              </button>
            )}
            <button"""
new_btn = """          <div className="absolute left-3 top-3 z-40 flex gap-1.5">
            <button"""
assert old_btn in s
s = s.replace(old_btn, new_btn)

# 6) rimuove il componente VersionList
m = re.search(r"function VersionList\([\s\S]*?\n\}\n", s)
assert m, 'VersionList non trovata'
s = s.replace(m.group(0), '')

# 7) import puliti
s = s.replace("""import {
  Bot, ChevronLeft, CircleDot, Download, EyeOff, Film, Gauge,
  ListVideo, Maximize, Play, Trophy, X, Zap,
} from 'lucide-react';""",
"""import {
  Bot, CircleDot, Download, EyeOff, Film, Gauge, Maximize, Play, X,
} from 'lucide-react';""")
# VERSION_KEY non più usato
s = s.replace("const VERSION_KEY = 'bb-play-version';\n", "")

open(p, 'w').write(s)
print('play/page.tsx ok')
print('FINE — tutti i patch applicati')
