export async function onRequestGet(context) {
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

  const liveUrl = context.env.LIVE_STOPS_URL || '';
  let liveStops = [];
  let liveMeta = null;
  if (liveUrl) {
    try {
      const liveRes = await fetch(liveUrl, { cf: { cacheTtl: 60, cacheEverything: false } });
      if (liveRes.ok) {
        const payload = await liveRes.json();
        liveStops = Array.isArray(payload) ? payload : (payload.stops || []);
        liveMeta = Array.isArray(payload) ? null : (payload.meta || null);
      }
    } catch (err) {
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
      baseCount: baseStops.length,
      liveCount: liveStops.length,
      mergedCount: merged.size,
      message: liveUrl
        ? `נתוני בסיס + עדכון חי (${liveStops.length})`
        : 'נתוני בסיס בלבד — אין מקור live overrides',
      ...(liveMeta || {})
    },
    stops: Array.from(merged.values())
  };

  return new Response(JSON.stringify(result), { status: 200, headers });
}
