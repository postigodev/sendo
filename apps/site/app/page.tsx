import Link from "next/link";
import { ArrowRight, Box, MonitorSpeaker, MoveRight, RadioTower, Zap } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FeatureGrid } from "@/components/feature-grid";
import { FooterCta } from "@/components/footer-cta";
import { MainFlow } from "@/components/main-flow";
import { PrinciplesStrip } from "@/components/principles-strip";
import { ScreenshotFrame } from "@/components/screenshot-frame";
import { SectionShell } from "@/components/section-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SystemDiagram } from "@/components/system-diagram";
import { site } from "@/content/site";

const pills = ["Windows", "Fire TV", "Spotify Connect", "Local-first"];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="pb-6">
        <section className="overflow-hidden pb-14 pt-10 md:pb-20 md:pt-16">
          <div className="page-shell">
            <div className="grid gap-12 lg:grid-cols-[0.98fr_1.12fr] lg:items-center">
              <div className="max-w-2xl">
                <p className="section-label">Local-first desktop utility</p>
                <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.02] text-white md:text-[3.7rem]">
                  {site.headline}
                </h1>
                <p className="mt-6 max-w-xl text-balance text-base leading-8 text-slate-300 md:text-lg">
                  {site.subhead}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href={site.links.release}
                    className={buttonVariants({ variant: "primary" })}
                  >
                    Download for Windows
                  </Link>
                  <Link
                    href={site.links.github}
                    className={buttonVariants({ variant: "secondary" })}
                  >
                    View on GitHub
                  </Link>
                </div>
                <div className="mt-7 flex flex-wrap gap-2">
                  {pills.map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full border border-cyan-200/10 bg-cyan-200/[0.04] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
              <ScreenshotFrame />
            </div>
          </div>
        </section>

        <SectionShell
          eyebrow="Core principles"
          title="Built for explicit control, not guesswork."
          description="Sendo stays local, binds actions to the device you selected, and turns repeated routines into durable desktop shortcuts."
        >
          <PrinciplesStrip items={site.principles} />
        </SectionShell>

        <SectionShell
          eyebrow="Main flow"
          title="Wake the TV, launch apps, route playback, reuse the flow."
          description="The point is not a prettier remote. The point is compressing a fragile multi-device routine into one repeatable path."
        >
          <MainFlow steps={site.flow} />
        </SectionShell>

        <SectionShell
          id="how-it-works"
          eyebrow="Architecture"
          title="Built as a local orchestration layer."
          description="Sendo is split so the UI stays lightweight while device execution, playback targeting, and config persistence live in a dedicated native core."
        >
          <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
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
                <div className="rounded-[18px] border border-white/8 bg-white/[0.025] p-4">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <MonitorSpeaker className="h-4 w-4 text-cyan-200" />
                    Native shell
                  </div>
                  <p className="mt-2 text-slate-300">
                    Tray, startup, notifications, and window lifecycle.
                  </p>
                </div>
                <div className="rounded-[18px] border border-white/8 bg-white/[0.025] p-4">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <RadioTower className="h-4 w-4 text-cyan-200" />
                    Device execution
                  </div>
                  <p className="mt-2 text-slate-300">
                    Fire TV control, playback routing, and explicit target selection.
                  </p>
                </div>
              </div>
            </div>
            <SystemDiagram />
          </div>
        </SectionShell>

        <SectionShell
          eyebrow="Why Sendo exists"
          title="Desktop media control is still fragmented."
          description="The hard part is not sending a command. It is keeping TV state, playback state, and target identity aligned across different systems."
        >
          <div className="max-w-3xl space-y-5 text-base leading-8 text-slate-300">
            <p>
              Spotify playback and TV control usually live across different
              surfaces: desktop apps, phone apps, TV remotes, and account-scoped
              device routing. That makes simple actions surprisingly fragile.
            </p>
            <p>
              Sendo exists to make those transitions explicit, local, and
              reusable, so repeated routines become one deterministic desktop
              flow instead of a chain of guesses.
            </p>
          </div>
        </SectionShell>

        <SectionShell
          eyebrow="Capabilities"
          title="A compact control surface for repeated TV and media actions."
          description="Sendo is broader than Spotify. It is a desktop control layer for TV interaction, media routing, and reusable execution flows."
        >
          <FeatureGrid items={site.features} />
        </SectionShell>

        <SectionShell
          eyebrow="Download"
          title="Ready to install, configure, and keep in the tray."
          description="The install path is short. What matters is that the requirements and first-run setup are obvious before you touch the desktop app."
        >
          <div className="surface-panel p-7 md:p-8">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <div>
                <p className="max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                  Use the install guide for setup requirements, first-run steps,
                  and troubleshooting around ADB, Spotify auth, and explicit
                  device targeting.
                </p>
                <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-100">
                  <Link href="/install" className="inline-flex items-center gap-2 font-semibold text-cyan-100">
                    Open install guide <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href={site.links.github} className="inline-flex items-center gap-2 text-slate-300 hover:text-cyan-100">
                    Read the README <MoveRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              <div className="grid gap-3 text-sm text-slate-200">
                <div className="rounded-[18px] border border-white/8 bg-white/[0.025] p-4">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <Zap className="h-4 w-4 text-cyan-200" />
                    Windows-native flow
                  </div>
                  <p className="mt-2 text-slate-300">
                    Install the app, keep it local, and route recurring actions
                    through tray commands or hotkeys.
                  </p>
                </div>
                <div className="rounded-[18px] border border-white/8 bg-white/[0.025] p-4">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <Box className="h-4 w-4 text-cyan-200" />
                    Install + keep local
                  </div>
                  <p className="mt-2 text-slate-300">
                    No cloud account system, no control plane, and no handoff to
                    some separate web dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SectionShell>

        <FooterCta />
      </main>
      <SiteFooter />
    </>
  );
}
