import { Link } from "@tanstack/react-router";
import orcaMark from "@/assets/orca-mark.png";

const NAV = [
  { to: "/", label: "Conditions" },
  { to: "/query", label: "Agent" },
  { to: "/sources", label: "Sources" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-500 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <img src={orcaMark} alt="ORCA" width={36} height={36} className="size-9" />
          <span className="leading-tight">
            <span className="block font-mono text-base font-semibold tracking-[0.2em] text-foreground">
              ORCA
            </span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Marine Intelligence
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
