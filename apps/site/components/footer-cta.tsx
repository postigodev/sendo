import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { site } from "@/content/site";

export function FooterCta({
  versionLabel,
}: {
  versionLabel?: string;
}) {
  return (
    <section className="section-space pt-4">
      <div className="page-shell">
        <div className="surface-panel overflow-hidden p-8 md:p-10">
          <div className="grid gap-8 md:grid-cols-[1.3fr_auto] md:items-center">
            <div>
              <p className="section-label">Download</p>
              <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
                Ready to install, configure, and keep it in the tray.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                Built for Windows. The install path is short. What matters is
                that the requirements and first-run setup are obvious before
                you touch the desktop app.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/download/nsis"
                  className="rounded-full border border-cyan-200/10 bg-cyan-200/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/85 transition-colors hover:border-cyan-200/20 hover:bg-cyan-200/[0.08] hover:text-white"
                >
                  NSIS
                </Link>
                <Link
                  href="/download/msi"
                  className="rounded-full border border-cyan-200/10 bg-cyan-200/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/85 transition-colors hover:border-cyan-200/20 hover:bg-cyan-200/[0.08] hover:text-white"
                >
                  MSI
                </Link>
                {versionLabel ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                    {versionLabel}
                  </span>
                ) : null}
              </div>
            </div>
            <Link
              href="/download/nsis"
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
