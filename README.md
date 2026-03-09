# Shelter Driver V6 – public web build

Mobile-first web app for the route:

**La Guardia Junction ↔ Neve Ilan Studios**

This build is meant to be hosted publicly and shared as a single link with a driver at the start of the ride.

## What V6 adds
- Works for **both directions** on the same route logic.
- Keeps the **7-minute ETA window** rule.
- If the nearest target is **over 7 minutes**, the UI warns that the target is outside the likely window and recommends stopping at the nearest safe shelter.
- Includes a **manual alert** button that triggers the exact same flow as an automatic alert.
- Adds **shareable URL support**:
  - `?alert=1` starts with manual alert on.
  - `?demo=1` asks the demo alerts endpoint to simulate an active alert.
- Ready for **Cloudflare Pages** with `/api/alerts`.
- Uses **live Oref alerts** by default and filters by the driver location on the route (`lat/lng` + nearest stop mapping).

## Hosting recommendation
### Best free option: Cloudflare Pages
Why:
- automatic HTTPS
- static site is easy to host
- built-in Pages Functions for `/api/alerts`
- easy GitHub integration

Cloudflare Pages Free includes **500 deploys per month** and Pages Functions usage counts against the Workers Free plan; the Workers Free plan includes **100,000 daily requests**. Cloudflare Pages Free sites can contain up to **20,000 files**. See the official docs for current limits.

## Files
- `index.html` – main app
- `planner.html` – trip planning page (add route stations, verify 7-minute shelter coverage, export route)
- `data/stops.json` – route-specific verified / fallback targets
- `functions/api/alerts.js` – Pages Function for alerts
- `_routes.json` – keeps Functions scoped to `/api/*`
- `manifest.webmanifest` – installable web app metadata
- `.gitignore` – excludes junk files
- `DEPLOY-GITHUB-CLOUDFLARE.md` – step-by-step deployment guide

## Safety note
This build mixes:
- **verified targets** from official municipal sources
- **fallback targets** that still need local validation

Do not treat fallback targets as officially approved shelters.

## Quick local preview
```bash
python3 -m http.server 8080
```
Then open `http://localhost:8080`

## Optional env vars
- `ALERTS_SOURCE_URL=https://your-approved-alerts-source.example/api`
  - Optional override. If empty, `/api/alerts` uses Oref (`alerts.json`) directly.
- `INCLUDE_TEST_ALERTS=true`
  - Optional. By default, Oref test alerts are ignored.
- `ALERTS_REGION=מודיעין`
  - Optional hard override region string (if you want fixed-region monitoring regardless of GPS).

## Useful test URLs
- normal: `/`
- start with manual alert active: `/?alert=1`
- demo upstream alert mode: `/?demo=1`
- trip planning page: `/planner.html`

## Trip planning flow
- Open `/planner.html` from the main app link (`תכנון נסיעה`) or directly.
- Add route stations by typing an address (autocomplete) or by clicking the map.
- You can also add the current GPS location as a station.
- Click **בדוק כיסוי 7 דקות** to verify shelter coverage along the full route.
- Export is enabled only after approval:
  - Google Maps export includes origin, destination, and waypoints.
  - Waze export opens navigation to the final station (Waze web link limitation).

## Data updates (March 2026)
- Expanded shelter coverage dataset with additional points from Kfar Saba/Hasharon through Tel Aviv and toward Jerusalem.
- Added source URLs for city pages where provided (Tel Aviv, Jerusalem, Ramla, ModiinOnline context, Givat Ze'ev list).
- `data/live-overrides.example.json` is synchronized with `data/stops.json` for LIVE_STOPS_URL usage.

## Alerts API behavior
- Frontend sends current GPS (`lat/lng`) to `/api/alerts`.
- The function finds the nearest stop in `data/stops.json`, reads its `alertPlaces`, and matches these against Oref alert places.
- If there is an active alert but not for the current route area, it returns inactive for driving decisions.


## Live override flow

The app now reads `/api/stops` instead of the static JSON directly.
If `LIVE_STOPS_URL` is set in Cloudflare Pages, the function fetches that JSON, merges it by `id`, and any matching fallback can be replaced by verified data without changing the browser code.
Use `data/live-overrides.example.json` as the schema template.

Practical setup:
1. Host a small public JSON file in a separate GitHub repo, GitHub Gist, or another static URL.
2. Put full stop objects keyed by the same `id` as the fallback you want to replace.
3. In Cloudflare Pages > Settings > Environment variables, add `LIVE_STOPS_URL`.
4. The site will start merging those updates on the next request.
