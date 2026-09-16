# Training log — A/B

A single-page A/B training logger that runs from the iPhone home screen, offline.
One HTML file, one worker, one manifest, three icons. No build step, no framework,
no dependencies, no network calls at runtime.

## Install on the phone

1. Open the Pages URL in **Safari** (not Chrome — only Safari can install a PWA on iOS).
2. Share → **Add to Home Screen**.
3. Launch it once while online so the worker caches the shell. After that it opens with no signal.

## How it stores

Everything lives in `localStorage` under a single key, `training-log-v1`, as one JSON blob —
sessions and the in-progress draft together. Synchronous, so there is no save race and no
`async` anywhere in the storage path.

If a write fails (private mode, storage full) the app toasts
*"Could not save to this device"* rather than failing silently. Reads that hit corrupt JSON
degrade to an empty log instead of throwing.

**The phone is not the archive.** iOS can evict site data under storage pressure. Sessions get
pasted into the Notion database *Training Log*, which is the system of record — that is what
**Copy all sessions** at the bottom of the ledger is for. It emits every session in the same
plain-text block the per-session Copy uses, newest first, blank line between.

## Filling it in when you can't be bothered

Above the movements are three buttons — **Low**, **Mid**, **Top**. Each fills every blank rep
field from that movement's prescription, and every blank load from last time:

| Target | Low | Mid | Top |
|---|---|---|---|
| `4 × 5–8` | `5, 5, 5, 5` | `6, 6, 6, 6` | `8, 8, 8, 8` |
| `3 × 12–15` | `12, 12, 12` | `13, 13, 13` | `15, 15, 15` |

They fill the form — they do not save. You still tap **Save session**, so a wrong number gets
caught before it lands in the ledger.

Tapping a second one re-fills whatever the first put there, so Low → Top is fine. Anything you
typed yourself, or pulled in with **Same again**, is left alone.

## Notion sync (optional)

The page cannot call Notion. `api.notion.com` returns no CORS headers at all, so the browser
blocks the request before it is sent — verified, not assumed. And a Notion token in client-side
JS on a public repo would hand write access to anyone who reads the source.

So `worker.js` sits in between: the phone POSTs a session to the worker, the worker writes the
row. The token lives in Cloudflare as an encrypted secret and never reaches the phone.

    phone  ->  your Cloudflare Worker (holds the token)  ->  Notion API

A POST carrying an `id` **updates that row** rather than creating one; without an `id` it
creates. That is what makes editing a saved session safe — the alternative was a second Notion
row for the same session, and the connector has no delete. The id is checked against a strict
32-hex pattern before it goes anywhere near a URL, because the token can write to every page the
integration can see.

⚠ **Editing needs the worker redeployed.** The app sends the `id`; a worker still running the
create-only version will ignore it and write a duplicate row. Redeploy `worker.js` before
relying on Edit.

### Setting it up

1. **Notion integration.** notion.so/my-integrations → New integration → internal, this
   workspace. Copy the `ntn_...` token. Then open the Training Log database → ⋯ → Connections →
   add the integration. Without that last step every write returns 404.
2. **Cloudflare Worker.** dash.cloudflare.com → Workers & Pages → Create → Worker. Paste
   `worker.js` over the default code and deploy.
3. **Settings → Variables:**
   - `NOTION_TOKEN` — *secret* (encrypt it), the `ntn_...` value
   - `NOTION_DB` — plain var, `5ad1fd6d-1ec9-42ba-a15c-b120e429c5fc`
   - `ALLOWED_ORIGIN` — plain var, `https://fongkaimun1987-creator.github.io`
   - `NOTION_DS` — only if a write fails complaining about data sources; set it to
     `6af8ccf0-3d3f-4765-a137-ea01ae28beb1` and the worker switches to the newer API automatically
4. **In the app**, scroll to *Notion sync* and paste the worker URL.

### Why the URL is typed in, not committed

