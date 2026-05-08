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
  return directions[index] ?? "N/A";
}

export default function HomePage() {
  const [river, setRiver] = useState("Danube");
  const [city, setCity] = useState("Beograd");
  const [cityWeather, setCityWeather] = useState<CityWeatherResponse | null>(null);
  const [status, setStatus] = useState("Unesi reku i grad, pa pokreni pretragu.");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RiverDataResponse | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
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
    <main className="page">
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
                  placeholder="npr. Danube/Dunav, Sava, Tisa, Drina, Morava"
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
                  placeholder="npr. Beograd, Novi Sad, Niš"
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
              <h2>Prosečan vodostaj</h2>
              <p className="big">{formatNum(data.summary.average_water_level_cm, " cm")}</p>
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
        <p>Izvor: RHMZ Srbija (stanice u realnom vremenu). Vodostaj je prikazan u centimetrima (cm).</p>
      </section>
    </main>
  );
}
