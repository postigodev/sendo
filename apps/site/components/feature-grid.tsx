export function FeatureGrid({ items }: { items: readonly string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item, index) => (
        <div
          key={item}
          className="group rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition-colors"
        >
          <span className="font-mono text-xs tracking-[0.28em] text-cyan-300/80">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="h-px flex-1 bg-white/15 ml-4" />

          <span className="text-sm font-semibold text-white md:text-base">
            {item}
          </span>
        </div>
      ))}
    </div>
  );
}
