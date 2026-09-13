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
- **No Notion API write.** A silent write failure mid-workout is worse than no write.
  Copy-paste out is the choice. Do not add an integration.
- **No Google Fonts.** The original loaded Archivo over the network, which would have failed
  on exactly the cold offline launch this app exists for. System grotesque stack instead.

Out of scope, permanently: volume maths, RPE, tempo, charts, streaks, PR tracking, social.
The value is in how little it asks for.
