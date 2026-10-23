# BlockRush batch recording, publishing and live

Branch: `codex/youtube-bot-publishing`. Web package version: `1.2.0`.

The GitHub Pages game remains a static site. Upload credentials and live stream
keys belong in a worker, never in browser code or GitHub Pages assets. This
implementation adds a **local Node worker** and an optional game control panel.
It does not create social accounts, connect channels or publish anything by
default. Batch capture requires one browser tab-sharing selection per session.
The PC, browser tab and worker must remain running and awake.

## Publishing dashboard

Open <http://127.0.0.1:8765/publisher/> or use **Open publishing dashboard** in
the recorder panel. Leave the recorder tab open when recording; the dashboard
opens separately and refreshes every five seconds.

- Global clip counts, ready/scheduled/published totals, library storage and
  recorded duration. Search, status filters and pagination cover the full queue.
- Bot speed, score and moves from the open recorder tab; stale sessions are
  labelled inactive. Live metrics show the encoder and bytes sent, not viewers
  or proof that a destination is publicly live.
- Clip details, authenticated MP4 previews/downloads, activity history, per-channel
  results and links to published posts when returned by Postiz.
- Persistent queue pause/resume, clip hold/release and retry for local failures.
  An in-progress step may finish after pausing. Unknown or already-submitted
  posts cannot be blindly retried from this UI.
- Postiz status sync automatically runs about once a minute when configured;
  **Sync publication status** also requests it manually. Only explicit
  `PUBLISHED` results for every submitted target produce a Published clip.
  Mixed results are labelled Partly published; provider errors remain visible.

No accounts, social view counts, revenue or example jobs are fabricated. This
dashboard uses the local worker; the exported page on GitHub Pages explains
how to open it locally. Channel credentials remain in the worker configuration.

## Start on this PC

Requirements: Node 20.19+ and FFmpeg on PATH (or set `FFMPEG_PATH`).

```powershell
npm ci
npm run publisher:build
npm run publisher
```

Open <http://127.0.0.1:8765/play/?bot=1&speed=4&publisher=1> in desktop Chrome or
Edge. Set clip count (1–50), duration (6–60 seconds), and audio, then choose
**Record clips** and select this browser tab. The bot enables automatic restart.
Each clip is transferred to `publisher/data/`, converted to 1080×1920 H.264/AAC
MP4, and added to a durable queue. Independent recorder segments share the same
capture session; each file has its own container header. The panel offers MP4
downloads when conversion finishes. Stop the batch to end capture.

Keep all of the game visible. The recorder rejects offscreen captures. Do not
start the ordinary recorder at the same time. The browser may still throttle a
background/minimized tab; this is not an unattended cloud capture service.

## Scheduled multi-channel uploads with Postiz

