import { chromium } from 'playwright';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function validateBatch({ count = 10, seconds = 60, speed = 4 } = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 10) throw new Error('Choose 1–10 parallel recordings');
  if (!Number.isInteger(seconds) || seconds < 6 || seconds > 60) throw new Error('Choose 6–60 seconds per recording');
  if (!Number.isFinite(speed) || speed < 0.25 || speed > 16) throw new Error('Bot speed must be 0.25–16');
  return { count, seconds, speed };
}

// Dedicated capture sessions are part of the publisher worker. No personal
// browser profile, account cookies, tab sharing, or social credentials are used.
export class ParallelRecorder {
  constructor(queue, origin, { launch = options => chromium.launch(options) } = {}) {
    this.queue = queue; this.origin = origin; this.launch = launch; this.info = null; this.browser = null; this.abort = null;
  }
  async start(options) {
    if (this.info?.active) throw new Error('A parallel batch is already running');
    const settings = validateBatch(options);
    const id = randomUUID();
    this.info = { id, ...settings, active: true, state: 'starting', startedAt: null, endsAt: null, completed: 0, failed: 0, jobs: [] };
    this.abort = new AbortController();
    for (let i = 0; i < settings.count; i++) {
      const job = { id: randomUUID(), source: '', title: `BlockRush · parallel ${i + 1}/${settings.count} · ${new Date().toISOString()}`, batchId: id, requestedDuration: settings.seconds, captureMode: 'parallel', audio: 'none' };
      job.source = `${job.id}.source.webm`;
      await this.queue.add(job, { state: 'starting' }); this.info.jobs.push(job.id);
    }
    this.completion = this.run(settings).catch(async error => {
      this.info.error = error.message; this.info.state = 'failed';
      for (const job of this.queue.jobs.filter(j => j.batchId === id && ['starting', 'recording'].includes(j.state))) {
        this.queue.transition(job, 'failed', 'Recording failed'); job.error = error.message; job.recordingFailed = true; this.info.failed++;
      }
      await this.queue.save();
    }).finally(async () => { await this.browser?.close().catch(() => {}); this.browser = null; this.info.active = false; });
    return this.info;
  }
  stop() {
    this.abort?.abort();
    if (this.info?.state === 'starting') void this.browser?.close().catch(() => {});
  }
  async run(settings) {
    const { queue } = this;
    const jobs = queue.jobs.filter(j => j.batchId === this.info.id);
    this.browser = await this.launch({ headless: true,
      args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
    });
    if (this.abort.signal.aborted) throw new Error('Recording cancelled before capture started');
    const sessions = await Promise.all(jobs.map(async job => {
      const contextStartedAt = Date.now();
      const context = await this.browser.newContext({ viewport: { width: 540, height: 960 },
        recordVideo: { dir: join(queue.directory, 'recordings'), size: { width: 540, height: 960 } },
      });
      const page = await context.newPage();
      await page.goto(`${this.origin}/play/?bot=1&speed=${settings.speed}&clean=1&restart=1`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForFunction(() => window.__BB__?.getScore() > 0, null, { timeout: 90_000 });
      return { job, context, page, video: page.video(), contextStartedAt, scores: [] };
    }));
    const startedAt = Date.now();
    this.info.startedAt = startedAt; this.info.endsAt = startedAt + settings.seconds * 1000; this.info.state = 'recording';
    const sample = async session => { try { session.scores.push(await session.page.evaluate(() => window.__BB__.getScore())); } catch {} };
    await Promise.all(sessions.map(sample));
    for (const session of sessions) {
      session.job.trimStart = (startedAt - session.contextStartedAt) / 1000;
      session.job.recordedAt = startedAt; queue.transition(session.job, 'recording', `Parallel capture · ${settings.seconds}s limit`);
    }
    await queue.save();
    const sampling = setInterval(() => { void Promise.all(sessions.map(sample)); }, 5000);
    try {
      await new Promise(resolve => {
        const timer = setTimeout(resolve, Math.max(0, this.info.endsAt - Date.now()));
        this.abort.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
        if (this.abort.signal.aborted) { clearTimeout(timer); resolve(); }
      });
      this.info.state = 'finalizing';
      const duration = Math.min(settings.seconds, (Date.now() - startedAt) / 1000);
      await Promise.all(sessions.map(sample));
      await Promise.all(sessions.map(async session => {
        const { job, context, video } = session;
        try {
          await context.close();
          if (new Set(session.scores).size < 2) throw new Error('The bot did not advance during this recording');
          await video.saveAs(join(queue.directory, job.source)); await video.delete();
          job.duration = duration; job.captureLimit = duration; job.endedAt = Date.now(); job.finalScore = session.scores.at(-1); job.maxScoreSeen = Math.max(...session.scores);
          queue.transition(job, 'captured', 'Parallel recording complete'); this.info.completed++;
          await queue.save();
        } catch (error) { queue.transition(job, 'failed'); job.error = error.message; job.recordingFailed = true; this.info.failed++; await queue.save(); }
      }));
      this.info.state = this.info.failed ? 'completed_with_errors' : 'completed';
    } finally { clearInterval(sampling); }
    void queue.process().catch(() => {});
  }
}
