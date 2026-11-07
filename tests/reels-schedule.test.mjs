import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseJob, candidate, commentEvents, statusComment, maxAttempts,
  supportedFormats, leaseMs, pickDueJob, finalizeJob,
} from '../scripts/reels-schedule.mjs';

const owner = 'jessicacarter9955';
const runId = 43210;
const iso = '2026-11-01T12:00:00Z';
const payload = (overrides = {}) => JSON.stringify({
  runAt: iso, count: 1, seconds: 15, speed: 4, format: 'instagram-reels',
  framing: 'safe', ...overrides,
});
const issue = (overrides = {}) => ({
  number: 7, state: 'open', title: '[REEL] short', user: { login: owner },
  body: payload(), ...overrides,
});
const botEvent = (kind, priorRunId = 20, created_at = '2026-11-07T12:00:00Z') => ({
  user: { login: 'github-actions[bot]' }, created_at,
  body: statusComment(kind, priorRunId, { attempt: 1 }),
});

test('strict JSON, UTC time and all actual social/display formats', () => {
  assert.equal(parseJob('```json\n' + payload() + '\n```').format, 'instagram-reels');
  for (const format of supportedFormats)
    assert.equal(parseJob(payload({ format })).format, format);
  assert.equal(supportedFormats.size, 15);
  assert.throws(() => parseJob(payload({ runAt: '2026-02-30T18:00:00Z' })), /valid UTC/);
  assert.throws(() => parseJob(payload({ runAt: '2026-11-10T18:00:00+01:00' })), /UTC ISO/);
  assert.throws(() => parseJob(payload({ extra: 'unexpected' })), /fields/);
  assert.throws(() => parseJob(payload({ format: 'unknown' })), /Unsupported/);
  assert.throws(() => parseJob(payload({ count: 4 })), /count/);
  assert.throws(() => parseJob(payload({ speed: 0 })), /speed/);
  assert.throws(() => parseJob(payload({ format: 'gameplay-portrait-4k', seconds: 60 })), /4K/);
});

test('due jobs must be owner-authored and never run before schedule', () => {
  const now = Date.parse('2026-11-07T13:00:00Z');
  assert.equal(candidate(issue(), parseJob(payload()), [], { owner, now }).status, 'ready');
  assert.equal(candidate(issue({ user: { login: 'other' } }), parseJob(payload()), [], { owner, now }).status, 'unauthorized');
  assert.equal(candidate(issue({ state: 'closed' }), parseJob(payload()), [], { owner, now }).status, 'ignore');
  assert.equal(candidate(issue({ title: 'hello' }), parseJob(payload()), [], { owner, now }).status, 'ignore');
  assert.equal(candidate(issue(), parseJob(payload({ runAt: '2027-11-07T13:00:00Z' })), [], { owner, now }).status, 'not-due');
});

test('comments only from GitHub bot are trusted, lease and retry cap work', () => {
  const started = botEvent('started');
  const now = Date.parse(started.created_at) + 10_000;
  assert.equal(candidate(issue(), parseJob(payload()), [started], { owner, now }).status, 'leased');
  assert.equal(candidate(issue(), parseJob(payload()), [started], { owner, now: now + leaseMs + 1 }).status, 'ready');
  const forged = { ...started, user: { login: 'someone-else' } };
  assert.equal(commentEvents([forged]).length, 0);
  const allFailed = Array.from({ length: maxAttempts }, (_, i) => botEvent('started', i + 1, '2026-11-06T10:00:00Z'));
  assert.equal(candidate(issue(), parseJob(payload()), allFailed, { owner, now }).status, 'exhausted');
  assert.equal(candidate(issue(), parseJob(payload()), [botEvent('completed')], { owner, now }).status, 'complete');
});

test('picks earliest due owner job once and appends authoritative comment', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      const body = String(url).includes('/issues?') ?
        [issue({ number: 12, body: payload() }), issue({ number: 11, user: { login: 'random' } })] :
        String(url).endsWith('/issues/12/comments?per_page=100&page=1') ? [] : {};
      return { ok: true, status: 200, json: async () => body };
    };
    const out = await pickDueJob({
      GITHUB_REPOSITORY: 'jessicacarter9955/block-rush',
      GITHUB_TOKEN: 'fake-token', GITHUB_RUN_ID: String(runId),
    });
    assert.equal(out.has_job, 'true');
    assert.equal(out.issue_number, 12);
    assert.equal(calls.filter(c => c.options.method === 'POST').length, 1);
    assert.match(JSON.stringify(calls), /started/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('recovers a previously uploaded artifact without rendering a duplicate', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      const target = String(url);
      const body = target.includes('/issues?') ? [issue()] :
        target.includes('/issues/7/comments?') ? [botEvent('started', 12345, '2020-01-01T00:00:00Z')] :
        target.includes('/actions/runs/12345/artifacts?') ?
          { artifacts: [{ name: 'BlockRush-Queued-7-12345', expired: false }] } : {};
      return { ok: true, status: 200, json: async () => body };
    };
    const out = await pickDueJob({
      GITHUB_REPOSITORY: 'jessicacarter9955/block-rush',
      GITHUB_TOKEN: 'fake-token', GITHUB_RUN_ID: String(runId),
    });
    assert.equal(out.has_job, 'false');
    assert.equal(calls.filter(c => c.options.method === 'PATCH').length, 1);
    const recovery = calls.find(c => c.options.method === 'POST');
    assert.match(JSON.parse(recovery.options.body).body, /actions\/runs\/12345/);
    assert.doesNotMatch(JSON.parse(recovery.options.body).body, /Rendering avviato/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('finalize closes only after both rendering and artifact succeed', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return { ok: true, status: 200, json: async () => String(url).includes('/comments?') ? [] : {} };
    };
    const env = { GITHUB_REPOSITORY: 'jessicacarter9955/block-rush',
      GITHUB_TOKEN: 'fake-token', GITHUB_RUN_ID: String(runId),
      REELS_ISSUE_NUMBER: '12', REELS_RENDER_OUTCOME: 'success',
      REELS_ARTIFACT_OUTCOME: 'failure' };
    await finalizeJob(env);
    assert.equal(calls.filter(c => c.options.method === 'PATCH').length, 0);
    env.REELS_ARTIFACT_OUTCOME = 'success';
    await finalizeJob(env);
    assert.equal(calls.filter(c => c.options.method === 'PATCH').length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
