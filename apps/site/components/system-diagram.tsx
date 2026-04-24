import { Cpu, Monitor, Music2, SquareTerminal, Tv2 } from "lucide-react";

export function SystemDiagram() {
  return (
    <div className="surface-panel relative overflow-hidden px-5 py-6 mt-16 md:px-6 md:py-7">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(31,184,205,0.08),transparent_38%)]" />
      <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(circle_at_1px_1px,rgba(31,184,205,0.35)_1px,transparent_0)] [background-size:28px_28px]" />

      <div className="relative">
        <div className="mb-5 flex justify-center text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          {" "}
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(31,184,205,0.9)]" />
            <span className="text-cyan-200/55">System stable</span>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-[22rem] flex-col items-center">
          <NodeCard
            icon={<Monitor className="h-5 w-5" />}
            title="Desktop UI"
            tone="primary"
            className="w-full max-w-[15rem]"
          />
          <Connector className="h-8" glow />
          <NodeCard
            icon={<SquareTerminal className="h-4.5 w-4.5" />}
            title="Tauri shell"
            subtitle="native bridge"
            tone="neutral"
            className="w-full max-w-[14.5rem]"
            trailing={
              <div className="flex gap-1">
                <span className="h-3.5 w-1 rounded-full bg-cyan-300/25" />
                <span className="h-3.5 w-1 rounded-full bg-cyan-300/55" />
                <span className="h-3.5 w-1 rounded-full bg-cyan-300" />
              </div>
            }
          />
          <Connector className="h-8" />
          <CoreNode />
          <div className="relative flex h-16 w-full max-w-[22rem] justify-center">
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 336 64"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M168 0V16"
                stroke="rgba(31,184,205,0.9)"
                strokeWidth="1.5"
              />
              <circle cx="168" cy="16" r="3" fill="rgba(31,184,205,1)" />
              <path
                d="M168 16H64V48"
                stroke="rgba(58,74,72,0.95)"
                strokeWidth="1.5"
                strokeDasharray="4 5"
              />
              <path
                d="M168 16H272V48"
                stroke="rgba(58,74,72,0.95)"
                strokeWidth="1.5"
                strokeDasharray="4 5"
              />
              <circle cx="64" cy="48" r="3" fill="rgba(58,74,72,1)" />
              <circle cx="272" cy="48" r="3" fill="rgba(58,74,72,1)" />
            </svg>
          </div>
          <div className="-mt-2 grid w-full max-w-[22rem] gap-2.5 sm:grid-cols-2">
            <LeafNode
              icon={<Music2 className="h-4.5 w-4.5" />}
              accent="bg-emerald-400/15 text-emerald-300"
              title="Spotify API"
            />
            <LeafNode
              icon={<Tv2 className="h-4.5 w-4.5" />}
              accent="bg-cyan-300/15 text-cyan-300"
              title="Fire TV ADB"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Connector({
  className,
  glow = false,
}: {
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`relative w-px ${className ?? ""} bg-gradient-to-b from-cyan-300/90 to-slate-700`}
    >
      <span
        className={`absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/40 bg-[#0b1216] ${
          glow ? "shadow-[0_0_10px_rgba(31,184,205,0.8)]" : ""
        }`}
      />
    </div>
  );
}

function NodeCard({
  icon,
  title,
  subtitle,
  trailing,
  tone,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  tone: "primary" | "neutral";
  className?: string;
}) {
  const styles =
    tone === "primary"
      ? "border-cyan-300/45 bg-cyan-300/[0.09] text-cyan-200 shadow-[0_0_20px_rgba(31,184,205,0.12)]"
      : "border-white/20 bg-white/[0.04] text-slate-100";

  return (
    <div
      className={`relative rounded-[18px] border px-5 py-4 ${styles} ${
        className ?? ""
      }`}
    >
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/15">
            {icon}
          </div>
          <div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.18em]">
              {title}
            </div>
            {subtitle ? (
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>
        {trailing}
      </div>
    </div>
  );
}

function LeafNode({
  icon,
  accent,
  title,
}: {
  icon: React.ReactNode;
  accent: string;
  title: string;
}) {
  return (
    <div className="rounded-[15px] border border-white/10 bg-white/[0.035] px-3.5 py-3">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-xl ${accent}`}
        >
          {icon}
        </div>
        <div>
          <div className="text-[13px] font-medium text-slate-100">{title}</div>
        </div>
      </div>
    </div>
  );
}

function CoreNode() {
  return (
    <div className="relative w-full max-w-[19.5rem] overflow-hidden rounded-[22px] border border-cyan-300/55 bg-[linear-gradient(180deg,rgba(9,20,24,0.98),rgba(11,18,22,0.98))] p-4 shadow-[0_0_24px_rgba(31,184,205,0.14)]">
      <div className="absolute inset-0 opacity-[0.1] [background-image:linear-gradient(45deg,rgba(31,184,205,0.4)_25%,transparent_25%,transparent_50%,rgba(31,184,205,0.4)_50%,rgba(31,184,205,0.4)_75%,transparent_75%,transparent)] [background-size:8px_8px]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(31,184,205,0.04)_50%)] [background-size:100%_4px]" />

      <div className="relative flex items-center justify-center gap-3">
        <div className="space-y-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-300">
            <Cpu className="h-5 w-5" />
          </div>
        </div>

        <div>
          <div className="text-[1.05rem] font-semibold uppercase tracking-[0.16em] text-cyan-300">
            Rust Core
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-slate-400">
            high-performance engine
          </div>
        </div>
      </div>
    </div>
  );
}
