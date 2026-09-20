# Training log

A single-page A/B/C/D training logger that runs from the iPhone home screen, offline.
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

## Extras: work the session's own list doesn't carry

Under the movements is **+ Add a movement**. Pick from the list of things that are in every gym,
grouped push / pull / legs / core, or choose *Something else...* and type a name. Up to six, each
with the same load box and per-set rep boxes as a prescribed movement, each with a **Remove**.

An extra is stored in the session's `lifts` array with an `x` flag and is otherwise an ordinary
lift - it copies, it exports, it syncs. **The relay contract is unchanged, so the worker needs no
redeploy to accept one.**

This exists because of 19 Sep 2026. Three sets of dips after a Session C had nowhere to go, so
they were logged as a whole second Session B - a row in the ledger and in Notion that claimed to
be a session and was really four movements' worth of last time's loads with nothing done to them.
Extra work now lands on the session it was actually done in.

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

## Two questions it asks before saving

**"You already logged Session C at 11:40 today. Add this to it?"** Answering yes moves what you
just logged onto that session as extras and updates its existing Notion row in place. Only
movements with reps move across - a load sitting in a box on its own is prefill, not work, and
carrying it over is precisely how the 19 Sep row was born. Cardio minutes add together; a second
run at the same movement is kept as its own line rather than merged into one.

**"No reps logged for Lateral raise, Weighted hanging leg raise. Save anyway?"** A prescribed
movement with no reps is one you didn't do, and the load in its box was put there by the prefill.
Not asked when *none* of them were done - that is an extras-only day and it is allowed.

## What "Last:" is allowed to say

Recall is resolved **per movement**, not per session. It used to take the whole of the most recent
session of that type, so one movement left blank there erased that movement's history for good.

Two records come back: the freshest thing recorded for that movement, and - if that record is
half-filled - the last session that recorded a load **and** reps together. They are displayed
apart (`Last: 10, 10, 10 | 13 Sept: +5kg - 8, 8, 8, 8`) and never joined, because reading them as
one line is how you end up believing you lifted something you didn't.

A progression decision only ever stands on a record that has both, and a carried record only
speaks for a load if it is the same load. The date is named whenever the judgement came from an
older session than the last one.

Both directions of this were live bugs on 19 Sep: the stub Session B took the +5kg off the dip
recall, and it swallowed `20kg x 10, 10, 10` on the overhead press - which was the one lift
sitting above its rep target and due an increase.

Under that, when the same movement was logged more recently under a different letter, a muted
line says so: `Also 17 Sept, session D: 5kg - 5, 5, 5, 4`. A weighted pull-up lives in A, C and D
and each letter keeps its own memory of it, so the one lift can quietly drift into three
different loads. It is shown and nothing more - it never prefills a box and never feeds a
progression decision, because the sets around it were different.

**Bodyweight** prefills from the last session that recorded one. It is the one number that is a
standing fact rather than a fact about today, and it was being retyped every time. A prefilled
bodyweight does not on its own count as having typed something, so it can't save an empty session.

But see below: a prefilled number is no longer allowed to pass as a measurement.

## What a bodyweight reading is allowed to claim

The prefill above was quietly manufacturing data. A carried number saved and synced exactly like a
typed one, and nothing on the row said which it was. On 20 Sept 2026 the Notion database held five
sessions and **every one read 76kg** - arithmetically indistinguishable from one number typed on
the 13th and carried forward four times. Nobody could have caught it by looking.

So every session now records how its bodyweight got there:

| `bwEntry` | Means | In the ledger |
|---|---|---|
| `typed` | Entered for this session | `75.4kg` |
| `carried` | The prefill put it there and nobody touched it | `76kg carried` |
| *absent* | Logged before this build - unknowable | `76kg unverified` |

While a carried number is sitting in the box it says so: the field goes dashed and muted, with
*"Carried from 19 Sept - type today's weight to record one."* under it. Typing anything clears
both, the same way typing over any prefill does. Reopening a saved session restores whichever
state it was saved in, so resaving an old row can't silently promote it to a measurement.

The number still prefills. It is genuinely useful and the weigh-in is a two-second job at the
scale. What changed is that it can no longer lie about where it came from.

**Migration: there isn't one.** Sessions logged before this build have no `bwEntry` and are left
exactly as they are - nothing is rewritten, nothing is guessed, and the app doesn't touch storage
on first open. An absent value means *unknown*, which is the only honest reading of those rows.
They are not backfilled into any weight series, for the same reason.

