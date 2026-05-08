import { NextRequest, NextResponse } from "next/server";
import { getRiverData } from "@/lib/river-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const river = request.nextUrl.searchParams.get("river")?.trim();
  const timezone = request.nextUrl.searchParams.get("timezone")?.trim() ?? "auto";

  if (!river || river.length < 2 || river.length > 120) {
    return NextResponse.json({ detail: "Parametar 'river' je obavezan (2-120 karaktera)." }, { status: 400 });
  }

  try {
    const data = await getRiverData(river, timezone);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const rawDetail = error instanceof Error ? error.message : "Neočekivana API greška.";
    const isNotFound = /No station data/i.test(rawDetail);
    const detail = isNotFound ? "Nema podataka o stanicama za izabranu reku." : "Greška pri preuzimanju podataka o reci.";
    const status = isNotFound ? 404 : 502;
    return NextResponse.json({ detail }, { status });
  }
}
