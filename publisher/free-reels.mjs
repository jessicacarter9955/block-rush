import { mkdir, copyFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createPublisher } from './server.mjs';
import { ParallelRecorder, validateBatch } from './parallel.mjs';
import { exportLayout } from './formats.mjs';

// GitHub Actions runs the existing local-only publisher on an ephemeral runner.
// No API keys, private browser profiles, or paid always-on server are needed.
export function freeReelsOptions(env = process.env) {
  const count = Number(env.REELS_COUNT ?? 1);
  const seconds = Number(env.REELS_SECONDS ?? 30);
  const speed = Number(env.REELS_SPEED ?? 4);
  const batch = validateBatch({ count, seconds, speed });
  if (count > 3) throw new Error('Free runner batches are limited to 3 clips');
  const format = env.REELS_FORMAT || 'instagram-reels';
  const framing = env.REELS_FRAMING || 'fit';
  exportLayout(format, framing);
  const port = Number(env.REELS_PORT ?? 8765);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('REELS_PORT must be 1024–65535');
  return { ...batch, format, framing, port };
}

export async function awaitReadyJobs(queue, jobIds, { timeoutMs = 600_000, sleep = delay } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const jobs = jobIds.map(id => queue.jobs.find(job => job.id === id));
    if (jobs.some(job => !job)) throw new Error('Batch recording disappeared from the queue');
    const failed = jobs.find(job => ['failed', 'unknown'].includes(job.state));
    if (failed) throw new Error(`Clip conversion failed: ${failed.error || failed.id}`);
    if (jobs.every(job => job.state === 'ready')) return jobs;
    await queue.process();
    await sleep(1000);
  }
  throw new Error('Timed out while waiting for MP4 conversion');
}

export async function generateFreeReels(options = freeReelsOptions(), { root = resolve('out'), destination = resolve('reels'),
  makePublisher = createPublisher, makeRecorder = (queue, origin) => new ParallelRecorder(queue, origin) } = {}) {
  if (!(await stat(join(root, 'play', 'index.html')).catch(() => null))) {
    throw new Error('Missing static game build. Run npm run publisher:build first.');
  }
  const workDir = await mkdtemp(join(tmpdir(), 'blockrush-reels-'));
  const { server, queue, origin } = await makePublisher({ directory: workDir, root, port: options.port });
  const recorder = makeRecorder(queue, origin);
  try {
    const batch = await recorder.start({ count: options.count, seconds: options.seconds, speed: options.speed });
    console.log(`Recording ${batch.jobs.length} clip(s) for ${options.seconds}s at ${origin}`);
    await recorder.completion;
    if (recorder.info.failed || recorder.info.state !== 'completed') {
      throw new Error(recorder.info.error || `Recording failed: ${recorder.info.failed} clip(s)`);
    }
    const jobs = await awaitReadyJobs(queue, batch.jobs);
    await mkdir(destination, { recursive: true });
    const clips = [];
    for (const [index, job] of jobs.entries()) {
      const original = await queue.prepareExport(job.id, options.format, options.framing);
      const filename = `blockrush-${options.format}-${String(index + 1).padStart(2, '0')}.mp4`;
      const target = join(destination, filename);
      await copyFile(original, target);
      const size = (await stat(target)).size;
      if (size < 1024) throw new Error(`MP4 output is unexpectedly small: ${filename}`);
      clips.push({ filename, bytes: size, score: job.finalScore, seconds: options.seconds, format: options.format });
      console.log(`Ready: ${target} (${(size / 1048576).toFixed(1)} MiB)`);
    }
    await writeFile(join(destination, 'manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), clips }, null, 2));
    return clips;
  } finally {
    recorder.stop();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await generateFreeReels(); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
