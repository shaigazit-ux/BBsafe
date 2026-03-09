const OREF_ALERTS_URL = 'https://www.oref.org.il/WarningMessages/alert/alerts.json';
const OREF_HEADERS = {
  Referer: 'https://www.oref.org.il/',
  'User-Agent': 'Mozilla/5.0 shelter-driver-pages/1.0',
  'X-Requested-With': 'XMLHttpRequest'
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'access-control-allow-origin': '*'
    }
  });
}

function parseBool(value, defaultValue = false) {
  if (value == null || value === '') return defaultValue;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/["'`׳״]+/g, '')
    .replace(/[()\[\]{}]+/g, '')
    .replace(/[־–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean).map(v => String(v).trim())));
}

function sanitizeUpstreamText(text) {
  return String(text || '').replace(/^\uFEFF/, '').replace(/\u0000/g, '').trim();
}

function isTestAlert(alert) {
  const places = extractAlertPlaces(alert).join(' ');
  return /בדיקה|בדיקה מחזורית/.test(places);
}

function extractAlertPlaces(alert) {
  if (!alert || typeof alert !== 'object') return [];
  if (Array.isArray(alert.data)) return alert.data.filter(Boolean).map(String);
  if (typeof alert.data === 'string') return [alert.data];
  if (Array.isArray(alert.areas)) return alert.areas.filter(Boolean).map(String);
  if (typeof alert.area === 'string') return [alert.area];
  return [];
}

function matchPlaces(alertPlaces, watchPlaces) {
  if (!watchPlaces.length) return true;
  const normalizedAlertPlaces = alertPlaces.map(normalizeText).filter(Boolean);
  const normalizedWatchPlaces = watchPlaces.map(normalizeText).filter(Boolean);
  return normalizedAlertPlaces.some(alertPlace =>
    normalizedWatchPlaces.some(watchPlace =>
      alertPlace === watchPlace ||
      alertPlace.includes(watchPlace) ||
      watchPlace.includes(alertPlace)
    )
  );
}

function toAlertsList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload === 'object') {
    if (Array.isArray(payload.alerts)) return payload.alerts;
    if (Array.isArray(payload.data) || payload.id || payload.title) return [payload];
  }
  return [];
}

function toNumber(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function haversineMeters(aLat, aLng, bLat, bLng) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function loadStops(context) {
  const stopsUrl = new URL('/data/stops.json', context.request.url).toString();
  const res = await fetch(stopsUrl, { cf: { cacheTtl: 60, cacheEverything: false } });
  if (!res.ok) return [];
  const payload = await res.json();
  return Array.isArray(payload) ? payload : [];
}

function resolveWatchPlaces({ stops, lat, lng, explicitRegion }) {
  let nearestStop = null;
  const allRoutePlaces = uniqueStrings(
    stops.flatMap(stop => [
      ...asArray(stop.alertPlaces),
      ...asArray(stop.alertRegion)
    ])
  );

  if (lat != null && lng != null && stops.length > 0) {
    let bestDist = Infinity;
    for (const stop of stops) {
      if (!Number.isFinite(stop?.lat) || !Number.isFinite(stop?.lng)) continue;
      const dist = haversineMeters(lat, lng, stop.lat, stop.lng);
      if (dist < bestDist) {
        bestDist = dist;
        nearestStop = stop;
      }
    }
  }

  const nearestPlaces = nearestStop
    ? uniqueStrings([...asArray(nearestStop.alertPlaces), ...asArray(nearestStop.alertRegion)])
    : [];

  const watchPlaces = uniqueStrings([
    ...(explicitRegion && explicitRegion !== '*' ? [explicitRegion] : []),
    ...nearestPlaces,
    ...(nearestPlaces.length ? [] : allRoutePlaces)
  ]);

  return {
    nearestStop,
    watchPlaces
  };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const debugMode = url.searchParams.get('demo') === '1';
  const includeTestAlerts = parseBool(context.env.INCLUDE_TEST_ALERTS, false);
  const sourceUrl = (context.env.ALERTS_SOURCE_URL || OREF_ALERTS_URL).trim();
  const explicitRegion = (url.searchParams.get('region') || context.env.ALERTS_REGION || '').trim();
  const lat = toNumber(url.searchParams.get('lat'));
  const lng = toNumber(url.searchParams.get('lng'));
  const sourceType = /oref\.org\.il/i.test(sourceUrl) ? 'oref-live' : 'configured-upstream';

  if (debugMode) {
    return json({ active: true, title: 'התראת דמו', source: 'demo' });
  }

  try {
    const upstream = await fetch(sourceUrl, {
      headers: sourceType === 'oref-live' ? OREF_HEADERS : { 'user-agent': 'shelter-driver-pages/1.0' },
      cf: { cacheTtl: 1, cacheEverything: false }
    });

    if (!upstream.ok) {
      return json({
        active: false,
        title: 'שגיאת מקור התראות',
        source: sourceType,
        status: upstream.status
      }, 502);
    }

    const rawText = sanitizeUpstreamText(await upstream.text());
    if (!rawText) {
      return json({ active: false, title: 'אין התראה', source: sourceType, upstreamCount: 0 });
    }

    let payload;
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }

    // Pass-through custom upstreams that already expose active/title.
    if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'active' in payload) {
      return json({
        active: Boolean(payload.active),
        title: payload.title || (payload.active ? 'התראה פעילה' : 'אין התראה'),
        source: sourceType,
        raw: payload.raw || undefined
      });
    }

    // Text upstream fallback.
    if (typeof payload === 'string') {
      const active = /alert|red|rocket|missile|אזהרה|אזעקה|ירי/i.test(payload);
      return json({
        active,
        title: active ? 'התראה פעילה' : 'אין התראה',
        source: `${sourceType}-text`
      });
    }

    const allAlerts = toAlertsList(payload);
    const filteredAlerts = allAlerts.filter(alert => includeTestAlerts || !isTestAlert(alert));
    const alertsWithPlaces = filteredAlerts.filter(alert => extractAlertPlaces(alert).length > 0);

    const stops = await loadStops(context);
    const { watchPlaces, nearestStop } = resolveWatchPlaces({ stops, lat, lng, explicitRegion });

    const matchingAlerts = alertsWithPlaces.filter(alert =>
      matchPlaces(extractAlertPlaces(alert), watchPlaces)
    );
    const active = matchingAlerts.length > 0;

    const firstMatch = matchingAlerts[0];
    const firstMatchPlaces = firstMatch ? extractAlertPlaces(firstMatch) : [];
    const matchedPlaces = firstMatchPlaces.filter(place => matchPlaces([place], watchPlaces));

    return json({
      active,
      title: active
        ? (firstMatch?.title || 'התראה פעילה באזור הנהג')
        : (alertsWithPlaces.length > 0 && watchPlaces.length > 0
          ? 'התראה פעילה מחוץ לאזור המסלול'
          : 'אין התראה'),
      source: sourceType,
      upstreamCount: alertsWithPlaces.length,
      matchedCount: matchingAlerts.length,
      matchedPlaces: matchedPlaces.slice(0, 8),
      watchPlaces: watchPlaces.slice(0, 12),
      nearestStop: nearestStop ? { id: nearestStop.id, name: nearestStop.name } : null
    });
  } catch (error) {
    return json({
      active: false,
      title: 'שגיאת שרת התראות',
      source: sourceType,
      error: String(error)
    }, 502);
  }
}
