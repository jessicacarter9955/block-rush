import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freeReelsOptions, awaitReadyJobs } from '../publisher/free-reels.mjs';

test('free Reels options have safe, useful defaults', () => {
  assert.deepEqual(freeReelsOptions({}), {
    count: 1, seconds: 30, speed: 4, format: 'instagram-reels', framing: 'fit', port: 8765,
  });
});

test('free generator rejects unsupported formats and oversized batches', () => {
  for (const options of [
    { REELS_COUNT: '4' }, { REELS_COUNT: '0' }, { REELS_SECONDS: '61' },
    { REELS_SECONDS: 'bad' }, { REELS_SPEED: '0' }, { REELS_PORT: '0' },
    { REELS_FORMAT: 'bad' }, { REELS_FRAMING: 'crop' },
  ]) assert.throws(() => freeReelsOptions(options));
  assert.equal(freeReelsOptions({ REELS_FORMAT: 'youtube-shorts', REELS_FRAMING: 'safe' }).format, 'youtube-shorts');
});

test('wait for a conversion to finish and propagate recorded failures', async () => {
  const good = { jobs: [{ id: 'a', state: 'captured' }], process: async function () { this.jobs[0].state = 'ready'; } };
  assert.equal((await awaitReadyJobs(good, ['a'], { sleep: async () => {} }))[0].state, 'ready');
  const bad = { jobs: [{ id: 'b', state: 'failed', error: 'invalid webm' }], process: async () => {} };
  await assert.rejects(awaitReadyJobs(bad, ['b']), /invalid webm/);
  await assert.rejects(awaitReadyJobs(good, ['missing']), /disappeared/);
});
