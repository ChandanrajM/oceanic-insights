/**
 * ORCA data fusion layer.
 *
 * Fetches from open marine data services and normalises everything into a
 * single schema with per-block provenance. Any source that fails or is not
 * configured degrades gracefully to a deterministic simulation, clearly
 * labelled as such.
 */

export type DataMode = "live" | "simulated" | "unavailable";

export type Provenance = {
  source: string;
  mode: DataMode;
  retrieved_at: string;
  note?: string;
};

export type MarineConditions = {
  location: { name: string | null; latitude: number; longitude: number };
  ocean: {
    sea_surface_temperature_c: number | null;
    chlorophyll_mg_m3: number | null;
    current_u_ms: number | null;
    current_v_ms: number | null;
    wave_height_m: number | null;
    provenance: Provenance;
  };
  weather: {
    wind_speed_ms: number | null;
    air_temperature_c: number | null;
    provenance: Provenance;
  };
  fishing_activity: {
    fishing_hours: number | null;
    vessel_count: number | null;
    activity_level: "low" | "moderate" | "high" | null;
    provenance: Provenance;
  };
  biodiversity: {
    total_records: number | null;
    taxon_count: number | null;
    provenance: Provenance;
  };
  maritime_context: {
    eez: { name: string | null; mrgid: string | null; sovereign: string | null };
    mpas: Array<{ name: string; mrgid: string }>;
    restricted_zones: Array<{ name: string; type: string }>;
    provenance: Provenance;
  };
  sources: string[];
  timestamp: string;
  confidence: number;
};

const now = () => new Date().toISOString();

async function getJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json", "user-agent": "ORCA-Marine-Intelligence/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Deterministic pseudo-random in [0,1) seeded by coordinates + salt. */
function seeded(lat: number, lon: number, salt: number) {
  const x = Math.sin((lat + 90) * 12.9898 + (lon + 180) * 78.233 + salt * 3.1415) * 43758.5453;
  return x - Math.floor(x);
}

function round(value: number, digits = 2) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/* ------------------------------- ocean ---------------------------------- */

async function fetchOcean(lat: number, lon: number): Promise<MarineConditions["ocean"]> {
  const chlorophyll = round(0.05 + seeded(lat, lon, 7) * 3.2, 3);
  try {
    const data = (await getJson(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
        `&current=wave_height,sea_surface_temperature,ocean_current_velocity,ocean_current_direction`,
    )) as { current?: Record<string, number | null> };
    const c = data.current ?? {};
    const velocity = typeof c["ocean_current_velocity"] === "number" ? c["ocean_current_velocity"] : null;
    const direction = typeof c["ocean_current_direction"] === "number" ? c["ocean_current_direction"] : null;
    const rad = direction === null ? null : (direction * Math.PI) / 180;
    const speed = velocity === null ? null : velocity / 100; // cm/s -> m/s
    const sst = typeof c["sea_surface_temperature"] === "number" ? c["sea_surface_temperature"] : null;
    if (sst === null && speed === null) throw new Error("no ocean fields returned");
    return {
      sea_surface_temperature_c: sst,
      chlorophyll_mg_m3: chlorophyll,
      current_u_ms: speed !== null && rad !== null ? round(speed * Math.sin(rad), 3) : null,
      current_v_ms: speed !== null && rad !== null ? round(speed * Math.cos(rad), 3) : null,
      wave_height_m: typeof c["wave_height"] === "number" ? c["wave_height"] : null,
      provenance: {
        source: "Open-Meteo Marine (Copernicus Marine derived)",
        mode: "live",
        retrieved_at: now(),
        note: "Chlorophyll is modelled — a Copernicus Marine key is required for observed values.",
      },
    };
  } catch (error) {
    const base = 28 - Math.abs(lat) * 0.35;
    return {
      sea_surface_temperature_c: round(base + seeded(lat, lon, 1) * 3 - 1.5, 2),
      chlorophyll_mg_m3: chlorophyll,
      current_u_ms: round(seeded(lat, lon, 2) * 0.8 - 0.4, 3),
      current_v_ms: round(seeded(lat, lon, 3) * 0.8 - 0.4, 3),
      wave_height_m: round(0.3 + seeded(lat, lon, 4) * 3, 2),
      provenance: {
        source: "ORCA simulation",
        mode: "simulated",
        retrieved_at: now(),
        note: `Live ocean feed unavailable (${(error as Error).message}).`,
      },
    };
  }
}

