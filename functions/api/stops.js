export async function onRequestGet(context) {
  const reqUrl = new URL(context.request.url);
  const debug = reqUrl.searchParams.get('debug') === '1';
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*'
  };

  const baseUrl = new URL('/data/stops.json', context.request.url).toString();
  let baseStops = [];
  try {
    const baseRes = await fetch(baseUrl, { cf: { cacheTtl: 0, cacheEverything: false } });
    baseStops = await baseRes.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'failed_to_load_base_stops' }), { status: 500, headers });
  }

  const liveUrl = (context.env.LIVE_STOPS_URL || '').trim();
  const parseJsonText = (text) => JSON.parse(String(text || '').replace(/^\uFEFF/, '').replace(/\u0000/g, '').trim());
  const withCacheBust = (urlLike) => {
    const u = new URL(urlLike);
    // Minute-level cache busting avoids stale CDN copies while keeping the URL stable-ish.
    u.searchParams.set('_ts', String(Math.floor(Date.now() / 60000)));
    return u.toString();
  };

  let liveStops = [];
  let liveMeta = null;
  let liveStatus = null;
  let liveUrlUsed = '';
  if (liveUrl) {
    try {
      liveUrlUsed = withCacheBust(liveUrl);
      const liveRes = await fetch(liveUrlUsed, {
        cache: 'no-store',
        cf: { cacheTtl: 0, cacheEverything: false }
      });
      liveStatus = liveRes.status;
      if (liveRes.ok) {
        const payload = parseJsonText(await liveRes.text());
        liveStops = Array.isArray(payload) ? payload : (payload.stops || []);
        liveMeta = Array.isArray(payload) ? null : (payload.meta || null);
      } else {
        liveMeta = { warning: 'live_source_http_error' };
      }
    } catch (err) {
      liveStatus = 0;
      liveMeta = { warning: 'live_source_unreachable' };
    }
  }

  const merged = new Map(baseStops.map(s => [s.id, { ...s }]));
  for (const stop of liveStops) {
    if (!stop?.id) continue;
    const prev = merged.get(stop.id) || {};
    merged.set(stop.id, { ...prev, ...stop });
  }

  const result = {
    meta: {
      liveUrlConfigured: Boolean(liveUrl),
      liveStatus,
      baseCount: baseStops.length,
      liveCount: liveStops.length,
      mergedCount: merged.size,
      message: liveUrl
        ? `נתוני בסיס + עדכון חי (${liveStops.length})`
        : 'נתוני בסיס בלבד — אין מקור live overrides',
      ...(liveMeta || {}),
      ...(debug ? { liveUrlUsed } : {})
    },
    stops: Array.from(merged.values())
  };

  return new Response(JSON.stringify(result), { status: 200, headers });
}
