import type { RiverDataResponse, RiverStation } from "@/lib/types";

const RHMZ_NRT_URL = "https://hidmet.gov.rs/ciril/osmotreni/nrt_index.php";
const RHMZ_STATION_URL = "https://hidmet.gov.rs/ciril/osmotreni/nrt_tabela_grafik.php";
const CACHE_TTL_SECONDS = 1800;

type CacheEntry = { saved_at: number; payload: RiverDataResponse };
const apiCache = new Map<string, CacheEntry>();

const cyrToLatMap: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "dj", е: "e", ж: "z", з: "z", и: "i", ј: "j",
  к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t",
  ћ: "c", у: "u", ф: "f", х: "h", ц: "c", ч: "c", џ: "dz", ш: "s",
  А: "A", Б: "B", В: "V", Г: "G", Д: "D", Ђ: "Dj", Е: "E", Ж: "Z", З: "Z", И: "I", Ј: "J",
  К: "K", Л: "L", Љ: "Lj", М: "M", Н: "N", Њ: "Nj", О: "O", П: "P", Р: "R", С: "S", Т: "T",
  Ћ: "C", У: "U", Ф: "F", Х: "H", Ц: "C", Ч: "C", Џ: "Dz", Ш: "S",
};

function normalizeLookup(value: string): string {
  const translated = value
    .split("")
    .map((char) => cyrToLatMap[char] ?? char)
    .join("");

  return translated
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function extractInt(value: string): number | null {
  const match = value.match(/-?\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

function extractDatetime(value: string): string {
  const match = value.match(/\d{2}\.\d{2}\.\d{2}\s+\d{2}:\d{2}/);
  return match ? match[0] : value.trim();
}

function waterTendency(currentValue: number | null, previousValue: number | null) {
  if (currentValue === null || previousValue === null) return "unknown";
  if (currentValue > previousValue) return "rising";
  if (currentValue < previousValue) return "falling";
  return "steady";
}

function mapRiverToRhmz(value: string): string {
  const key = normalizeLookup(value);
  const mapping: Record<string, string> = {
    dunav: "ДУНАВ",
    danube: "ДУНАВ",
    sava: "САВА",
    tisa: "ТИСА",
    drina: "ДРИНА",
    morava: "ВЕЛИКА МОРАВА",
    "velika morava": "ВЕЛИКА МОРАВА",
    "great morava": "ВЕЛИКА МОРАВА",
    "dunav reka": "ДУНАВ",
    "sava reka": "САВА",
    "tisa reka": "ТИСА",
    "drina reka": "ДРИНА",
  };

  return mapping[key] ?? value.toUpperCase();
}

function riverKeywords(value: string): string[] {
  const key = normalizeLookup(value);
  const keywordMap: Record<string, string[]> = {
    dunav: ["dunav", "danube"],
    danube: ["dunav", "danube"],
    sava: ["sava"],
    tisa: ["tisa", "tissa"],
    drina: ["drina"],
    morava: ["morava", "velika morava", "juzna morava", "zapadna morava"],
    "velika morava": ["morava", "velika morava", "juzna morava", "zapadna morava"],
    "great morava": ["morava", "velika morava", "juzna morava", "zapadna morava"],
  };
  return keywordMap[key] ?? [key];
}

function parseRhmzRows(htmlText: string) {
  const rowPattern =
    /nrt_tabela_grafik\.php\?hm_id=(?<hm_id>\d+)(?:&amp;|&)?period=7">(?<station>.*?)<\/a><\/td>\s*<td[^>]*>(?<river>.*?)<\/td>\s*<td[^>]*>(?<datetime>.*?)<\/td>\s*<td[^>]*>\s*(?<level>.*?)<\/td>/gs;

  const rows: Array<{
    hm_id: string;
    station: string;
    river: string;
    measured_at: string;
    level_cm: number | null;
  }> = [];

  for (const match of htmlText.matchAll(rowPattern)) {
    const groups = match.groups;
    if (!groups?.hm_id || !groups.station || !groups.river || !groups.datetime || !groups.level) continue;

    const stationName = decodeHtmlEntities(groups.station.replace(/<.*?>/g, "").trim());
    const riverName = decodeHtmlEntities(groups.river.replace(/<.*?>/g, "").trim());
    const measuredAt = extractDatetime(decodeHtmlEntities(groups.datetime.replace(/<.*?>/g, "").trim()));
    const levelCm = extractInt(decodeHtmlEntities(groups.level.replace(/<.*?>/g, "").trim()));

    rows.push({
      hm_id: groups.hm_id,
      station: stationName,
      river: riverName,
      measured_at: measuredAt,
      level_cm: levelCm,
    });
  }

  return rows;
}

function parseStationRecentLevels(htmlText: string): number[] {
  const pattern =
    /<tr>\s*<td class="(?:bela75|siva75) levo">&nbsp;[^<]*<\/td>\s*<td class="(?:bela75|siva75) ">&nbsp;\s*(?<level>-?\d+)\s*<\/td>\s*<\/tr>/gs;
  const levels: number[] = [];

  for (const match of htmlText.matchAll(pattern)) {
    const levelStr = match.groups?.level;
    if (!levelStr) continue;
    levels.push(Number.parseInt(levelStr, 10));
    if (levels.length >= 2) break;
  }

  return levels;
}

function cacheKeyForRiver(river: string, timezone: string): string {
  return `${normalizeLookup(river)}::${timezone}`;
}

function getCachedPayload(cacheKey: string): RiverDataResponse | null {
  const cached = apiCache.get(cacheKey);
  if (!cached) return null;
  const age = Math.floor(Date.now() / 1000 - cached.saved_at);
  if (age > CACHE_TTL_SECONDS) return null;
  return {
    ...cached.payload,
    cache: {
      used: true,
      stale_fallback: false,
      age_seconds: age,
      ttl_seconds: CACHE_TTL_SECONDS,
    },
  };
}

function getAnyCachedPayload(cacheKey: string): RiverDataResponse | null {
  const cached = apiCache.get(cacheKey);
  if (!cached) return null;
  const age = Math.floor(Date.now() / 1000 - cached.saved_at);
  return {
    ...cached.payload,
    cache: {
      used: true,
      stale_fallback: true,
      age_seconds: age,
      ttl_seconds: CACHE_TTL_SECONDS,
    },
  };
}

function saveCachePayload(cacheKey: string, payload: RiverDataResponse): void {
  apiCache.set(cacheKey, {
    saved_at: Math.floor(Date.now() / 1000),
    payload: {
      ...payload,
      cache: {
        used: false,
        stale_fallback: false,
        age_seconds: 0,
        ttl_seconds: CACHE_TTL_SECONDS,
      },
    },
  });
}

export async function getRiverData(river: string, timezone: string): Promise<RiverDataResponse> {
  const cacheKey = cacheKeyForRiver(river, timezone);
  const freshCache = getCachedPayload(cacheKey);
  if (freshCache) return freshCache;

  const targetRiver = mapRiverToRhmz(river);
  const keywords = riverKeywords(river);

  try {
    const indexRes = await fetch(RHMZ_NRT_URL, { next: { revalidate: 600 } });
    if (!indexRes.ok) throw new Error("RHMZ source is unavailable.");

    const allRows = parseRhmzRows(await indexRes.text());
    const matchedRows = allRows.filter((row) => {
      const normalizedRiver = normalizeLookup(row.river);
      const normalizedStation = normalizeLookup(row.station);
      return (
        keywords.some((keyword) => normalizedRiver.includes(keyword) || normalizedStation.includes(keyword)) ||
        normalizedRiver === normalizeLookup(targetRiver)
      );
    });
    const riverRows = Array.from(new Map(matchedRows.map((row) => [row.hm_id, row])).values());

    if (!riverRows.length) throw new Error(`No station data found for river '${river}'.`);

    const detailPages = await Promise.all(
      riverRows.map((row) =>
        fetch(`${RHMZ_STATION_URL}?hm_id=${encodeURIComponent(row.hm_id)}&period=7`, { next: { revalidate: 600 } }),
      ),
    );

    const stations: RiverStation[] = [];
    const validLevels: number[] = [];
    let risingCount = 0;
    let fallingCount = 0;
    let steadyCount = 0;

    for (let i = 0; i < riverRows.length; i += 1) {
      const row = riverRows[i];
      const response = detailPages[i];
      let currentLevel = row.level_cm;
      let previousLevel: number | null = null;

      if (response.ok) {
        const recentLevels = parseStationRecentLevels(await response.text());
        if (recentLevels.length) currentLevel = recentLevels[0] ?? null;
        if (recentLevels.length > 1) previousLevel = recentLevels[1] ?? null;
      }

      const tendency = waterTendency(currentLevel, previousLevel);
      if (tendency === "rising") risingCount += 1;
      if (tendency === "falling") fallingCount += 1;
      if (tendency === "steady") steadyCount += 1;
      if (currentLevel !== null) validLevels.push(currentLevel);

      stations.push({
        station: row.station
          .split(" ")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join(" "),
        measured_at: row.measured_at,
        water_level_cm: currentLevel,
        previous_level_cm: previousLevel,
        trend: tendency,
        change_cm: currentLevel !== null && previousLevel !== null ? currentLevel - previousLevel : null,
      });
    }

    const withLevel = stations.filter((station) => station.water_level_cm !== null);
    const highestStation =
      withLevel.length > 0
        ? withLevel.reduce((acc, station) =>
            (station.water_level_cm ?? -Infinity) > (acc.water_level_cm ?? -Infinity) ? station : acc,
          )
        : null;
    const lowestStation =
      withLevel.length > 0
        ? withLevel.reduce((acc, station) =>
            (station.water_level_cm ?? Infinity) < (acc.water_level_cm ?? Infinity) ? station : acc,
          )
        : null;

    const payload: RiverDataResponse = {
      generated_at: new Date().toISOString(),
      app_mode: "water_level_cm",
      river: { name: river, matched_name: targetRiver, country: "Serbia" },
      summary: {
        stations_count: stations.length,
        average_water_level_cm: validLevels.length ? validLevels.reduce((a, b) => a + b, 0) / validLevels.length : null,
        highest_station: highestStation
          ? { name: highestStation.station, water_level_cm: highestStation.water_level_cm }
          : null,
        lowest_station: lowestStation ? { name: lowestStation.station, water_level_cm: lowestStation.water_level_cm } : null,
        rising_count: risingCount,
        falling_count: fallingCount,
        steady_count: steadyCount,
      },
      stations,
      sources: ["RHMZ Serbia real-time hydrology stations"],
      note: "Water level values are in centimeters (cm). Trend is calculated from latest minus previous station reading.",
      cache: {
        used: false,
        stale_fallback: false,
        age_seconds: 0,
        ttl_seconds: CACHE_TTL_SECONDS,
      },
    };

    saveCachePayload(cacheKey, payload);
    return payload;
  } catch (error) {
    const fallback = getAnyCachedPayload(cacheKey);
    if (fallback) return fallback;
    throw error;
  }
}