Use [Postiz](https://github.com/gitroomhq/postiz-app), self-hosted or cloud, for
OAuth connections, channel management and scheduling. Its own account setup and
platform access are separate from BlockRush. See the official
[YouTube setup](https://docs.postiz.com/self-host/providers/youtube).

1. Connect the channels you own/manage in Postiz.
2. Copy `publisher/config.example.json` to `publisher/config.local.json`.
3. Populate `channels` with the Postiz integration IDs and provider-specific
   settings. The `channelExample` object is documentation only; it is ignored.
4. Set the **server-side** `POSTIZ_API_KEY` environment variable.
5. Set `mode` to `draft` for drafts or `schedule` for automatic scheduled posts.
   `local` only prepares MP4s on disk. The default schedule interval is three
   hours; configure `intervalMinutes` for your own publishing cadence.
6. Restart the worker. It processes ready clips already in its queue too.

API bases:

- Cloud: `https://api.postiz.com/public/v1`
- Self-hosted: `https://YOUR_POSTIZ_HOST/api/public/v1`

Each clip is uploaded once to Postiz and submitted to all configured channels.
YouTube privacy (`public`, `unlisted`, `private`) must be explicit in each
channel's `settings.type`; choose the appropriate audience declaration too.
Other providers require their own settings schema. See
[create post](https://docs.postiz.com/public-api/posts/create),
[media upload](https://docs.postiz.com/public-api/uploads/upload-file), and
[YouTube settings](https://docs.postiz.com/public-api/providers/youtube).

Queue states: `captured` → `converting` → `ready` → `uploading` → `sending` → `draft` or
`scheduled`. Scheduled means accepted by Postiz, **not confirmed published by
the social platform**. Check the Postiz dashboard for publication outcomes.
Network loss during submission produces `unknown` and is never automatically
retried: inspect Postiz before reconciling it, to avoid duplicate publication.
Other failures are held as `failed`, also requiring inspection. Don't delete
the queue to retry publishing. Job IDs and content hashes prevent duplicate
capture submissions within this worker's history.

The worker never exposes the API key or RTMP URL in its status response. It
binds only to `127.0.0.1`, validates Host/Origin, and requires a per-session token
for uploads, downloads and the video WebSocket. Config, queue and videos are
Git-ignored. Keep that local data private and back it up separately.

## Live to YouTube and other RTMP destinations

Create/configure the live event in the destination platform or a restreaming
service. The worker sends a live feed; it does not create a YouTube broadcast
or change its visibility. YouTube's event must be ready for an encoder, with
auto-start enabled if you want it to start when video arrives.

Set `PUBLISHER_RTMP_URL` in the worker's environment to the complete RTMP/RTMPS
ingest URL including its private stream key. Never commit the URL or paste it
into chat. Then restart the worker and select **Send live feed** in the panel.
Choose this tab; cropped WebM chunks are sent to the local worker, which encodes
H.264/AAC FLV and forwards them to the destination. Batch and live capture are
separate modes. Stop ends the feed; ending/archiving the event depends on the
destination's settings. `encoding` in the local panel is not proof that the
event is public or healthy: verify it in the destination dashboard.

For multiple simultaneous live destinations, send the worker's single feed to
[datarhei/Restreamer](https://github.com/datarhei/restreamer), then configure its
outputs for each service that provides an authorized ingest URL. Run that
service separately; it is not installed by BlockRush.

## Snapchat and Chinese platforms

- **Snapchat Spotlight:** official posting is available through the
  [Public Profile API](https://developers.snap.com/marketing-api/Public-Profile-API/ProfileAssetManagement),
  but [API access is allowlisted](https://developers.snap.com/marketing-api/Public-Profile-API/GetStarted).
  No Snapchat uploader is implemented in this worker. MP4 export is available
  for a supported scheduler or manual publishing.
- **Bilibili, Douyin, Kuaishou, Xiaohongshu, WeChat Channels:**
  [dreammis/social-auto-upload](https://github.com/dreammis/social-auto-upload)
  is an existing separate CLI option. Several adapters automate creator web
  pages using saved login sessions; coverage and reliability vary by platform.
  It is not installed, connected or invoked by this implementation. Use the
  exported MP4s after logging into your own authorized accounts there.

Keep external publishing/streaming services separate from the game source.
Postiz declares AGPL-3.0, social-auto-upload MIT, and Restreamer Apache-2.0 in
their repositories (checked 2026-10-23). No source from these projects is copied
into BlockRush. Deployment/license obligations still need checking if you
modify or redistribute those services.

## Validation and limits

Unit tests cover queue persistence, channel visibility, spaced scheduling,
duplicate suppression, ambiguous submissions, and local request restrictions.
Recorder tests cover segmentation and capture cleanup. These tests use mocked
platform responses. Real Postiz publishing and public live delivery require
connected accounts, credentials and a destination-side test; they are not
claimed to be active merely because the local build passes.

Run `npm test` for unit tests. On a machine with FFmpeg, set
`PUBLISHER_FFMPEG_TEST=1` and run `npm test` to also exercise the real local
HTTP → FFmpeg → MP4 pipeline and WebSocket → FFmpeg → loopback RTMP pipeline.
These integration tests use temporary directories and a local receiver; they
never upload a test clip to a social account.
