#!/usr/bin/env python3
"""Decompile Block Blast C3 project: object types, layouts, event sheets -> readable dump.

Sources:
- game_data.json  (project data)
- c3runtime.js    (C3_GetObjectRefTable + C3_ExpressionFuncs tables)
Output: /home/z/my-project/download/original-decompiled.txt
"""
import json, re, sys

ROOT = '/home/z/my-project'
OUT = open(f'{ROOT}/download/original-decompiled.txt', 'w', encoding='utf-8')

def w(s=''):
    OUT.write(s + '\n')

# ---------- load project ----------
with open(f'{ROOT}/game_data.json', encoding='utf-8') as f:
    proj = json.load(f)
if not isinstance(proj, list):
    proj = proj['project']

obj_names = [t[0] for t in proj[3]]
obj_instvars = {t[0]: [(iv[2], iv[1]) for iv in (t[3] or [])] for t in proj[3]}
obj_behaviors = {t[0]: [b[0] for b in (t[8] or [])] for t in proj[3]}

# ---------- extract ref table from c3runtime.js ----------
src = open(f'{ROOT}/c3runtime.js', encoding='utf-8', errors='replace').read()

def extract_js_array(start_marker):
    """Extract the top-level entries of a JS array literal starting after marker."""
    i = src.index(start_marker)
    j = src.index('[', i)
    depth = 0
    entries = []
    cur_start = j + 1
    k = j
    n = len(src)
    in_string = None
    while k < n:
        c = src[k]
        if in_string:
            if c == '\\':
                k += 2
                continue
            if c == in_string:
                in_string = None
            k += 1
            continue
        if c in '"\'`':
            in_string = c
        elif c in '([{':
            depth += 1
        elif c in ')]}':
            depth -= 1
            if depth == 0 and c == ']':
                tail = src[cur_start:k].strip()
                if tail:
                    entries.append(tail)
                return entries, k
        elif c == ',' and depth == 1:
            entry = src[cur_start:k].strip()
            if entry:
                entries.append(entry)
            cur_start = k + 1
        k += 1
    return entries, k

# C3_GetObjectRefTable entries
ref_entries, _ = extract_js_array('C3_GetObjectRefTable = function')
REF = []
for e in ref_entries:
    m = re.search(r'C3\.(?:Plugins|Behaviors)\.\w+\.\w+\.\w+', e)
    REF.append(m.group(0) if m else e.replace('\n', ' ')[:60])
w(f'# Object reference table: {len(REF)} entries')
w()

# C3_ExpressionFuncs entries (keep readable source)
expr_entries, _ = extract_js_array('self.C3_ExpressionFuncs = ')
EXPR = []
for e in expr_entries:
    e = re.sub(r'\s+', ' ', e).strip()
    EXPR.append(e)
w(f'# Expression funcs table: {len(EXPR)} entries')
w()

def expr_desc(idx):
    if idx < len(EXPR):
        return EXPR[idx]
    return f'<expr{idx}>'

# ---------- variable registry (sheet-level vars by SID) ----------
var_by_sid = {}

def reg_vars(sheet_data):
    for ev in sheet_data[1]:
        if isinstance(ev, list) and ev and ev[0] == 1:
            # [1, name, type, value, isConst, isStatic, sid?, ...]
            var_by_sid[ev[6]] = ev[1]

for s in proj[6]:
    reg_vars(s)

