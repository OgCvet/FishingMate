export type RiverStation = {
  station: string;
  measured_at: string;
  water_level_cm: number | null;
  previous_level_cm: number | null;
  trend: "rising" | "falling" | "steady" | "unknown";
  change_cm: number | null;
};

export type RiverDataResponse = {
  generated_at: string;
  app_mode: "water_level_cm";
  river: {
    name: string;
    matched_name: string;
    country: string;
  };
  summary: {
    stations_count: number;
    average_water_level_cm: number | null;
    highest_station: {
      name: string;
      water_level_cm: number | null;
    } | null;
    lowest_station: {
      name: string;
      water_level_cm: number | null;
    } | null;
    rising_count: number;
    falling_count: number;
    steady_count: number;
  };
  stations: RiverStation[];
  weather: {
    location_label: string | null;
    latitude: number | null;
    longitude: number | null;
    current: Record<string, number | string | null>;
    forecast: Array<{
      date: string;
      temp_max_c: number | null;
      temp_min_c: number | null;
      wind_max_kmh: number | null;
    }>;
  } | null;
  sources: string[];
  note: string;
  cache: {
    used: boolean;
    stale_fallback: boolean;
    age_seconds: number;
    ttl_seconds: number;
  };
};

export type CityWeatherResponse = {
  city: string;
  country: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    temperature_2m: number | null;
    wind_speed_10m: number | null;
    wind_direction_10m: number | null;
  };
};
