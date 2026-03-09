export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const sourceUrl = context.env.ALERTS_SOURCE_URL || '';
  const debugMode = url.searchParams.get('demo') === '1';

  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'access-control-allow-origin': '*'
    }
  });

  if (debugMode) {
    return json({ active: true, title: 'התראת דמו', source: 'demo' });
  }

  if (!sourceUrl) {
    return json({ active: false, title: 'מקור התראות לא הוגדר', source: 'none' });
  }

  try {
    const upstream = await fetch(sourceUrl, {
      headers: { 'user-agent': 'shelter-driver-pages/1.0' },
      cf: { cacheTtl: 0, cacheEverything: false }
    });

    const text = await upstream.text();
    let payload = null;
    try { payload = JSON.parse(text); } catch { payload = text; }

    // Pass-through if upstream already uses the expected shape.
    if (payload && typeof payload === 'object' && 'active' in payload) {
      return json({
        active: Boolean(payload.active),
        title: payload.title || (payload.active ? 'התראה פעילה' : 'אין התראה'),
        source: 'configured-upstream',
        raw: payload.raw || undefined
      });
    }

    // Heuristic normalizers for common upstream shapes.
    if (Array.isArray(payload)) {
      const active = payload.length > 0;
      return json({
        active,
        title: active ? 'התראה פעילה' : 'אין התראה',
        source: 'configured-upstream-array',
        rawCount: payload.length
      });
    }

    if (typeof payload === 'string') {
      const active = /alert|red|rocket|missile|אזהרה|אזעקה|ירי/i.test(payload);
      return json({
        active,
        title: active ? 'התראה פעילה' : 'אין התראה',
        source: 'configured-upstream-text'
      });
    }

    return json({ active: false, title: 'פורמט מקור התראות לא נתמך', source: 'unknown' });
  } catch (error) {
    return json({ active: false, title: 'שגיאת שרת התראות', source: 'error', error: String(error) }, 502);
  }
}
