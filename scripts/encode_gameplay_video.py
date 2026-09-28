#!/usr/bin/env python3
"""Encode della run Block Rush 1:1: video completo + clip milestone + report.

Legge events.json + l'ultimo webm in download/gameplay-video/ e produce:
  - block-blast-x10-<finalscore>.mp4  (run completa, dall'inizio del gameplay)
  - milestone-2000/3000/4000/5000/100000.mp4 (clip ~12s su ogni traguardo)
  - report.md (statistiche e timestamp)

NOTE AMBIENTE (lezioni della sessione precedente):
  - ffmpeg SEMPRE con -nostdin (altrimenti entra in modalita' interattiva
    "Enter command:" quando stdin e' collegato alla shell)
  - 2 CPU soltanto: preset veryfast; il full viene encodato a SEGMENTI da 120s
    e poi concatenato con -c copy (zero ricodifica)
"""
import json
import glob
import os
import subprocess
import sys

DIR = '/home/z/my-project/download/gameplay-video'
SEG = 120  # secondi per segmento


def run(cmd):
    print('$', ' '.join(cmd[:8]), '...', flush=True)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print('ERR:', r.stderr[-1200:], flush=True)
        raise SystemExit(1)


def probe(path):
    r = subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
         '-show_entries', 'stream=width,height,r_frame_rate,nb_frames',
         '-show_entries', 'format=duration,size', '-of', 'json', path],
        capture_output=True, text=True)
    d = json.loads(r.stdout or '{}')
    st = (d.get('streams') or [{}])[0]
    return {
        'size': st.get('width'), 'h': st.get('height'),
        'fps': st.get('r_frame_rate'), 'frames': st.get('nb_frames'),
        'dur': float((d.get('format') or {}).get('duration', 0)),
        'mb': round(int((d.get('format') or {}).get('size', 0)) / 1e6, 1),
    }


def main():
    ev = json.load(open(f'{DIR}/events.json'))
    webms = [f for f in glob.glob(f'{DIR}/*.webm') if 'backup' not in os.path.basename(f)]
    if not webms:
        print('nessun webm nuovo')
        raise SystemExit(1)
    src = max(webms, key=os.path.getmtime)
    print('sorgente:', src, flush=True)

    final = int(ev.get('final_score') or 0)
    # game_mount e t0 sono timestamp ASSOLUTI: l'offset di inizio gameplay
    # nel timeline del video e' la loro differenza.
    t0_abs = ev.get('t0') or 0
    mount_abs = ev.get('game_mount') or 0
    t0_off = max(0, (mount_abs - t0_abs) if t0_abs and mount_abs else 0)
    total = ev.get('duration') or 0
    ms = ev.get('milestones') or {}

    src_info = probe(src)
    total = min(total, src_info['dur'])
    start = max(0, t0_off - 0.4)
    dur = max(1, total - start)
    print(f'full: -ss {start:.2f} durata {dur:.1f}s (webm {src_info})', flush=True)

    # ---------------- full a segmenti ----------------
    seg_files = []
    i = 0
    pos = start
    while pos < start + dur - 0.5:
        d = min(SEG, start + dur - pos)
        seg = f'{DIR}/.seg{i:02d}.mp4'
        run(['ffmpeg', '-nostdin', '-y', '-ss', f'{pos:.2f}', '-i', src,
             '-t', f'{d:.2f}', '-an',
             '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21',
             '-pix_fmt', 'yuv420p', seg])
        seg_files.append(seg)
        pos += d
        i += 1
    full_out = f'{DIR}/block-blast-x10-{final}.mp4'
    if len(seg_files) == 1:
        os.replace(seg_files[0], full_out)
    else:
        lst = f'{DIR}/.concat.txt'
        with open(lst, 'w') as f:
            for s in seg_files:
                f.write(f"file '{s}'\n")
        run(['ffmpeg', '-nostdin', '-y', '-f', 'concat', '-safe', '0',
             '-i', lst, '-c', 'copy', '-movflags', '+faststart', full_out])
        for s in seg_files:
            os.remove(s)
    print('FULL:', full_out, probe(full_out), flush=True)

    # ---------------- clip milestone (skip se gia' buone) ----------------
    clips = {}
    for name, t in ms.items():
        out = f'{DIR}/milestone-{name}.mp4'
        if os.path.exists(out) and os.path.getsize(out) > 1_000_000:
            clips[name] = probe(out)
            print(f'CLIP {name}: gia\' pronta, skip', flush=True)
            continue
        c0 = max(0, t - 5.0)
        cd = 12.0
        run(['ffmpeg', '-nostdin', '-y', '-ss', f'{c0:.2f}', '-i', src,
             '-t', f'{cd:.2f}', '-an',
             '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21',
             '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out])
        clips[name] = probe(out)
        print(f'CLIP {name}:', clips[name], flush=True)

    # ---------------- report ----------------
    fi = probe(full_out)
    rep = [
        '# Run Block Rush 1:1 — bot AI (velocita x10)',
        '',
        f'- **Punteggio finale: {final:,}**'.replace(',', '.'),
        f'- Durata video: {fi["dur"]:.1f}s ({fi["dur"]/60:.1f} min) · {fi["size"]}x{fi["h"]} · {fi["frames"]} frame',
        f'- File full: `{os.path.basename(full_out)}` ({fi["mb"]} MB)',
        '',
        '## Traguardi',
        '',
        '| Traguardo | istante nel video | clip |',
        '|---|---|---|',
    ]
    for name, t in ms.items():
        tt = max(0, t - t0_off)
        rep.append(f'| {int(name):,} | {tt:.1f}s | milestone-{name}.mp4 ({clips[name]["mb"]} MB) |'.replace(',', '.'))
    rep += [
        '',
        'Il bot gioca come un giocatore reale (prende il pezzo dal vassoio e lo',
        'trascina sulla griglia); quando nessun pezzo entra, clicca "GUARDA',
        'ANNUNCIO E CONTINUA" (revive 1:1, punteggio mantenuto).',
        '',
    ]
    with open(f'{DIR}/report.md', 'w') as f:
        f.write('\n'.join(rep))
    print('REPORT ok', flush=True)
    print('DONE ENCODE', flush=True)


if __name__ == '__main__':
    main()
