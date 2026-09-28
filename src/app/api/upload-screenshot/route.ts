import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

// Uploader dei riferimenti 1:1 — riceve gli screenshot ORIGINALI a piena
// risoluzione (nessuna compressione: serve per l'estrazione pixel perfect)
// e li salva in /home/z/my-project/uploads-inbox/ insieme a un manifest
// JSON con slot, note e dimensioni dichiarate dal client.

const INBOX = '/home/z/my-project/uploads-inbox'
const MANIFEST = path.join(INBOX, 'manifest.json')
const MAX_FILES = 8
const MAX_BYTES = 40 * 1024 * 1024 // 40 MB per file
const OK_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export interface UploadEntry {
  id: string
  slot: string
  note: string
  originalName: string
  savedAs: string
  bytes: number
  width?: number
  height?: number
  receivedAt: string
}

function readManifest(): UploadEntry[] {
  try {
    const raw = fs.readFileSync(MANIFEST, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeManifest(entries: UploadEntry[]) {
  fs.writeFileSync(MANIFEST, JSON.stringify(entries, null, 2))
}

function sanitizeSlot(s: unknown): string {
  const base = typeof s === 'string' && s.trim() ? s.trim() : 'screen'
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'screen'
}

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

// GET — elenco dei file già ricevuti (per feedback nella pagina)
export async function GET() {
  fs.mkdirSync(INBOX, { recursive: true })
  const entries = readManifest()
  const onDisk = fs.readdirSync(INBOX).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
  return NextResponse.json({
    ok: true,
    total: onDisk.length,
    recent: entries.slice(-12).reverse(),
  })
}

// POST — ricezione screenshot (multipart/form-data)
export async function POST(req: Request) {
  try {
    fs.mkdirSync(INBOX, { recursive: true })
    const form = await req.formData()

    const files = form.getAll('files').filter((f): f is File => f instanceof File)
    if (!files.length) {
      return NextResponse.json({ ok: false, error: 'Nessun file ricevuto' }, { status: 400 })
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ ok: false, error: `Massimo ${MAX_FILES} file per volta` }, { status: 400 })
    }

    // metadati opzionali per file: [{slot, note, w, h}]
    let metas: { slot?: string; note?: string; w?: number; h?: number }[] = []
    const rawMeta = form.get('meta')
    if (typeof rawMeta === 'string') {
      try {
        const parsed = JSON.parse(rawMeta)
        if (Array.isArray(parsed)) metas = parsed
      } catch {
        /* meta non valido: si va avanti senza */
      }
    }

    const saved: UploadEntry[] = []
    const skipped: { name: string; reason: string }[] = []

    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const ext = OK_TYPES[f.type]
      if (!ext) {
        skipped.push({ name: f.name || `file-${i}`, reason: `formato ${f.type || 'sconosciuto'} non supportato (PNG/JPG/WebP)` })
        continue
      }
      if (f.size > MAX_BYTES) {
        skipped.push({ name: f.name || `file-${i}`, reason: `troppo grande (${(f.size / 1048576).toFixed(1)} MB, max 40 MB)` })
        continue
      }

      const meta = metas[i] ?? {}
      const slot = sanitizeSlot(meta.slot)
      const id = `${stamp()}-${slot}-${i}`
      const savedAs = `${id}.${ext}`
      const buf = Buffer.from(await f.arrayBuffer())
      fs.writeFileSync(path.join(INBOX, savedAs), buf)

      saved.push({
        id,
        slot,
        note: typeof meta.note === 'string' ? meta.note.slice(0, 300) : '',
        originalName: f.name || savedAs,
        savedAs,
        bytes: f.size,
        width: typeof meta.w === 'number' ? meta.w : undefined,
        height: typeof meta.h === 'number' ? meta.h : undefined,
        receivedAt: new Date().toISOString(),
      })
    }

    if (!saved.length) {
      return NextResponse.json({ ok: false, error: 'Nessun file valido', skipped }, { status: 400 })
    }

    const entries = readManifest()
    entries.push(...saved)
    writeManifest(entries)

    return NextResponse.json({ ok: true, saved, skipped })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'errore sconosciuto'
    return NextResponse.json({ ok: false, error: `Upload fallito: ${msg}` }, { status: 500 })
  }
}