The relay URL is stored in `localStorage` on the device, never in this repo. A public source tree
therefore does not carry the endpoint. Anyone who did learn the URL could only append rows to this
one database — the worker validates shape, writes one row, and reads nothing back.

### What it guarantees

Local-first, always. Saving writes to `localStorage` and returns; the network call happens after
and can fail freely. A session that has not reached Notion keeps a **not synced** badge in the
ledger and a *Sync now* button appears. Retries happen on app open and when the device comes back
online, and only unsynced sessions are sent, so a retry cannot duplicate a row.

This is the answer to the original "no automatic write" rule. That rule existed because a *silent*
failure mid-workout is worse than no write. This never fails silently and never blocks the save.

## Deliberately not built: reading back from Notion

Sync is one way. The app writes to Notion and never reads, so the ledger, the **Last:** recall and
the load progression all read this device's `localStorage` only.

That is fine while one phone does the logging. It stops being fine the moment a second device
logs a session: both would write to Notion correctly, but each device's recall would see only its
own history and quietly give you the wrong "last time" numbers. Silently wrong, not visibly broken.

Considered and deferred on 2026-09-13. If it is wanted later, the shape is:

- a read endpoint on the worker that queries the Training Log
- the app merges recent sessions on open, local copy still the thing you log into, so offline holds
- a hidden `Key` property on the database carrying the local session id, because Notion rows have
  no stable link back to one and a retry would otherwise duplicate rows
- a random token in the pasted relay URL, checked by the worker. The URL is write-only today, so
  leaking it means someone can add junk. Add reads and it hands over bodyweight and notes too.

## Deploying an update

The worker is deliberately cache-first, so a phone that has the app installed will keep serving
its cached copy and **will not see a new deploy** until the cache name changes.

Bump the version in `sw.js` every time you push a change:

```js
const CACHE = 'training-log-v1';   // -> v2, v3, ...
```

On the next launch with signal, the new worker installs, drops the old cache, and takes over.

The precache deliberately uses `new Request(u, {cache: 'reload'})`. Without it `addAll()` reads
through the browser's own HTTP cache, so a new worker precaches the stale copy it already had
and the update silently never lands — bumping `CACHE` wouldn't save you. This was caught in
testing, not in theory.

Note that `caches.match` runs with `ignoreSearch: true`, so a `?cachebust=` query string will
*not* get you a fresh copy while a worker is installed. To see a deploy immediately on a
desktop browser, unregister the worker in DevTools → Application → Service Workers.

## Files

| File | Why |
|---|---|
| `index.html` | The whole app — markup, styles, logic |
| `sw.js` | Cache-first offline shell; bump `CACHE` to ship updates |
| `manifest.webmanifest` | `display: standalone`, icons, theme |
| `icon-180.png` | `apple-touch-icon` for the iOS home screen |
| `icon-192.png` / `icon-512.png` | Manifest icons, 512 doubles as maskable |
| `.nojekyll` | Stops GitHub Pages running the files through Jekyll |

## Deliberate, not oversights

- **Two sessions, A and B**, five movements each, all visible on open. Not behind a tap.
- **Last-time recall per movement** with *Same again*. During a cut the goal is holding load,
  so the previous numbers stay visible while typing.
- **Reps as free text** (`8, 7, 6, 6`), not one input per set. Faster on a phone.
- **Draft autosave**, 600ms after the last keystroke. A session gets logged in pieces across
  45 minutes; closing the app mid-session loses nothing.
- **No *blocking* Notion write.** The original rule was "no API integration at all", because a
  silent failure mid-workout is worse than no write. Sync now exists, but it keeps the spirit of
  that rule: the save completes locally first, the write happens after, and a failure is visible
  in the ledger rather than swallowed. Never make saving wait on the network.
- **No Google Fonts.** The original loaded Archivo over the network, which would have failed
  on exactly the cold offline launch this app exists for. System grotesque stack instead.

Out of scope, permanently: volume maths, RPE, tempo, charts, streaks, PR tracking, social.
The value is in how little it asks for.