⚠ **Notion can't see this yet.** The relay still sends `bw` as a bare number to the `Bodyweight`
column, so a carried reading lands there looking like any other. Teaching Notion the difference
needs an `Entry` property and a worker redeploy - that is the next phase, not this one.

## The weigh-in, and the one question it asks

The weigh-in happens **pre-gym** - on the scale before the session starts, not at a fixed hour.
That anchors every reading to the same point in the same routine: same scale, same gym, before any
training. The one thing it doesn't control is the meal.

So once a weight has been **typed**, two buttons appear under it: **Pre-meal** / **Post-meal**.
One tap, and the session will not save without it.

A lunch and a drink is ~0.5-1.0kg of transit mass. Against the ~0.8-1.2kg spread of gym weighing
that is absorbed - *as long as the mix of pre- and post-meal readings stays stable*. A drifting mix
(mostly pre-meal one month, mostly post-meal the next) injects a spurious half-kilo step that is
arithmetically indistinguishable from real loss. The tap costs a second and buys two things that
are otherwise unrecoverable: filter the series to pre-meal only, or estimate the offset from the
data once there are enough of both.

It asks "had you eaten yet", not "within three hours", because three hours ago is a calculation
and a question you have to work out is one that gets answered carelessly for four weeks.

**It appears only for a typed reading.** A carried number is not a measurement, so its meal would
describe nothing.

## What reaches the Weight database

Only a typed reading with an answered meal. That is structural, not a convention: the app omits
`bwEntry` for carried and empty readings, and the relay writes a weight row only when `bwEntry` is
present. So there is no path that puts an unanswered row in a database with no delete.

Readings are normalised to **0.1kg** at save - `75.43` is stored `75.4`. Applied at save and never
while typing, or it would fight `75.` on its way to `75.4`.

A session carries its weight row's id once written, so an edit updates that row rather than adding
a second. And if the weight row fails on its own - an unconnected database answers 404 - the
session stays **unsynced** and the whole push retries. That is safe because both ids are stored
first: the retry updates two rows instead of creating them.

## Backup and restore

**Download backup** writes every session to a `training-log-YYYY-MM-DD.json` file.
**Restore from file** reads one back.

Restore is keyed by session id, so the same file twice adds nothing, and a session already on the
device always wins - it is the newer of the two, and its sync flags are the ones that match what
Notion actually holds. If any restored session is not marked as written to Notion, it asks once
before agreeing to send it: the backup may predate that session's sync, and a second write means
a duplicate row the connector cannot delete.

The relay URL is deliberately **not** in the file. It is kept out of the repo for the same reason
it should not travel in a backup.

This exists because iOS evicts site data under storage pressure and sync is one way: Notion is
written to and never read. The only copy of the ledger that can come back is one you took.

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
   - `NOTION_WEIGHT_DB` — plain var, `7e0da55c-6ea4-497b-af15-f64e701956be`, the **Weight**
     database. Leave it unset and weight rows are simply not written; everything else still works.
   - `NOTION_WEIGHT_DS` — the same data-source fallback as `NOTION_DS`, for the Weight database:
     `55ac4c6f-0eec-4b11-98a3-bb7ce1bb32a5`

   The Weight database needs its own **Connections → add the integration**, exactly like the
   Training Log. Sharing a parent page is not enough; without it every weight write returns 404.

   A weight row is only written when the app sends `bwEntry` - so this worker can be deployed
   ahead of the app that feeds it, and nothing changes until that app ships.
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

Considered and deferred on 2026-09-13. Considered again on 2026-09-19 and deferred again, in
favour of the file backup above: the risk being insured against is losing the ledger, and a file
covers that without a hand-deployed worker, a new database property, or a relay URL that can be
read as well as written to. Read-back is still the only answer to logging from a second device.

If it is wanted later, the shape is:

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

- **Four sessions.** A and B alternate, five movements each; C substitutes for either, D is the
  short one. All visible on open, not behind a tap.
- **Last-time recall per movement** with *Same again*. During a cut the goal is holding load,
  so the previous numbers stay visible while typing.
- **One rep box per set**, growing by one when the last is used. The numeric keypad has no comma
  key, so the single free-text field this replaced could never actually be typed on a phone.
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
