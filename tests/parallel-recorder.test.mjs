import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ParallelRecorder, validateBatch } from '../publisher/parallel.mjs';
import { PublisherQueue } from '../publisher/core.mjs';

test('parallel capture caps concurrency and clip duration before creating jobs', () => {
  assert.deepEqual(validateBatch(), { count: 10, seconds: 60, speed: 4 });
  for (const count of [0, 11, 1.5, NaN]) assert.throws(() => validateBatch({ count }));
  for (const seconds of [0, 61, 6.5, Infinity]) assert.throws(() => validateBatch({ seconds }));
  for (const speed of [0, 17, NaN]) assert.throws(() => validateBatch({ speed }));
});

test('failed browser launch retains ten failed queue entries and prevents overlapping batches', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'blockrush-parallel-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const queue = new PublisherQueue(directory, {}); await queue.init();
  let rejectLaunch;
  const recorder = new ParallelRecorder(queue, 'http://127.0.0.1:8765', {
    launch: () => new Promise((resolve, reject) => { rejectLaunch = reject; }),
  });
  await recorder.start({ count: 10, seconds: 60 });
  assert.equal(queue.jobs.length, 10);
  assert.ok(queue.jobs.every(job => job.state === 'starting'));
  await assert.rejects(() => recorder.start({ count: 1 }), /already running/);
  rejectLaunch(new Error('Browser unavailable'));
  await recorder.completion;
  assert.equal(recorder.info.active, false);
  assert.equal(recorder.info.failed, 10);
  assert.ok(queue.jobs.every(job => job.state === 'failed' && job.recordingFailed));
  await assert.rejects(() => queue.act(queue.jobs[0].id, 'retry'), /new batch/);
});

test('worker restart fails interrupted recordings without trying to convert missing sources', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'blockrush-interrupted-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const queue = new PublisherQueue(directory, {}); await queue.init();
  await queue.add({ id: 'one', source: 'one.webm' }, { state: 'recording' });
  const restarted = new PublisherQueue(directory, {}, { convert: async () => assert.fail('missing recording must not convert') });
  await restarted.init(); await restarted.process();
  assert.equal(restarted.jobs[0].state, 'failed');
  assert.equal(restarted.jobs[0].recordingFailed, true);
});

test('parallel MP4 conversion trims startup and limits output to the requested minute', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'blockrush-trim-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let args;
  const queue = new PublisherQueue(directory, {}, { convert: async input => { args = input; await writeFile(input.at(-1), 'video'); } });
  await queue.init();
  await queue.add({ id: 'one', source: 'one.webm', trimStart: 12.5, captureLimit: 60 });
  await queue.process();
  assert.equal(args[args.indexOf('-ss') + 1], '12.5');
  assert.ok(args.indexOf('-ss') < args.indexOf('-i'));
  assert.equal(args[args.indexOf('-t') + 1], '60');
  assert.equal(queue.jobs[0].state, 'ready');
});
