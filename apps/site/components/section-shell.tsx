import { cn } from "@/lib/utils";

export function SectionShell({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("section-space", className)}>
      <div className="page-shell">
        <div className="max-w-3xl">
          {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
          <h2 className="mt-3 text-balance text-3xl font-semibold text-white md:text-4xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              {description}
            </p>
          ) : null}
        </div>
        <div className="mt-8 md:mt-10">{children}</div>
      </div>
    </section>
  );
}
