import { cn } from "@/lib/utils";
import type { Provenance } from "@/lib/marine.server";

const MODE_STYLES: Record<string, string> = {
  live: "border-[--color-live]/40 bg-[--color-live]/10 text-[--color-live]",
  simulated: "border-[--color-simulated]/40 bg-[--color-simulated]/10 text-[--color-simulated]",
  unavailable: "border-[--color-offline]/40 bg-[--color-offline]/10 text-[--color-offline]",
};

const MODE_LABEL: Record<string, string> = {
  live: "Live",
  simulated: "Modelled",
  unavailable: "No data",
};

export function ProvenanceBadge({
  provenance,
  className,
}: {
  provenance: Provenance;
  className?: string;
}) {
  return (
    <span
      title={`${provenance.source}${provenance.note ? ` — ${provenance.note}` : ""}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
        MODE_STYLES[provenance.mode],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {MODE_LABEL[provenance.mode]}
    </span>
  );
}

export function SourceLine({ provenance }: { provenance: Provenance }) {
  return (
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
      <span className="text-foreground/80">{provenance.source}</span>
      {provenance.note ? ` · ${provenance.note}` : ""}
    </p>
  );
}
