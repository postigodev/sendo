import { Bolt, Cable, Target } from "lucide-react";

const icons = [Bolt, Target, Cable];

export function PrinciplesStrip({
  items,
}: {
  items: ReadonlyArray<{ title: string; body: string }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item, index) => {
        const Icon = icons[index] ?? Bolt;
        return (
          <div
            key={item.title}
            className="rounded-[22px] border border-white/8 bg-white/[0.02] p-5"
          >
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/12 bg-cyan-300/[0.06]">
                <Icon className="h-5 w-5 text-cyan-200" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