/* ------------------------------ weather --------------------------------- */

async function fetchWeather(lat: number, lon: number): Promise<MarineConditions["weather"]> {
  try {
    const data = (await getJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,wind_speed_10m&wind_speed_unit=ms`,
    )) as { current?: Record<string, number | null> };
    const c = data.current ?? {};
    return {
      wind_speed_ms: typeof c["wind_speed_10m"] === "number" ? c["wind_speed_10m"] : null,
      air_temperature_c: typeof c["temperature_2m"] === "number" ? c["temperature_2m"] : null,
      provenance: { source: "Open-Meteo Forecast", mode: "live", retrieved_at: now() },
    };
  } catch (error) {
    return {
      wind_speed_ms: round(1 + seeded(lat, lon, 5) * 12, 1),
      air_temperature_c: round(26 - Math.abs(lat) * 0.3, 1),
      provenance: {
        source: "ORCA simulation",
        mode: "simulated",
        retrieved_at: now(),
        note: `Weather feed unavailable (${(error as Error).message}).`,
      },
    };
  }
}

/* --------------------------- biodiversity -------------------------------- */

async function fetchBiodiversity(lat: number, lon: number): Promise<MarineConditions["biodiversity"]> {
  const d = 0.5;
  const poly =
    `POLYGON((${lon - d} ${lat - d},${lon + d} ${lat - d},${lon + d} ${lat + d},` +
    `${lon - d} ${lat + d},${lon - d} ${lat - d}))`;
  try {
    const data = (await getJson(
      `https://api.obis.org/v3/statistics?geometry=${encodeURIComponent(poly)}`,
      10000,
    )) as { records?: number; species?: number };
    if (typeof data.records !== "number") throw new Error("unexpected OBIS payload");
    return {
      total_records: data.records,
      taxon_count: typeof data.species === "number" ? data.species : null,
      provenance: {
        source: "OBIS (Ocean Biodiversity Information System)",
        mode: "live",
        retrieved_at: now(),
        note: "Occurrence records within ~55 km of the selected point.",
      },
    };
  } catch (error) {
    return {
      total_records: Math.round(200 + seeded(lat, lon, 8) * 40000),
      taxon_count: Math.round(20 + seeded(lat, lon, 9) * 600),
      provenance: {
        source: "ORCA simulation",
        mode: "simulated",
        retrieved_at: now(),
        note: `OBIS unavailable (${(error as Error).message}).`,
      },
    };
  }
}

/* ------------------------- maritime context ------------------------------ */

async function fetchMaritimeContext(
  lat: number,
  lon: number,
): Promise<MarineConditions["maritime_context"]> {
  try {
    const data = (await getJson(
      `https://marineregions.org/rest/getGazetteerRecordsByLatLong.json/${lat}/${lon}/?offset=0`,
      10000,
    )) as Array<{ preferredGazetteerName?: string; MRGID?: number; placeType?: string }>;
    const records = Array.isArray(data) ? data : [];
    const eez = records.find((r) => (r.placeType ?? "").toLowerCase().includes("eez"));
    const mpas = records
      .filter((r) => /marine protected|nature reserve|sanctuar/i.test(r.placeType ?? ""))
      .slice(0, 5)
      .map((r) => ({ name: r.preferredGazetteerName ?? "Unnamed area", mrgid: String(r.MRGID ?? "") }));
    return {
      eez: {
        name: eez?.preferredGazetteerName ?? null,
        mrgid: eez?.MRGID ? String(eez.MRGID) : null,
        sovereign: null,
      },
      mpas,
      restricted_zones: [],
      provenance: { source: "Marine Regions Gazetteer", mode: "live", retrieved_at: now() },
    };
  } catch (error) {
    return {
      eez: { name: null, mrgid: null, sovereign: null },
      mpas: [],
      restricted_zones: [],
      provenance: {
        source: "Marine Regions Gazetteer",
        mode: "unavailable",
        retrieved_at: now(),
        note: `Boundary lookup failed (${(error as Error).message}).`,
      },
    };
  }
}

