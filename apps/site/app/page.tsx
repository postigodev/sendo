import Link from "next/link";
import {
  ArrowRight,
  Code2,
  HardDriveDownload,
  MonitorSpeaker,
  RadioTower,
  ShieldCheck,
  SquareTerminal,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FeatureGrid } from "@/components/feature-grid";
import { FooterCta } from "@/components/footer-cta";
import { MainFlow } from "@/components/main-flow";
import { ScreenshotFrame } from "@/components/screenshot-frame";
import { SectionShell } from "@/components/section-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SystemDiagram } from "@/components/system-diagram";
import { site } from "@/content/site";
import { getLatestRelease } from "@/lib/releases";

const pills = ["Windows", "Fire TV", "Spotify Connect", "Local-first"];

export default async function HomePage() {
  const latestRelease = await getLatestRelease();
  const versionLabel = latestRelease?.versionLabel ?? "Latest";

  return (
    <>
      <SiteHeader />
      <main className="pb-16">
        <section className="overflow-hidden pb-10 pt-10 md:pb-14 md:pt-16">
          <div className="page-shell">
            <div className="grid gap-8 lg:grid-cols-[1.38fr_0.62fr] lg:items-center xl:gap-10">
              <div className="max-w-[64rem]">
                <h1 className="max-w-[45ch] text-balance text-[3.35rem] font-semibold leading-[0.98] text-white md:text-[4.85rem] xl:text-[3rem]">
                  {site.headline}
                </h1>
                <p className="mt-7 max-w-3xl text-balance text-lg leading-9 text-slate-300 md:text-[1.18rem]">
                  {site.subhead}
                </p>
                <div className="mt-9 flex flex-wrap gap-4">
                  <Link
                    href="/download/nsis"
                    className={
                      buttonVariants({ variant: "primary" }) +
                      " gap-3 px-7 py-4 text-base"
                    }
                  >
                    <HardDriveDownload className="h-5 w-5" />
                    Download for Windows
                  </Link>
                  <Link
                    href={site.links.github}
                    className={
                      buttonVariants({ variant: "secondary" }) +
                      " gap-3 px-7 py-4 text-base"
                    }
                  >
                    <Code2 className="h-5 w-5" />
                    View on GitHub
                  </Link>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <DownloadBadge href="/download/nsis" label="NSIS" />
                  <DownloadBadge href="/download/msi" label="MSI" />
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                    {versionLabel}
                  </span>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  {pills.map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full border border-cyan-200/10 bg-cyan-200/[0.04] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-center lg:justify-center">
                <ScreenshotFrame />
              </div>
            </div>

            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              <div className="surface-panel p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                      Latest release
                    </p>
                    <h2 className="mt-4 text-[2rem] font-semibold tracking-[-0.04em] text-cyan-200">
                      {versionLabel}
                    </h2>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] p-3 text-cyan-200">
                    <HardDriveDownload className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-5 text-base leading-8 text-slate-300">
                  Current Windows release for local TV control, Spotify routing,
                  tray actions, and reusable shortcuts.
                </p>
                <Link
                  href={latestRelease?.htmlUrl ?? site.links.release}
                  className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100 transition-colors hover:text-white"
                >
                  Read changelog
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="surface-panel p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                      System requirements
                    </p>
                    <h2 className="mt-4 text-[2rem] font-semibold tracking-[-0.04em] text-white">
                      Windows setup
                    </h2>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] p-3 text-slate-200">
                    <SquareTerminal className="h-5 w-5" />
                  </span>
                </div>
                <dl className="mt-6 space-y-4 text-sm text-slate-300">
                  <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3">
                    <dt className="text-slate-400">OS</dt>
                    <dd className="text-right text-slate-100">Windows 10/11</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3">
                    <dt className="text-slate-400">TV</dt>
                    <dd className="text-right text-slate-100">
                      Fire TV with ADB debugging
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-400">Runtime</dt>
                    <dd className="text-right text-slate-100">
                      adb available in PATH
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="surface-panel p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                      Deployment model
                    </p>
                    <h2 className="mt-4 text-[2rem] font-semibold tracking-[-0.04em] text-white">
                      Local-first
                    </h2>
                  </div>
                  <span className="rounded-full border border-emerald-300/10 bg-emerald-300/[0.05] p-3 text-emerald-300">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-6 space-y-4 text-sm leading-7 text-slate-300">
                  <p>
                    No cloud control plane, no account dashboard, no remote
                    relay.
                  </p>
                  <p>
                    Config, auth state, and execution stay on your machine while
                    GitHub remains the source of truth for code and releases.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <SectionShell
          id="how-it-works"
          eyebrow="Main flow"
          title="Wake the TV, launch apps, route playback, reuse the flow."
          description="The point is not a prettier remote. The point is compressing a fragile multi-device routine into one repeatable path."
          className="page-shell"
        >
          <MainFlow steps={site.flow} />
        </SectionShell>
        <div className="grid lg:grid-cols-2 items-start page-shell">
          <SectionShell
            eyebrow="Architecture"
            title="Built as a local orchestration layer."
            description="Sendo is split so the UI stays lightweight while device execution, playback targeting, and config persistence live in a dedicated native core."
          >
            <div className="space-y-5 text-sm leading-7 text-slate-300 md:text-base">
              <p>
                The UI runs in Tauri, while a Rust core handles Fire TV control
                over ADB, Spotify auth and playback routing, persistent config,
                and reusable bindings.
              </p>
              <p>
                Because Spotify and Fire TV expose different state models, Sendo
                actively reconciles device state and playback state instead of
                assuming they stay aligned.
              </p>
              <div className="grid gap-3 pt-2 text-sm text-slate-200 sm:grid-cols-2">
                <div className="rounded-[18px] border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <MonitorSpeaker className="h-4 w-4 text-cyan-200" />
                    Native shell
                  </div>
                  <p className="mt-2 text-slate-300">
                    Tray, startup, notifications, and window lifecycle.
                  </p>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <RadioTower className="h-4 w-4 text-cyan-200" />
                    Device execution
                  </div>
                  <p className="mt-2 text-slate-300">
                    Fire TV control, playback routing, and explicit target
                    selection.
                  </p>
                </div>
              </div>
            </div>
          </SectionShell>
          <div className="lg:flex lg:h-full lg:items-center lg:justify-center">
            <SystemDiagram />
          </div>
        </div>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center page-shell">
          <SectionShell
            eyebrow="Capabilities"
            title="A compact control surface for repeated TV and media actions."
            description="Sendo is broader than Spotify. It is a desktop control layer for TV interaction, media routing, and reusable execution flows."
          >
            <div className="max-w-xl space-y-5 text-base leading-8 text-slate-300">
              <p>
                Spotify playback and TV control usually live across desktop
                apps, phone apps, TV remotes, and account-scoped device routing.
                That makes simple actions surprisingly fragile.
              </p>
              <p>
                Sendo exists to make those transitions explicit, local, and
                reusable, so repeated routines become one deterministic desktop
                flow instead of a chain of guesses.
              </p>
            </div>
          </SectionShell>

          <div className="flex h-full items-center">
            <FeatureGrid items={site.features} />
          </div>
        </div>
        <FooterCta versionLabel={versionLabel} />
      </main>
      <SiteFooter />
    </>
  );
}

function DownloadBadge({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-cyan-200/10 bg-cyan-200/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/85 transition-colors hover:border-cyan-200/20 hover:bg-cyan-200/[0.08] hover:text-white"
    >
      {label}
    </Link>
  );
}
