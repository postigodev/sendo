export function SystemDiagram() {
  return (
    <div className="surface-panel p-6 md:p-8">
      <div className="mx-auto max-w-md">
        <div className="rounded-[22px] border border-cyan-300/20 bg-cyan-300/[0.08] p-4 text-center text-sm font-semibold text-cyan-50">
          Desktop UI
        </div>
        <div className="mx-auto h-6 w-px bg-white/10" />
        <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-center text-sm font-semibold text-slate-100">
          Tauri shell
        </div>
        <div className="mx-auto h-6 w-px bg-white/10" />
        <div className="rounded-[22px] border border-emerald-300/20 bg-emerald-300/[0.08] p-4 text-center text-sm font-semibold text-emerald-50">
          Rust core
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4 text-center text-sm text-slate-100">
            Spotify API
          </div>
          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4 text-center text-sm text-slate-100">
            Fire TV ADB
          </div>
        </div>
      </div>
    </div>
  );
}