/* ------------------------- fishing activity ------------------------------ */

function fishingActivity(lat: number, lon: number): MarineConditions["fishing_activity"] {
  const hours = round(seeded(lat, lon, 11) * 850, 1);
  const level = hours > 500 ? "high" : hours > 150 ? "moderate" : "low";
  return {
    fishing_hours: hours,
    vessel_count: Math.round(hours / 12),
    activity_level: level,
    provenance: {
      source: "ORCA simulation (Global Fishing Watch pending API token)",
      mode: "simulated",
      retrieved_at: now(),
      note: "Add a Global Fishing Watch token to replace this with observed AIS effort.",
    },
  };
}

/* ------------------------------ fusion ----------------------------------- */

export async function getMarineConditions(lat: number, lon: number): Promise<MarineConditions> {
  const [ocean, weather, biodiversity, maritime_context] = await Promise.all([
    fetchOcean(lat, lon),
    fetchWeather(lat, lon),
    fetchBiodiversity(lat, lon),
    fetchMaritimeContext(lat, lon),
  ]);
  const fishing_activity = fishingActivity(lat, lon);

  const blocks = [ocean, weather, biodiversity, maritime_context, fishing_activity];
  const live = blocks.filter((b) => b.provenance.mode === "live").length;

  return {
    location: { name: maritime_context.eez.name, latitude: lat, longitude: lon },
    ocean,
    weather,
    fishing_activity,
    biodiversity,
    maritime_context,
    sources: Array.from(new Set(blocks.map((b) => b.provenance.source))),
    timestamp: now(),
    confidence: round(live / blocks.length, 2),
  };
}

export type SourceStatus = {
  id: string;
  label: string;
  category: string;
  status: "available" | "degraded" | "unavailable";
  detail: string;
  latency_ms: number | null;
};

async function probe(
  id: string,
  label: string,
  category: string,
  url: string,
  fallbackDetail: string,
): Promise<SourceStatus> {
  const started = Date.now();
  try {
    await getJson(url, 8000);
    return {
      id,
      label,
      category,
      status: "available",
      detail: "Responding normally",
      latency_ms: Date.now() - started,
    };
  } catch (error) {
    return {
      id,
      label,
      category,
      status: "unavailable",
      detail: `${fallbackDetail} (${(error as Error).message})`,
      latency_ms: Date.now() - started,
    };
  }
}

export async function getSourceStatuses(): Promise<SourceStatus[]> {
  const live = await Promise.all([
    probe(
      "ocean",
      "Open-Meteo Marine",
      "Ocean physics",
      "https://marine-api.open-meteo.com/v1/marine?latitude=15&longitude=72&current=wave_height",
      "Falling back to simulation",
    ),
    probe(
      "weather",
      "Open-Meteo Forecast",
      "Atmosphere",
      "https://api.open-meteo.com/v1/forecast?latitude=15&longitude=72&current=temperature_2m",
      "Falling back to simulation",
    ),
    probe(
      "obis",
      "OBIS",
      "Biodiversity",
      "https://api.obis.org/v3/statistics?geometry=POLYGON((72%2015,73%2015,73%2016,72%2016,72%2015))",
      "Falling back to simulation",
    ),
    probe(
      "marineregions",
      "Marine Regions",
      "Maritime boundaries",
      "https://marineregions.org/rest/getGazetteerRecordsByLatLong.json/15/72/?offset=0",
      "Boundary context unavailable",
    ),
  ]);

  return [
    ...live,
    {
      id: "copernicus",
      label: "Copernicus Marine",
      category: "Ocean biogeochemistry",
      status: "degraded",
      detail: "No credentials configured — chlorophyll served from the ORCA model",
      latency_ms: null,
    },
    {
      id: "gfw",
      label: "Global Fishing Watch",
      category: "Fishing effort",
      status: "degraded",
      detail: "No API token configured — effort served from the ORCA model",
      latency_ms: null,
    },
  ];
}
