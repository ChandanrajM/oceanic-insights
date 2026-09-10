import { cn } from "@/lib/utils";

export function Metric({
  label,
  value,
  unit,
  hint,
  className,
}: {
  label: string;
  value: number | string | null | undefined;
  unit?: string;
  hint?: string;
  className?: string;
}) {
  const missing = value === null || value === undefined || value === "";
  return (
    <div className={cn("rounded-md border border-border/60 bg-background/40 p-3", className)}>
      <p className="label-eyebrow">{label}</p>
      <p className="mt-1 font-mono text-xl text-foreground">
        {missing ? "—" : value}
        {!missing && unit ? <span className="ml-1 text-sm text-muted-foreground">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
