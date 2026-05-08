# FishingMate (Next.js)

FishingMate is a Next.js full-stack app for:
- river water level in **cm** by station (Serbia),
- station trend (rising/falling/steady),
- weather context for fishing.

## Stack

- **Frontend:** Next.js App Router + React + TypeScript
- **Backend:** Next.js Route Handlers (`/api/river-data`)
- **Sources:** RHMZ hydrology pages + Open-Meteo weather API
- **PWA:** manifest + service worker

## Project Structure

- `app/page.tsx` - UI page
- `app/api/river-data/route.ts` - backend API endpoint
- `lib/river-service.ts` - data-fetch and parsing logic
- `public/manifest.webmanifest` - PWA manifest
- `public/sw.js` - service worker