# ---------- param decoding ----------
def decode_node(node):
    try:
        t = node[0]
        if t == 1:  # Object expression: [1, objIdx, refIdx, returnsString]
            ref = REF[node[2]] if isinstance(node[2], int) and node[2] < len(REF) else f'ref{node[2]}'
            short = str(ref).split('.')[-1] if '.' in str(ref) else str(ref)
            return f'{obj_names[node[1]]}.{short}()'
        if t == 2:  # InstVar: [2, objIdx, returnsString, varIdx]
            names = obj_instvars.get(obj_names[node[1]], [])
            vn = names[node[3]][0] if node[3] < len(names) else f'iv{node[3]}'
            return f'{obj_names[node[1]]}.{vn}'
        if t == 3:  # EventVar: [3, sid]
            return f'var:{var_by_sid.get(node[1], node[1])}'
        if t == 4:  # System: [4, refIdx]
            ref = REF[node[1]] if isinstance(node[1], int) and node[1] < len(REF) else f'ref{node[1]}'
            short = str(ref).split('.')[-1] if '.' in str(ref) else str(ref)
            return f'System.{short}()'
        if t == 5:  # CallFunction: [5, funcName]
            return f'CallFunction("{node[1]}")'
        if t == 0:  # Behavior: [0, objIdx, behaviorName, refIdx, returnsString]
            return f'{obj_names[node[1]]}[{node[2]}].{node[3]}()'
    except Exception as ex:
        return f'<node-decode-err {ex}: {str(node)[:120]}>'
    return str(node)

def decode_expr_param(pdata):
    """Expression parameter: [0, [exprNumber, node1, node2...]]"""
    try:
        exp = pdata[1]
        num = exp[0]
        nodes = exp[1:]
        src_fn = expr_desc(num)
        if not nodes:
            m = re.search(r'=>\s*(.+?)[;,]?\s*$', src_fn)
            val = m.group(1).strip() if m else src_fn
            return val
        node_strs = [decode_node(nd) for nd in nodes]
        return f'EXPR#{num}: {src_fn}  NODES: {node_strs}'
    except Exception as ex:
        return f'<expr-err {ex}: {str(pdata)[:150]}>'

def decode_param(p):
    try:
        t = p[0]
        if t in (0, 1, 7, 14):  # expression / string expression
            return decode_expr_param(p)
        if t in (3, 8, 9):      # combo
            return f'combo:{p[1]}'
        if t == 4:              # object
            return obj_names[p[1]]
        if t == 5:              # layer expr
            return f'layer({decode_expr_param(p)})'
        if t == 6:              # layout
            return f'layout:"{p[1]}"'
        if t == 10:             # instvar index
            return f'ivIndex:{p[1]}'
        if t == 11:             # event var sid
            return f'&{var_by_sid.get(p[1], p[1])}'
        if t == 13:             # variadic
            return '[' + ', '.join(decode_param(sp) for sp in p[1:]) + ']'
        if t == 16:             # boolean
            return 'true' if p[1] else 'false'
        if t == 2 or t == 12:   # file
            return f'file:{p[1]}'
        return str(p)
    except Exception as ex:
        return f'<param-err {ex}: {str(p)[:120]}'

# ---------- condition/action rendering ----------
def obj_of(idx):
    return 'System' if idx == -1 else obj_names[idx] if idx >= 0 else f'special{idx}'

def decode_cnd(c):
    # [objIdx, refIdx, behavior, trigger, looping, inverted, static, sid, debug, params]
    try:
        obj = obj_of(c[0])
        name = str(REF[c[1]]) if isinstance(c[1], int) and c[1] < len(REF) else str(c[1])
        flags = []
        if c[3] and c[3] > 0: flags.append('TRIGGER')
        if c[3] == 2: flags.append('FAST')
        if c[4]: flags.append('LOOP')
        if c[5]: flags.append('NOT')
        params = ''
        if len(c) >= 10 and c[9]:
            params = ', '.join(decode_param(p) for p in c[9])
        return f'{obj}.{name}({params})' + (f' [{",".join(flags)}]' if flags else '')
    except Exception as ex:
        return f'<cnd-err {ex}: {str(c)[:150]}>'

