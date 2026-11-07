/**
 * Free, durable BlockRush Reels queue backed by GitHub Issues.
 *
 * Only issues authored by the repository owner are runnable. The issue body
 * contains a strictly validated JSON job; it is never evaluated as code.
 * GitHub Actions performs one due job per run (15-minute best-effort cron).
 * Bot comments form an audit trail and permit bounded retries/recovery.
 */
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const maxAttempts = 3;
export const leaseMs = 65 * 60_000;
export const supportedFormats = new Set([
  'instagram-reels', 'youtube-shorts', 'tiktok', 'snapchat',
  'douyin', 'instagram-feed', 'square',
  'youtube-landscape', 'bilibili', 'gameplay-portrait-fhd',
  'gameplay-portrait-4k', 'gameplay-landscape-fhd',
  'gameplay-landscape-4k', 'gameplay-ultrawide', 'gameplay-square',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function parseJob(body) {
  assert(typeof body === 'string' && body.length <= 20_000, 'Job body must be a short JSON description');
  const fenced = body.match(/```json\s*([\s\S]*?)```/i);
  const json = fenced ? fenced[1] : body;
  let data;
  try { data = JSON.parse(json.trim()); }
  catch { throw new Error('Job must contain valid JSON'); }
  assert(data && typeof data === 'object' && !Array.isArray(data), 'Expected a JSON object');
  const keys = Object.keys(data).sort();
  const expected = ['count', 'format', 'framing', 'runAt', 'seconds', 'speed'].sort();
  assert(JSON.stringify(keys) === JSON.stringify(expected), 'Job fields must be exactly runAt, count, seconds, speed, format, framing');
  assert(typeof data.runAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(data.runAt), 'runAt must be UTC ISO format, e.g. 2026-11-10T18:00:00Z');
  const date = new Date(data.runAt);
  assert(Number.isFinite(date.getTime()) && date.toISOString().replace('.000', '') === data.runAt, 'runAt is not a valid UTC timestamp');
  assert(Number.isInteger(data.count) && data.count >= 1 && data.count <= 3, 'count must be 1–3');
  assert([6, 15, 30, 45, 60].includes(data.seconds), 'seconds must be 6, 15, 30, 45 or 60');
  assert([2, 4, 8].includes(data.speed), 'speed must be 2, 4 or 8');
  assert(typeof data.format === 'string' && supportedFormats.has(data.format), 'Unsupported video format');
  assert(['fit', 'safe'].includes(data.framing), 'framing must be fit or safe');
  if (data.format.endsWith('-4k')) {
    assert(data.count === 1 && data.seconds <= 15, '4K is limited to one clip of up to 15 seconds on free runners');
  }
  return Object.freeze({ ...data, due: date.getTime() });
}

const marker = /<!-- blockrush-reel-queue ([\s\S]*?) -->/;
export function commentEvents(comments) {
  return comments
    .filter((comment) => ['github-actions[bot]', 'github-actions'].includes(comment.user?.login))
    .map((comment) => {
      const match = typeof comment.body === 'string' && comment.body.match(marker);
      if (!match) return null;
      try {
        const event = JSON.parse(match[1]);
        if (!['started', 'failed', 'completed', 'exhausted'].includes(event.kind)) return null;
        if (!Number.isInteger(event.runId) || event.runId <= 0) return null;
        return { ...event, createdAt: Date.parse(comment.created_at) };
      } catch { return null; }
    })
    .filter(Boolean);
}

export function candidate(issue, job, comments, { owner, now = Date.now() } = {}) {
  if (issue.state !== 'open' || issue.pull_request) return { status: 'ignore' };
  if (issue.user?.login?.toLowerCase() !== owner?.toLowerCase()) return { status: 'unauthorized' };
  if (!issue.title?.startsWith('[REEL]')) return { status: 'ignore' };
  if (job.due > now) return { status: 'not-due' };
  const history = commentEvents(comments);
  const attempts = history.filter((entry) => entry.kind === 'started').length;
  const last = history.at(-1);
  if (last?.kind === 'completed' || last?.kind === 'exhausted') return { status: 'complete' };
  if (last?.kind === 'started' && now - last.createdAt < leaseMs) return { status: 'leased' };
  if (attempts >= maxAttempts) return { status: 'exhausted', attempts, previous: last };
  return { status: 'ready', attempts, previous: last };
}

export function statusComment(kind, runId, { attempt, url, message } = {}) {
  const payload = { kind, runId, ...(attempt ? { attempt } : {}) };
  const safeMessage = String(message ?? '').slice(0, 600);
  const human = kind === 'started' ? `⏳ Rendering avviato (tentativo ${attempt}/${maxAttempts}).`
    : kind === 'completed' ? '✅ MP4 generati e salvati come artifact.'
    : kind === 'exhausted' ? '🛑 Tentativi esauriti. Creare una nuova issue per riprovare.'
    : `⚠️ Generazione non riuscita. ${safeMessage} Riproverò al prossimo ciclo.`;
  return `<!-- blockrush-reel-queue ${JSON.stringify(payload)} -->\n${human}\n${url ? `[Apri il run GitHub Actions](${url})` : ''}`;
}

function credentials(env) {
  const repo = env.GITHUB_REPOSITORY;
  assert(/^[-\w.]+\/[-\w.]+$/.test(repo ?? ''), 'GITHUB_REPOSITORY missing');
  assert(env.GITHUB_TOKEN, 'GITHUB_TOKEN missing');
  assert(/^\d+$/.test(env.GITHUB_RUN_ID ?? ''), 'GITHUB_RUN_ID missing');
  return { repo, owner: repo.split('/')[0], token: env.GITHUB_TOKEN, runId: Number(env.GITHUB_RUN_ID) };
}

function githubClient(env) {
  const { repo, owner, token, runId } = credentials(env);
  const base = `https://api.github.com/repos/${repo}`;
  async function request(path, { method = 'GET', body } = {}) {
    assert(path.startsWith('/'), 'Absolute GitHub API path required');
    const response = await fetch(base + path, {
      method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`GitHub ${method} ${path}: HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  }
  async function list(path, maxPages = 5) {
    const out = [];
    for (let page = 1; page <= maxPages; page++) {
      const batch = await request(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      if (!Array.isArray(batch)) throw new Error('GitHub listing did not return an array');
      out.push(...batch);
      if (batch.length < 100) break;
    }
    return out;
  }
  const runUrl = `https://github.com/${repo}/actions/runs/${runId}`;
  return { repo, owner, runId, runUrl, request, list };
}

async function postEvent(api, issueNumber, kind, { attempt, message, url } = {}) {
  await api.request(`/issues/${issueNumber}/comments`, {
    method: 'POST',
    body: { body: statusComment(kind, api.runId, { attempt, message, url: url ?? api.runUrl }) },
  });
}

async function closeIssue(api, issueNumber) {
  await api.request(`/issues/${issueNumber}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } });
}

async function artifactExists(api, issueNumber, runId) {
  try {
    const data = await api.request(`/actions/runs/${runId}/artifacts?per_page=100`);
    return data.artifacts?.some((artifact) => !artifact.expired &&
      artifact.name === `BlockRush-Queued-${issueNumber}-${runId}`) ?? false;
  } catch (error) {
    // Do not retry potentially completed jobs when artifact status is unknown.
    throw new Error(`Cannot check prior artifact before retry: ${error.message}`);
  }
}

export async function pickDueJob(env = process.env) {
  const api = githubClient(env);
  const now = Date.now();
  const issues = await api.list('/issues?state=open&direction=asc&sort=created');
  const due = [];
  for (const issue of issues) {
    if (issue.user?.login?.toLowerCase() !== api.owner.toLowerCase() ||
      !issue.title?.startsWith('[REEL]') || issue.pull_request) continue;
    let job;
    try { job = parseJob(issue.body ?? ''); }
    catch { continue; } // malformed jobs never execute
    if (job.due <= now) due.push({ issue, job });
  }
  due.sort((a, b) => a.job.due - b.job.due || a.issue.number - b.issue.number);

  for (const { issue, job } of due) {
    const comments = await api.list(`/issues/${issue.number}/comments`);
    const state = candidate(issue, job, comments, { owner: api.owner, now });
    if (state.status === 'exhausted') {
      await postEvent(api, issue.number, 'exhausted');
      await closeIssue(api, issue.number);
      continue;
    }
    if (state.status !== 'ready') continue;
    if (state.previous?.kind === 'started') {
      if (await artifactExists(api, issue.number, state.previous.runId)) {
        // The artifact belongs to the previous run, not this recovery scan.
        await postEvent(api, issue.number, 'completed', {
          url: `https://github.com/${api.repo}/actions/runs/${state.previous.runId}`,
        });
        await closeIssue(api, issue.number);
        continue;
      }
    }
    await postEvent(api, issue.number, 'started', { attempt: state.attempts + 1 });
    const fields = { has_job: 'true', issue_number: issue.number, count: job.count,
      seconds: job.seconds, speed: job.speed, format: job.format, framing: job.framing };
    if (env.GITHUB_OUTPUT) {
      for (const [key, value] of Object.entries(fields))
        appendFileSync(env.GITHUB_OUTPUT, `${key}=${value}\n`);
    }
    console.log(`Selected owner-authored issue #${issue.number}, attempt ${state.attempts + 1}`);
    return fields;
  }
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, 'has_job=false\n');
  console.log('No due, authorized Reels issues. Runner can exit without cost-heavy browser setup.');
  return { has_job: 'false' };
}

export async function finalizeJob(env = process.env) {
  const api = githubClient(env);
  const issue = Number(env.REELS_ISSUE_NUMBER);
  assert(Number.isInteger(issue) && issue > 0, 'Missing selected issue');
  const ok = env.REELS_RENDER_OUTCOME === 'success' && env.REELS_ARTIFACT_OUTCOME === 'success';
  const comments = await api.list(`/issues/${issue}/comments`);
  const already = commentEvents(comments).some(event => event.runId === api.runId && event.kind === 'completed');
  if (already) return;
  if (ok) {
    await postEvent(api, issue, 'completed');
    await closeIssue(api, issue);
    console.log(`Issue #${issue} completed; artifact available from run ${api.runId}`);
  } else {
    await postEvent(api, issue, 'failed', { message: 'Controlla i log del run per la causa.' });
    console.error(`Issue #${issue} failed, retained for a bounded retry`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const action = process.argv[2];
  try {
    if (action === 'pick') await pickDueJob();
    else if (action === 'finalize') await finalizeJob();
    else throw new Error('Usage: node scripts/reels-schedule.mjs <pick|finalize>');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
