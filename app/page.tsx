"use client";

import { FormEvent, useEffect, useState } from "react";
import type { CityWeatherResponse, RiverDataResponse } from "@/lib/types";

function formatNum(value: number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return `${value.toFixed(1)}${suffix}`;
}

function trendLabel(trend: string): string {
  if (trend === "rising") return "Raste";
  if (trend === "falling") return "Opada";
  if (trend === "steady") return "Stabilan";
  return "Nepoznato";
}

function windDirectionLabel(degrees: number | null | undefined): string {
  if (degrees === null || degrees === undefined || Number.isNaN(degrees)) return "N/A";
  const directions = [
    "severno",
    "severo-istočno",
    "istočno",
    "jugo-istočno",
    "južno",
    "jugo-zapadno",
    "zapadno",
    "severo-zapadno",
  ];
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  const direction = directions[index] ?? "N/A";
  return direction.charAt(0).toUpperCase() + direction.slice(1);
}

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

export default function HomePage() {
  const [river, setRiver] = useState("");
  const [city, setCity] = useState("");
  const [cityWeather, setCityWeather] = useState<CityWeatherResponse | null>(null);
  const [status, setStatus] = useState("Unesi reku i grad, pa pokreni pretragu.");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RiverDataResponse | null>(null);
  const [isNight, setIsNight] = useState(false);

  const cityLevelMatch = data
    ? (() => {
        const normalizedCity = normalizeLookup(city);
        if (!normalizedCity) return null;
        return (
          data.stations.find((station) => {
            const normalizedStation = normalizeLookup(station.station);
            return (
              normalizedStation.includes(normalizedCity) ||
              normalizedCity.includes(normalizedStation)
            );
          }) ?? null
        );
      })()
    : null;

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    function refreshDayPhase() {
      const hour = new Date().getHours();
      setIsNight(hour < 6 || hour >= 20);
    }

    refreshDayPhase();
    const timer = window.setInterval(refreshDayPhase, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedRiver = river.trim();
    const trimmedCity = city.trim();
    if (!trimmedRiver || !trimmedCity) return;

    setLoading(true);
    setError(false);
    setData(null);
    setCityWeather(null);
    setStatus("Učitavanje podataka...");

    try {
      const riverParams = new URLSearchParams({ river: trimmedRiver });
      const cityParams = new URLSearchParams({ city: trimmedCity });

      const [riverResponse, cityResponse] = await Promise.all([
        fetch(`/api/river-data?${riverParams.toString()}`),
        fetch(`/api/city-weather?${cityParams.toString()}`),
      ]);

      const riverPayload = (await riverResponse.json()) as RiverDataResponse | { detail?: string };
      const cityPayload = (await cityResponse.json()) as CityWeatherResponse | { detail?: string };

      if (!riverResponse.ok) {
        throw new Error("detail" in riverPayload ? riverPayload.detail : "Greška pri učitavanju podataka o reci.");
      }
      if (!cityResponse.ok) {
        throw new Error("detail" in cityPayload ? cityPayload.detail : "Greška pri učitavanju vremena za grad.");
      }

      setData(riverPayload as RiverDataResponse);
      setCityWeather(cityPayload as CityWeatherResponse);
      const typedData = riverPayload as RiverDataResponse;
      const typedCity = cityPayload as CityWeatherResponse;
      let cacheLabel = "";
      if (typedData.cache?.used) {
        cacheLabel = typedData.cache.stale_fallback
          ? ` Korišćen je rezervni keš (${Math.floor(typedData.cache.age_seconds / 60)} min star).`
          : ` Učitano iz keša (${Math.floor(typedData.cache.age_seconds / 60)} min star).`;
      }
      setStatus(
        `Reka: ${typedData.river.name}. Učitano stanica: ${typedData.stations.length}. Grad: ${typedCity.city}.${cacheLabel}`,
      );
    } catch (err) {
      setError(true);
      setStatus(err instanceof Error ? err.message : "Nepoznata greška.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`page scene ${isNight ? "night" : "day"}`}>
      <div className="nature-bg" aria-hidden="true">
        <div className="sky-layer">
          <div className="sun" />
          <div className="moon" />
          <div className="stars">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="river-layer">
          <div className="river-wave river-wave-1" />
          <div className="river-wave river-wave-2" />
          <div className="boat boat-1">
            <span className="hull" />
            <span className="mast" />
          </div>
          <div className="boat boat-2">
            <span className="hull" />
            <span className="mast" />
          </div>
          <div className="boat boat-3">
            <span className="hull" />
            <span className="mast" />
          </div>
        </div>
      </div>
      <section className="hero">
        <p className="badge">Fishing Mate</p>
        <h1>Vodostaj i vreme na jednom mestu</h1>
        <p>
          Unesi reku i grad, pa jednim klikom dobijaš vodostaj po stanicama i trenutno vreme za izabrani grad.
        </p>
      </section>

      <section className="card command-center">
        <div className="command-head">
          <h2>Pretraga</h2>
          <p>Oba polja su obavezna za pokretanje skeniranja.</p>
        </div>

        <article className="control-tile">
          <form onSubmit={onSubmit}>
            <div className="control-grid">
              <div className="field">
                <label htmlFor="river">Reka</label>
                <input
                  id="river"
                  name="river"
                  value={river}
                  onChange={(event) => setRiver(event.target.value)}
                  placeholder="Unesi naziv reke (npr. Dunav, Sava, Tisa...)"
                  required
                  list="riverSuggestions"
                />
                <datalist id="riverSuggestions">
                  <option value="Danube" />
                  <option value="Dunav" />
                  <option value="Дунав" />
                  <option value="Sava" />
                  <option value="Сава" />
                  <option value="Tisa" />
                  <option value="Тиса" />
                  <option value="Drina" />
                  <option value="Дрина" />
                  <option value="Morava" />
                  <option value="Велика Морава" />
                </datalist>
              </div>
              <div className="field">
                <label htmlFor="city">Grad</label>
                <input
                  id="city"
                  name="city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Unesi grad (npr. Beograd, Novi Sad, Niš...)"
                  required
                />
              </div>
            </div>
            <button disabled={loading} type="submit">
              {loading ? "Učitavanje..." : "Pokreni skeniranje"}
            </button>
          </form>
          <p className="status" style={{ color: error ? "#fca5a5" : "#96a7c4" }}>
            {status}
          </p>
        </article>

        {cityWeather && (
          <>
            <p className="status">
              Lokacija: {cityWeather.city}
              {cityWeather.country ? `, ${cityWeather.country}` : ""}
            </p>
            <div className="grid">
              <article className="card metric">
                <h2>Trenutna temperatura</h2>
                <p className="big">{formatNum(cityWeather.current.temperature_2m, "°C")}</p>
              </article>
              <article className="card metric">
                <h2>Trenutni vetar</h2>
                <p className="big">{formatNum(cityWeather.current.wind_speed_10m, " km/h")}</p>
              </article>
              <article className="card metric">
                <h2>Smer vetra</h2>
                <p className="big">{windDirectionLabel(cityWeather.current.wind_direction_10m)}</p>
              </article>
            </div>
          </>
        )}
      </section>

      {data && (
        <>
          <section className="grid">
            <article className="card metric">
              <h2>Vodostaj za grad</h2>
              <p className="big">
                {cityLevelMatch ? formatNum(cityLevelMatch.water_level_cm, " cm") : "Nema stanice"}
              </p>
              {cityLevelMatch && (
                <p className="status">
                  Stanica: {cityLevelMatch.station}
                </p>
              )}
            </article>
            <article className="card metric">
              <h2>Najviša stanica</h2>
              <p className="big">
                {data.summary.highest_station
                  ? `${data.summary.highest_station.name} (${formatNum(data.summary.highest_station.water_level_cm, " cm")})`
                  : "Nema podataka"}
              </p>
            </article>
            <article className="card metric">
              <h2>Najniža stanica</h2>
              <p className="big">
                {data.summary.lowest_station
                  ? `${data.summary.lowest_station.name} (${formatNum(data.summary.lowest_station.water_level_cm, " cm")})`
                  : "Nema podataka"}
              </p>
            </article>
          </section>

          <section className="card">
            <h2>Stanice duž reke</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Stanica</th>
                    <th>Izmereno u</th>
                    <th>Vodostaj (cm)</th>
                    <th>Prethodno (cm)</th>
                    <th>Promena (cm)</th>
                    <th>Tendencija</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stations.map((station) => (
                    <tr key={`${station.station}-${station.measured_at}`}>
                      <td data-label="Stanica">{station.station}</td>
                      <td data-label="Izmereno u">{station.measured_at || "Nema podataka"}</td>
                      <td data-label="Vodostaj (cm)">{formatNum(station.water_level_cm, " cm")}</td>
                      <td data-label="Prethodno (cm)">{formatNum(station.previous_level_cm, " cm")}</td>
                      <td data-label="Promena (cm)">{formatNum(station.change_cm, " cm")}</td>
                      <td data-label="Tendencija">{trendLabel(station.trend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="legal">
        <p>Izvori podataka:</p>
        <p>- RHMZ Srbija (hidrološke stanice u realnom vremenu, vodostaj u cm)</p>
        <p>- Open-Meteo Geocoding API (pronalaženje lokacije za uneti grad)</p>
        <p>- Open-Meteo Forecast API (trenutna temperatura, brzina vetra i smer vetra)</p>
      </section>
    </main>
  );
}
