import { NextRequest, NextResponse } from "next/server";
import type { CityWeatherResponse } from "@/lib/types";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city")?.trim();
  if (!city || city.length < 2 || city.length > 80) {
    return NextResponse.json({ detail: "Parametar 'city' je obavezan (2-80 karaktera)." }, { status: 400 });
  }

  const geoUrl = new URL(GEOCODING_URL);
  geoUrl.searchParams.set("name", city);
  geoUrl.searchParams.set("count", "5");
  geoUrl.searchParams.set("language", "en");
  geoUrl.searchParams.set("format", "json");

  const geoRes = await fetch(geoUrl.toString(), { next: { revalidate: 600 } });
  if (!geoRes.ok) {
    return NextResponse.json({ detail: "Servis za pronalazak lokacije trenutno nije dostupan." }, { status: 502 });
  }

  const geoPayload = (await geoRes.json()) as {
    results?: Array<{
      name?: string;
      country?: string;
      latitude?: number;
      longitude?: number;
      timezone?: string;
    }>;
  };

  const first = geoPayload.results?.[0];
  if (
    !first ||
    first.latitude === undefined ||
    first.longitude === undefined ||
    !first.name ||
    !first.timezone
  ) {
    return NextResponse.json({ detail: "Grad nije pronađen." }, { status: 404 });
  }

  const weatherUrl = new URL(WEATHER_URL);
  weatherUrl.searchParams.set("latitude", String(first.latitude));
  weatherUrl.searchParams.set("longitude", String(first.longitude));
  weatherUrl.searchParams.set("timezone", first.timezone);
  weatherUrl.searchParams.set("current", "temperature_2m,wind_speed_10m,wind_direction_10m");

  const weatherRes = await fetch(weatherUrl.toString(), { next: { revalidate: 300 } });
  if (!weatherRes.ok) {
    return NextResponse.json({ detail: "Servis za vremensku prognozu trenutno nije dostupan." }, { status: 502 });
  }

  const weatherPayload = (await weatherRes.json()) as {
    current?: {
      temperature_2m?: number;
      wind_speed_10m?: number;
      wind_direction_10m?: number;
    };
  };

  const response: CityWeatherResponse = {
    city: first.name,
    country: first.country ?? null,
    latitude: first.latitude,
    longitude: first.longitude,
    timezone: first.timezone,
    current: {
      temperature_2m: weatherPayload.current?.temperature_2m ?? null,
      wind_speed_10m: weatherPayload.current?.wind_speed_10m ?? null,
      wind_direction_10m: weatherPayload.current?.wind_direction_10m ?? null,
    },
  };

  return NextResponse.json(response, { status: 200 });
}
