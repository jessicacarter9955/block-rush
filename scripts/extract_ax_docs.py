#!/usr/bin/env python3
"""Estrae testo pulito dalle pagine docs AppLixir scaricate (page_reader)."""
import json, re, sys

def clean(html: str) -> str:
    # mantieni il contenuto dei tag code/pre
    html = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', html, flags=re.S | re.I)
    html = re.sub(r'<br\s*/?>', '\n', html)
    html = re.sub(r'</(p|div|li|h[1-6]|pre|tr)>', '\n', html)
    html = re.sub(r'<[^>]+>', '', html)
    html = html.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
    html = html.replace('&quot;', '"').replace('&#39;', "'").replace('&nbsp;', ' ')
    return re.sub(r'\n{3,}', '\n\n', re.sub(r'[ \t]+', ' ', html))

for f in sys.argv[1:]:
    try:
        d = json.load(open(f))
        data = d.get('data', d)
        print(f"{'='*70}\nFILE: {f}  TITLE: {data.get('title')}\n{'='*70}")
        print(clean(data.get('html', ''))[:8000])
    except Exception as e:
        print(f, 'ERR', e)
