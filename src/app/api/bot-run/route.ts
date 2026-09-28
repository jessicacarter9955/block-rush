import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs'

export const dynamic = 'force-dynamic'

const PIPELINE = '/home/z/my-project/scripts/run_1800_session.py'
const LOG = '/home/z/my-project/download/bot-video/pipeline.log'
const PY = '/home/z/.venv/bin/python3'

export async function POST() {
  try {
    fs.mkdirSync('/home/z/my-project/download/bot-video', { recursive: true })
    const out = fs.openSync(LOG, 'a')
    // detached + unref: the pipeline becomes a child of the persistent
    // next-server process, so it keeps running after this request ends
    // (and across agent tool-call boundaries).
    const child = spawn(PY, [PIPELINE], {
      detached: true,
      stdio: ['ignore', out, out],
      cwd: '/home/z/my-project',
    })
    child.unref()
    fs.closeSync(out)
    return NextResponse.json({ ok: true, pid: child.pid })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'POST to start the detached 1800 bot session',
  })
}
