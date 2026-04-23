import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { site } from "@/content/site";

export function FooterCta() {
  return (
    <section className="section-space pt-10">
      <div className="page-shell">
        <div className="surface-panel overflow-hidden p-8 md:p-10">
          <div className="grid gap-8 md:grid-cols-[1.3fr_auto] md:items-center">
            <div>
              <p className="section-label">Install</p>
              <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
                Install Sendo
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                Built for Windows. Ready for local control, reusable shortcuts,
                and explicit device workflows.
              </p>
            </div>
            <Link
              href={site.links.release}
              className={cn(buttonVariants({ variant: "primary" }), "w-full md:w-auto")}
            >
              Download latest release
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