def decode_act(a):
    # [objIdx, refIdx, behavior, sid, actionType, flags, params]
    if a[0] == -2:
        return f'CALL FUNCTION "{a[1]}"(params: ' + ', '.join(decode_param(p) for p in (a[6] if len(a) > 6 and a[6] else [])) + ')'
    if a[0] == -3:
        return f'SCRIPT ACTION ref#{a[1]}'
    obj = obj_of(a[0])
    name = str(REF[a[1]]) if isinstance(a[1], int) and a[1] < len(REF) else str(a[1])
    params = ''
    if len(a) >= 7 and a[6]:
        params = ', '.join(decode_param(p) for p in a[6])
    return f'{obj}.{name}({params})'

# ---------- walk event sheets ----------
def dump_event(ev, indent):
    pad = '  ' * indent
    if not isinstance(ev, list) or not ev:
        return
    et = ev[0]
    if et in (0, 3):
        # event block
        if et == 3:
            enabled = ev[1][0]
            name = ev[1][1]
            w(f'{pad}+ GROUP "{name}" (active={enabled})')
            body_pad = pad + '  '
        else:
            body_pad = pad
        is_or = ev[2]
        cnds = ev[6] if len(ev) > 6 else []
        acts = ev[7] if len(ev) > 7 else []
        subs = ev[8] if len(ev) > 8 else []
        label = ''
        if cnds:
            first = cnds[0]
            if first[0] == -1 and 'Cnds.Else' in str(REF[first[1]] if first[1] < len(REF) else ''):
                label = ' (ELSE)'
        orlbl = ' (OR)' if is_or else ''
        if et == 0:
            w(f'{pad}EVENT{orlbl}{label}:')
        else:
            w(f'{pad}BODY{orlbl}{label}:')
        for c in cnds:
            w(f'{body_pad}  IF {decode_cnd(c)}')
        for a in acts:
            w(f'{body_pad}  DO  {decode_act(a)}')
        for s in subs:
            dump_event(s, indent + 1 if et == 3 else indent + 1)
    elif et == 1:
        # variable: [1, name, type, value, isConst, isStatic, sid, ...]
        w(f'{pad}VAR {ev[1]} = {ev[3]!r} (type={ev[2]}, const={ev[4]}, static={ev[5]}, sid={ev[6]})')
    elif et == 2:
        w(f'{pad}INCLUDE sheet "{ev[1]}"')
    elif et == 4:
        # function block: [4, [name, type, params...], ...]
        fb = ev[1]
        fname = fb[0] if isinstance(fb[0], str) else str(fb[0])
        w(f'{pad}+ FUNCTION "{fname}"')
        cnds = ev[6] if len(ev) > 6 else []
        acts = ev[7] if len(ev) > 7 else []
        subs = ev[8] if len(ev) > 8 else []
        for c in cnds:
            w(f'{pad}  IF {decode_cnd(c)}')
        for a in acts:
            w(f'{pad}  DO  {decode_act(a)}')
        for s in subs:
            dump_event(s, indent + 1)
    elif et == 5:
        w(f'{pad}+ SCRIPT BLOCK (ref#{ev[1]})')
    else:
        w(f'{pad}? EVENT TYPE {et}: {str(ev)[:150]}')

w('=' * 100)
w('BLOCK BLAST — ORIGINAL CONSTRUCT 3 PROJECT — FULL DECOMPILED LOGIC')
w('=' * 100)

w()
w('## OBJECT TYPES (87) with instance variables & behaviors:')
for i, t in enumerate(proj[3]):
    ivs = obj_instvars.get(t[0], [])
    behs = [b[0] for b in (t[8] or [])]
    w(f'  [{i:2d}] {t[0]:20s} ivars={ivs} behaviors={behs}')

w()
w('## MEDIA (audio) list:')
for m in proj[7]:
    w(f'  {m[0]}')

w()
w('## EVENT SHEETS:')
for s in proj[6]:
    w()
    w('=' * 90)
    w(f'### SHEET: {s[0]}')
    w('=' * 90)
    for ev in s[1]:
        dump_event(ev, 0)

OUT.close()
print('written to download/original-decompiled.txt')
print(f'ref entries: {len(REF)}, expr entries: {len(EXPR)}')
