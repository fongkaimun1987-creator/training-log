/* Cloudflare Worker — relays one training session into the Notion database.
 *
 * This exists because api.notion.com sends no CORS headers, so a browser can
 * never call it directly. The page calls this instead; this calls Notion.
 * The Notion token lives here as an encrypted secret and never reaches the phone.
 *
 * Secrets/vars to set (see README):
 *   NOTION_TOKEN    secret  - ntn_... integration token
 *   NOTION_DB       var     - the Training Log database id  (classic path)
 *   NOTION_DS       var     - the data source id, if the classic path is refused
 *   ALLOWED_ORIGIN  var     - https://fongkaimun1987-creator.github.io
 */

/* Notion moved databases to a "data source" model. Older tokens/databases still
 * accept parent:{database_id} on 2022-06-28; the newer model wants a
 * data_source_id on 2025-09-03. Set NOTION_DS to use the new path, NOTION_DB for
 * the old one, so a rejection on one doesn't mean rewriting this file. */
const OLD_VERSION = '2022-06-28';
const NEW_VERSION = '2025-09-03';

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '86400'
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, cors);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'body was not JSON' }, 400, cors); }

    // Shape check. This endpoint writes one row to one database and nothing
    // else, so anything that isn't a session is refused before Notion is touched.
    if (body.type !== 'A' && body.type !== 'B') return json({ error: 'type must be A or B' }, 400, cors);
    if (!Array.isArray(body.lifts))             return json({ error: 'lifts must be an array' }, 400, cors);
    if (body.lifts.length > 20)                 return json({ error: 'too many lifts' }, 400, cors);

    const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
    const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

    const liftText = body.lifts
      .filter(l => l && (l.weight || l.reps))
      .map(l => clip(l.n, 80) + (l.weight ? ' ' + clip(l.weight, 24) : '') + (l.reps ? ': ' + clip(l.reps, 60) : ''))
      .join('\n');

    const ts = body.ts && !isNaN(Date.parse(body.ts)) ? body.ts : new Date().toISOString();

    const props = {
      'Session': { title: [{ text: { content: ts.slice(0, 10) + ' — Session ' + body.type } }] },
      'Type':    { select: { name: body.type === 'A' ? 'A - Pull/hinge' : 'B - Push/squat' } },
      'Date':    { date: { start: ts } },
      'Lifts':   { rich_text: [{ text: { content: clip(liftText, 1900) } }] }
    };
    const bw = num(body.bw);     if (bw !== null) props['Bodyweight'] = { number: bw };
    const cm = num(body.cardio); if (cm !== null) props['Cardio min'] = { number: cm };
    const note = clip(body.note, 1900);
    if (note) props['Notes'] = { rich_text: [{ text: { content: note } }] };

    const useDS  = !!env.NOTION_DS;
    const version = useDS ? NEW_VERSION : OLD_VERSION;
    const parent  = useDS
      ? { type: 'data_source_id', data_source_id: env.NOTION_DS }
      : { database_id: env.NOTION_DB };

    let res, out;
    try {
      res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + env.NOTION_TOKEN,
          'Notion-Version': version,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ parent, properties: props })
      });
      out = await res.json().catch(() => ({}));
    } catch (e) {
      return json({ error: 'could not reach Notion: ' + e.message }, 502, cors);
    }

    if (!res.ok) return json({ error: out.message || 'Notion rejected the write', status: res.status }, 502, cors);
    return json({ ok: true, id: out.id, url: out.url }, 200, cors);
  }
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}
