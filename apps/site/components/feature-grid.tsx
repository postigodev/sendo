export function FeatureGrid({ items }: { items: readonly string[] }) {
  return (
    <div className="grid gap-x-10 gap-y-4 md:grid-cols-2">
      {items.map((item, index) => (
        <div
          key={item}
          className="flex items-center gap-4 border-b border-white/8 py-4 text-sm font-medium text-slate-100"
        >
          <span className="w-8 shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/55">
            {String(index + 1).padStart(2, "0")}
          </span>
          {item}
        </div>
      ))}
    </div>
  );
}
