#!/usr/bin/env python3
"""
Mirror Block Blast (Construct 3 game) so it runs fully offline.

Construct 3 export layout:
  index.html            -> shell
  style.css, appmanifest.json
  scripts/main.js       -> DOM handlers + RuntimeInterface
  scripts/c3runtime.js  -> Runtime impl
  scriptsInEvents.js    -> event sheet code
  workermain.js         -> web worker entry (bundles c3runtime + job workers)
  dispatchworker.js, jobworker.js, previewworker.js
  opus.wasm.js, opus.wasm.wasm  -> audio decoder
  media/<...>           -> sprites, sounds, fonts (loaded at runtime)

Strategy: BFS download — start with the shell + main.js, parse every
downloaded JS for quoted asset paths, expand the frontier, repeat
until no new files are discovered. Strip leading slashes from paths
so they stay under our root.
"""

import os
import re
import sys
import urllib.request
import urllib.error
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://html5.gamedistribution.com/rvvASMiM/3a364ed8d075418abb7849e1d63b6015"
ROOT = "/home/z/my-project/best-block-blast/game"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

# Extensions we'll consider as assets (must be lowercase match)
EXT_RE = re.compile(
    r"\.(png|jpg|jpeg|webp|svg|gif|json|js|css|mjs|wav|mp3|ogg|m4a|aac|webm|mp4|"
    r"ttf|otf|woff2?|wasm|txt|xml|bin)$",
    flags=re.IGNORECASE,
)

# Capture quoted strings that look like resource paths
PATH_PATTERNS = [
    re.compile(r'"([^"]+\.[A-Za-z0-9]{2,5})"'),
    re.compile(r"'([^']+\.[A-Za-z0-9]{2,5})'"),
    re.compile(r"`([^`]+\.[A-Za-z0-9]{2,5})`"),
]


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception:
        return -1, None


def local_path(rel):
    """Normalize a remote path to a local filesystem path under ROOT."""
    rel = rel.lstrip("/")  # strip leading slash so it stays under ROOT
    rel = rel.replace("\\", "/")
    # block path traversal
    if ".." in rel.split("/"):
        return None
    return os.path.join(ROOT, rel)


def save(rel, data):
    path = local_path(rel)
    if path is None:
        return False
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return True


def download(rel):
    url = f"{BASE}/{rel.lstrip('/')}"
    code, data = fetch(url)
    if code == 200 and data is not None and save(rel, data):
        return rel, code, len(data)
    return rel, code, 0


def is_text(rel):
    ext = rel.lower().rsplit(".", 1)[-1] if "." in rel else ""
    return ext in ("js", "mjs", "css", "json", "txt", "xml", "html", "svg")


def extract_refs(text):
    """Yield candidate resource paths from a JS/CSS/JSON text blob."""
    seen = set()
    for pat in PATH_PATTERNS:
        for m in pat.finditer(text):
            s = m.group(1)
            if not EXT_RE.search(s):
                continue
            if s.startswith(("http://", "https://", "data:", "blob:", "ws://", "wss://")):
                continue
            # Skip data-URI prefixes that slipped through
            if ":" in s.split("/")[0]:
                continue
            seen.add(s.lstrip("./"))  # also strip leading "./"
    return seen


# Seeds — files we know we need before parsing anything
seeds = [
    "index.html",
    "appmanifest.json",
    "style.css",
    "scripts/main.js",
    "scripts/supportcheck.js",
    "scripts/offlineclient.js",
    "scripts/register-sw.js",
    # things referenced in main.js
    "workermain.js",
    "scriptsInEvents.js",
    "scripts/c3runtime.js",
    "dispatchworker.js",
    "jobworker.js",
    "previewworker.js",
    "opus.wasm.js",
    "opus.wasm.wasm",
]
# Icons from appmanifest
seeds += [f"icons/icon-{s}.png" for s in (16, 32, 64, 128, 256, 512)]

# Download frontier (BFS): queue of rel paths to fetch
queue = deque(seeds)
done = set()
text_files_to_parse = []
failed = []
bytes_total = 0

print("Starting BFS download...")
pass_num = 0
while queue:
    pass_num += 1
    batch = []
    while queue and len(batch) < 32:
        rel = queue.popleft()
        if rel in done:
            continue
        done.add(rel)
        batch.append(rel)

    if not batch:
        continue

    with ThreadPoolExecutor(max_workers=16) as ex:
        futures = {ex.submit(download, r): r for r in batch}
        for fut in as_completed(futures):
            rel, code, size = fut.result()
            if code == 200 and size > 0:
                bytes_total += size
                if is_text(rel):
                    text_files_to_parse.append(rel)
                print(f"  OK   {rel}  ({size} bytes)")
            else:
                failed.append((rel, code))
                print(f"  FAIL {rel}  (HTTP {code})")

    # After each batch, parse all newly downloaded text files for new refs
    new_count = 0
    while text_files_to_parse:
        rel = text_files_to_parse.pop()
        path = local_path(rel)
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        except Exception:
            continue
        for ref in extract_refs(text):
            if ref not in done and ref not in queue:
                queue.append(ref)
                new_count += 1
    if new_count:
        print(f"  -> discovered {new_count} new refs from this batch")

print(f"\nPasses: {pass_num}")
print(f"Downloaded: {len(done) - len(failed)}  Failed: {len(failed)}")
print(f"Total bytes: {bytes_total:,}")
if failed:
    print("\nFailures:")
    for rel, code in failed:
        print(f"  HTTP {code}: {rel}")

# Final tree
print("\nFile tree:")
total_files = 0
total_bytes = 0
for root, dirs, files in os.walk(ROOT):
    rel = os.path.relpath(root, ROOT)
    print(f"  [{rel}]")
    for fn in sorted(files):
        sz = os.path.getsize(os.path.join(root, fn))
        print(f"    {fn}  ({sz} bytes)")
        total_files += 1
        total_bytes += sz
print(f"\nTotal: {total_files} files, {total_bytes:,} bytes")
