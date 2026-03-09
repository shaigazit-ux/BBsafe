# Shelter Driver V5 – public web build

Mobile-first web app for the route:

**La Guardia Junction ↔ Neve Ilan Studios**

This build is meant to be hosted publicly and shared as a single link with a driver at the start of the ride.

## What V5 adds
- Works for **both directions** on the same route logic.
- Keeps the **5-minute ETA window** rule.
- If the nearest target is **over 5 minutes**, the UI warns that the target is outside the likely window and recommends stopping at the nearest safe shelter.
- Includes a **manual alert** button that triggers the exact same flow as an automatic alert.
- Adds **shareable URL support**:
  - `?alert=1` starts with manual alert on.
  - `?demo=1` asks the demo alerts endpoint to simulate an active alert.
- Ready for **Cloudflare Pages** with `/api/alerts`.

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

## Optional env var
If you have a trusted alert source:

`ALERTS_SOURCE_URL=https://your-approved-alerts-source.example/api`

## Useful test URLs
- normal: `/`
- start with manual alert active: `/?alert=1`
- demo upstream alert mode: `/?demo=1`
