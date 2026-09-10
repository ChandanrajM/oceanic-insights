import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Download, MapPin, RefreshCw, Waves } from "lucide-react";
import { SiteHeader } from "@/components/orca/site-header";
import { Metric } from "@/components/orca/metric";
import { ProvenanceBadge, SourceLine } from "@/components/orca/provenance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMarineConditions } from "@/lib/marine.functions";

const OceanMap = lazy(() => import("@/components/orca/ocean-map"));

const PRESETS = [
  { name: "Arabian Sea", lat: 15.5, lon: 68.5 },
  { name: "Bay of Bengal", lat: 15.0, lon: 87.0 },
  { name: "Lakshadweep Sea", lat: 10.2, lon: 73.0 },
  { name: "Gulf of Guinea", lat: 2.0, lon: 4.0 },
  { name: "North Sea", lat: 56.0, lon: 3.0 },
  { name: "Peru Upwelling", lat: -12.0, lon: -78.5 },
];

const TIME_RANGES = ["1h", "3h", "6h", "24h"] as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ORCA — Real-time Marine Conditions Dashboard" },
      {
        name: "description",
        content:
          "Fused real-time ocean, fishing, biodiversity and maritime boundary intelligence for any coordinate on Earth.",
      },
      { property: "og:title", content: "ORCA — Real-time Marine Conditions Dashboard" },
      {
        property: "og:description",
        content:
          "Fused real-time ocean, fishing, biodiversity and maritime boundary intelligence for any coordinate on Earth.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [lat, setLat] = useState(15.5);
  const [lon, setLon] = useState(68.5);
  const [latInput, setLatInput] = useState("15.5");
  const [lonInput, setLonInput] = useState("68.5");
  const [range, setRange] = useState<(typeof TIME_RANGES)[number]>("24h");
  const [mounted, setMounted] = useState(false);
  const [layers, setLayers] = useState({
    ocean: true,
    fishing: true,
    biodiversity: true,
    maritime: true,
  });

  useEffect(() => setMounted(true), []);

  const getConditions = useServerFn(fetchMarineConditions);
  const query = useQuery({
    queryKey: ["marine-conditions", lat, lon],
    queryFn: () => getConditions({ data: { latitude: lat, longitude: lon } }),
    staleTime: 5 * 60 * 1000,
  });

  const data = query.data;

  const select = (nextLat: number, nextLon: number) => {
    setLat(nextLat);
    setLon(nextLon);
    setLatInput(String(nextLat));
    setLonInput(String(nextLon));
  };

  const csv = useMemo(() => {
    if (!data) return "";
    const rows: Array<[string, string | number | null]> = [
      ["latitude", data.location.latitude],
      ["longitude", data.location.longitude],
      ["sea_surface_temperature_c", data.ocean.sea_surface_temperature_c],
      ["chlorophyll_mg_m3", data.ocean.chlorophyll_mg_m3],
      ["current_u_ms", data.ocean.current_u_ms],
      ["current_v_ms", data.ocean.current_v_ms],
      ["wave_height_m", data.ocean.wave_height_m],
      ["wind_speed_ms", data.weather.wind_speed_ms],
      ["fishing_hours", data.fishing_activity.fishing_hours],
      ["vessel_count", data.fishing_activity.vessel_count],
      ["biodiversity_records", data.biodiversity.total_records],
      ["biodiversity_taxa", data.biodiversity.taxon_count],
      ["eez", data.maritime_context.eez.name],
      ["timestamp", data.timestamp],
    ];
    return ["metric,value", ...rows.map(([k, v]) => `${k},${v ?? ""}`)].join("\n");
  }, [data]);

  const download = (contents: string, filename: string, type: string) => {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-eyebrow">Marine conditions</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Integrated view for {data?.location.name ?? `${lat.toFixed(2)}, ${lon.toFixed(2)}`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border bg-surface p-0.5">
              {TIME_RANGES.map((option) => (
                <button
                  key={option}
                  onClick={() => setRange(option)}
                  className={`rounded px-3 py-1.5 font-mono text-xs transition-colors ${
                    range === option
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
              <RefreshCw className={`mr-2 size-4 ${query.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section className="panel overflow-hidden">
            <div className="h-[420px] w-full">
              {mounted ? (
                <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
                  <OceanMap lat={lat} lon={lon} onSelect={select} />
                </Suspense>
              ) : (
                <Skeleton className="h-full w-full rounded-none" />
              )}
            </div>
            <div className="flex flex-wrap items-end gap-3 border-t border-border/70 p-4">
              <div className="w-28">
                <Label className="label-eyebrow" htmlFor="lat">
                  Latitude
                </Label>
                <Input
                  id="lat"
                  value={latInput}
                  onChange={(event) => setLatInput(event.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
              <div className="w-28">
                <Label className="label-eyebrow" htmlFor="lon">
                  Longitude
                </Label>
                <Input
                  id="lon"
                  value={lonInput}
                  onChange={(event) => setLonInput(event.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
              <Button
                onClick={() => {
                  const nextLat = Number(latInput);
                  const nextLon = Number(lonInput);
                  if (Number.isFinite(nextLat) && Number.isFinite(nextLon)) select(nextLat, nextLon);
                }}
              >
                <MapPin className="mr-2 size-4" />
                Go
              </Button>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => select(preset.lat, preset.lon)}
                    className="rounded-full border border-border bg-background/50 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="panel p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">Data layers</h2>
              <span className="font-mono text-xs text-muted-foreground">
                confidence {data ? `${Math.round(data.confidence * 100)}%` : "—"}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["ocean", "Ocean physics"],
                  ["fishing", "Fishing activity"],
                  ["biodiversity", "Biodiversity"],
                  ["maritime", "Maritime context"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm"
                >
                  {label}
                  <Switch
                    checked={layers[key]}
                    onCheckedChange={(checked) => setLayers((prev) => ({ ...prev, [key]: checked }))}
                  />
                </label>
              ))}
            </div>

            <div className="mt-4 rounded-md border border-border/60 bg-background/40 p-3">
              <p className="label-eyebrow">Selected window</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Last {range} · snapshot taken{" "}
                <span className="font-mono text-foreground/80">
                  {data ? new Date(data.timestamp).toUTCString() : "—"}
                </span>
              </p>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!data}
                onClick={() =>
                  download(JSON.stringify(data, null, 2), "orca-conditions.json", "application/json")
                }
              >
                <Download className="mr-2 size-4" />
                JSON
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!data}
                onClick={() => download(csv, "orca-conditions.csv", "text/csv")}
              >
                <Download className="mr-2 size-4" />
                CSV
              </Button>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Click anywhere on the map to re-run the fusion pipeline for that point. Every block below
              is labelled with where its numbers came from.
            </p>
          </section>
        </div>

        {query.isError ? (
          <p className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
            Could not load marine conditions for this point. Try refreshing or pick another location.
          </p>
        ) : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {layers.ocean ? (
            <Panel
              title="Ocean physics"
              loading={query.isLoading}
              badge={data ? <ProvenanceBadge provenance={data.ocean.provenance} /> : null}
            >
              <div className="grid grid-cols-2 gap-2">
                <Metric label="SST" value={data?.ocean.sea_surface_temperature_c} unit="°C" />
                <Metric label="Wave height" value={data?.ocean.wave_height_m} unit="m" />
                <Metric label="Chlorophyll" value={data?.ocean.chlorophyll_mg_m3} unit="mg/m³" />
                <Metric
                  label="Current"
                  value={
                    data && data.ocean.current_u_ms !== null && data.ocean.current_v_ms !== null
                      ? Math.hypot(data.ocean.current_u_ms, data.ocean.current_v_ms).toFixed(2)
                      : null
                  }
                  unit="m/s"
                  hint={
                    data && data.ocean.current_u_ms !== null
                      ? `u ${data.ocean.current_u_ms} · v ${data.ocean.current_v_ms}`
                      : undefined
                  }
                />
              </div>
              {data ? <SourceLine provenance={data.ocean.provenance} /> : null}
            </Panel>
          ) : null}

          {layers.fishing ? (
            <Panel
              title="Fishing activity"
              loading={query.isLoading}
              badge={data ? <ProvenanceBadge provenance={data.fishing_activity.provenance} /> : null}
            >
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Effort" value={data?.fishing_activity.fishing_hours} unit="h" />
                <Metric label="Vessels" value={data?.fishing_activity.vessel_count} />
                <Metric
                  label="Level"
                  value={data?.fishing_activity.activity_level ?? null}
                  className="col-span-2"
                />
              </div>
              {data ? <SourceLine provenance={data.fishing_activity.provenance} /> : null}
            </Panel>
          ) : null}

          {layers.biodiversity ? (
            <Panel
              title="Biodiversity"
              loading={query.isLoading}
              badge={data ? <ProvenanceBadge provenance={data.biodiversity.provenance} /> : null}
            >
              <div className="grid grid-cols-2 gap-2">
                <Metric
                  label="Occurrences"
                  value={data?.biodiversity.total_records?.toLocaleString() ?? null}
                />
                <Metric label="Species" value={data?.biodiversity.taxon_count} />
              </div>
              {data ? <SourceLine provenance={data.biodiversity.provenance} /> : null}
            </Panel>
          ) : null}

          {layers.maritime ? (
            <Panel
              title="Maritime context"
              loading={query.isLoading}
              badge={data ? <ProvenanceBadge provenance={data.maritime_context.provenance} /> : null}
            >
              <div className="space-y-2">
                <Metric label="Jurisdiction" value={data?.maritime_context.eez.name ?? "High seas"} />
                <Metric
                  label="Protected areas"
                  value={
                    data
                      ? data.maritime_context.mpas.length
                        ? data.maritime_context.mpas.map((mpa) => mpa.name).join(", ")
                        : "None recorded"
                      : null
                  }
                />
              </div>
              {data ? <SourceLine provenance={data.maritime_context.provenance} /> : null}
            </Panel>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel
            title="Surface weather"
            loading={query.isLoading}
            badge={data ? <ProvenanceBadge provenance={data.weather.provenance} /> : null}
          >
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Wind" value={data?.weather.wind_speed_ms} unit="m/s" />
              <Metric label="Air temp" value={data?.weather.air_temperature_c} unit="°C" />
            </div>
            {data ? <SourceLine provenance={data.weather.provenance} /> : null}
          </Panel>

          <Panel title="Contributing sources" loading={query.isLoading}>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {(data?.sources ?? []).map((source) => (
                <li key={source} className="flex items-center gap-2">
                  <Waves className="size-3.5 text-primary" />
                  {source}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </main>
    </div>
  );
}

function Panel({
  title,
  badge,
  loading,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {badge}
      </div>
      {loading ? <Skeleton className="h-24 w-full" /> : children}
    </section>
  );
}
