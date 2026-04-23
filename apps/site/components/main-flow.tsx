import { ArrowRight } from "lucide-react";

export function MainFlow({ steps }: { steps: readonly string[] }) {
  return (
    <div className="surface-panel p-6 md:p-8">
      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
        <div className="max-w-sm">
          <p className="section-label">Workflow compression</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">
            One path instead of five manual handoffs.
          </h3>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Sendo turns repeated TV and media actions into one explicit desktop
            workflow that you can keep in favorites, hotkeys, and tray actions.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[repeat(4,minmax(0,1fr))]">
        {steps.map((step, index) => (
          <div key={step} className="relative rounded-[22px] border border-white/8 bg-white/[0.02] p-5">
            <div className="section-label text-cyan-100/50">Step {index + 1}</div>
            <div className="mt-5 text-base font-semibold text-white md:text-lg">{step}</div>
            {index < steps.length - 1 ? (
              <ArrowRight className="mt-6 h-4 w-4 text-cyan-200/50 md:absolute md:right-5 md:top-5 md:mt-0" />
            ) : null}
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
