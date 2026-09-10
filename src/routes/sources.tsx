import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { SiteHeader } from "@/components/orca/site-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSourceStatuses } from "@/lib/marine.functions";

const STATUS_STYLE: Record<string, string> = {
  available: "text-[--color-live] border-[--color-live]/40 bg-[--color-live]/10",
  degraded: "text-[--color-simulated] border-[--color-simulated]/40 bg-[--color-simulated]/10",
  unavailable: "text-[--color-offline] border-[--color-offline]/40 bg-[--color-offline]/10",
};

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [
      { title: "ORCA — Data Source Health & Provenance" },
      {
        name: "description",
        content:
          "Live availability, latency and freshness for every marine data source feeding the ORCA fusion pipeline.",
      },
      { property: "og:title", content: "ORCA — Data Source Health & Provenance" },
      {
        property: "og:description",
        content: "Live availability and latency for every ORCA marine data source.",
      },
    ],
  }),
  component: Sources,
});

function Sources() {
  const getStatuses = useServerFn(fetchSourceStatuses);
  const query = useQuery({
    queryKey: ["source-status"],
    queryFn: () => getStatuses(),
    staleTime: 60 * 1000,
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="label-eyebrow">Data source explorer</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Upstream health
            </h1>
          </div>
          <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
            <RefreshCw className={`mr-2 size-4 ${query.isFetching ? "animate-spin" : ""}`} />
            Re-probe
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {query.isLoading
            ? [0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-20 w-full" />)
            : (query.data ?? []).map((source) => (
                <article
                  key={source.id}
                  className="panel flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="label-eyebrow">{source.category}</p>
                    <h2 className="mt-0.5 text-base font-medium">{source.label}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{source.detail}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {source.latency_ms !== null ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        {source.latency_ms} ms
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-widest ${STATUS_STYLE[source.status]}`}
                    >
                      {source.status}
                    </span>
                  </div>
                </article>
              ))}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Sources marked degraded need credentials. Add a Copernicus Marine account or a Global Fishing
          Watch API token and ORCA will swap the modelled values for observed ones automatically.
        </p>
      </main>
    </div>
  );
}
