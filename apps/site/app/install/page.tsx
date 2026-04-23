import Link from "next/link";
import { ArrowUpRight, Check, Github, Wrench } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SectionShell } from "@/components/section-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { site } from "@/content/site";

const requirements = [
  "Windows",
  "adb available in PATH",
  "Fire TV with ADB debugging enabled",
  "Spotify developer credentials if your setup needs them",
];

export default function InstallPage() {
  return (
    <>
      <SiteHeader />
      <main className="pb-10">
        <section className="pb-10 pt-10 md:pb-14 md:pt-16">
          <div className="page-shell">
            <div className="max-w-3xl">
              <p className="section-label">Install</p>
              <h1 className="mt-4 text-4xl font-semibold text-white md:text-[3.7rem]">
                Install Sendo
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
                Download the latest Windows build, configure Fire TV access,
                connect Spotify, and keep the app in the tray for repeatable
                desktop control flows.
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
                  View releases
                </Link>
              </div>
            </div>
          </div>
        </section>

        <SectionShell
          eyebrow="Requirements"
          title="Before first run"
          description="This page should answer one question quickly: can I install it cleanly and understand the setup path without guessing?"
        >
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="surface-panel p-6">
              <p className="section-label">Quick note</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                Sendo is a local Windows utility.
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                The only real setup burden is Fire TV access over ADB and
                choosing the correct Spotify target device once auth is live.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
            {requirements.map((item) => (
              <div
                key={item}
                className="rounded-[20px] border border-white/8 bg-white/[0.02] px-5 py-4 text-sm text-slate-100"
              >
                {item}
              </div>
            ))}
            </div>
          </div>
        </SectionShell>

        <SectionShell
          eyebrow="Setup"
          title="First-run flow"
          description="The goal is to make first-run setup feel finite. Install, connect, select the target device, and save a first useful action."
        >
          <div className="surface-panel p-6 md:p-8">
            <ol className="space-y-5">
              {site.installSteps.map((step, index) => (
                <li
                  key={step}
                  className="flex gap-4 border-b border-white/6 pb-5 last:border-b-0 last:pb-0"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] text-sm font-semibold text-cyan-50">
                    {index + 1}
                  </span>
                  <span className="pt-1 text-sm leading-7 text-slate-200 md:text-base">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </SectionShell>

        <SectionShell
          eyebrow="Troubleshooting"
          title="Common setup failures"
          description="This should read more like a concise operations note than like a FAQ accordion exploded into cards."
        >
          <div className="space-y-3">
            {site.troubleshooting.map((item) => (
              <div key={item.title} className="surface-panel p-5 md:p-6">
                <div className="flex items-center gap-2 text-white">
                  <Wrench className="h-4 w-4 text-cyan-200" />
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-300">{item.body}</p>
              </div>
            ))}
          </div>
        </SectionShell>

        <SectionShell
          eyebrow="Technical links"
          title="Repository and reference material"
          description="After install, these are the only links that really matter."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Link
              href={site.links.github}
              className="surface-panel flex items-center justify-between p-5 text-sm font-medium text-slate-100 hover:border-cyan-300/20"
            >
              GitHub repository
              <Github className="h-4 w-4 text-cyan-200" />
            </Link>
            <Link
              href={`${site.links.github}#readme`}
              className="surface-panel flex items-center justify-between p-5 text-sm font-medium text-slate-100 hover:border-cyan-300/20"
            >
              README
              <ArrowUpRight className="h-4 w-4 text-cyan-200" />
            </Link>
            <Link
              href={site.links.release}
              className="surface-panel flex items-center justify-between p-5 text-sm font-medium text-slate-100 hover:border-cyan-300/20"
            >
              Latest release
              <Check className="h-4 w-4 text-cyan-200" />
            </Link>
          </div>
        </SectionShell>
      </main>
      <SiteFooter />
    </>
  );
}
