import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs'

export const dynamic = 'force-dynamic'

// Avvia la sessione di registrazione DETACHED del video Block Rush 1:1
// (bot JS a ×10 dall'inizio del gameplay, milestone 2000→100000, 1080×1920).
const SCRIPT = '/home/z/my-project/scripts/record_gameplay_video.py'
const DIR = '/home/z/my-project/download/gameplay-video'
const LOG = `${DIR}/pipeline.log`
const PY = '/home/z/.venv/bin/python3'
const LOCK = `${DIR}/pipeline.lock`

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    // action:'encode' — avvia l'encode detached (full + clip + report)
    if (body?.action === 'encode') {
      if (fs.existsSync(`${DIR}/encode.lock`)) {
        return NextResponse.json({ ok: false, error: 'encode già attivo' }, { status: 409 })
      }
      fs.writeFileSync(`${DIR}/encode.lock`, String(Date.now()))
      const eo = fs.openSync(`${DIR}/encode.log`, 'a')
      const child = spawn(PY, ['/home/z/my-project/scripts/encode_gameplay_video.py'], {
        detached: true,
        stdio: ['ignore', eo, eo],
        cwd: '/home/z/my-project',
      })
      child.unref()
      fs.closeSync(eo)
      return NextResponse.json({ ok: true, pid: child.pid, action: 'encode' })
    }
    fs.mkdirSync(DIR, { recursive: true })
    if (fs.existsSync(LOCK)) {
      return NextResponse.json({ ok: false, error: 'sessione già attiva' }, { status: 409 })
    }
    let sessionMax = 800
    if (typeof body?.sessionMax === 'number') sessionMax = body.sessionMax
    fs.writeFileSync(LOCK, String(Date.now()))
    const out = fs.openSync(LOG, 'a')
    // detached + unref: figlio del next-server persistente -> sopravvive
    // sia alla fine della request sia ai confini delle chiamate tool.
    const child = spawn(PY, [SCRIPT, String(sessionMax)], {
      detached: true,
      stdio: ['ignore', out, out],
      cwd: '/home/z/my-project',
    })
    child.unref()
    fs.closeSync(out)
    return NextResponse.json({ ok: true, pid: child.pid, sessionMax })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

export async function GET() {
  let status = 'idle'
  try {
    const log = fs.readFileSync(LOG, 'utf8')
    status = log.split('\n').filter(Boolean).slice(-3).join(' | ')
  } catch {}
  let encStatus = 'idle'
  try {
    const log = fs.readFileSync(`${DIR}/encode.log`, 'utf8')
    encStatus = log.split('\n').filter(Boolean).slice(-3).join(' | ')
  } catch {}
  let events: unknown = null
  try {
    events = JSON.parse(fs.readFileSync(`${DIR}/events.json`, 'utf8'))
  } catch {}
  const running = fs.existsSync(LOCK)
  const encoding = fs.existsSync(`${DIR}/encode.lock`)
  return NextResponse.json({ ok: true, running, encoding, status, encStatus, events })
}
