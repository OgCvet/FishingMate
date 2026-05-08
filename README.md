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

## Local Run

1. Open terminal in:
   - `C:\Users\Ognjen\Documents\Projects\FishingMate`
2. Install dependencies:
   - `npm install`
3. Start development:
   - `npm run dev`
4. Open:
   - `http://localhost:3000`

## Deploy on Vercel (Free)

1. Push this folder to GitHub.
2. Import repo in Vercel.
3. Framework preset: **Next.js**.
4. Deploy.

No extra server config is needed.
