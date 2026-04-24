import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Github,
  Network,
  SquareTerminal,
  Tv2,
  Wrench,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SectionShell } from "@/components/section-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { site } from "@/content/site";
import { getLatestRelease } from "@/lib/releases";

const requirements = [
  "Windows",
  "adb available in PATH",
  "Fire TV with ADB debugging enabled",
  "Spotify developer credentials if your setup needs them",
];

export default async function InstallPage() {
  const latestRelease = await getLatestRelease();
  const versionLabel = latestRelease?.versionLabel ?? "Latest";

  return (
    <>
      <SiteHeader />
      <main className="pb-16">
        <section className="pb-8 pt-10 md:pb-10 md:pt-16">
          <div className="page-shell">
            <div className="grid gap-8 lg:grid-cols-[1.18fr_0.82fr] lg:items-start">
              <div className="max-w-4xl">
                <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-white md:text-[3.9rem]">
                  Install Sendo
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
                  Download the Windows build, enable Fire TV control over ADB,
                  connect Spotify, and keep Sendo available from the tray for
                  repeatable media actions.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/download/nsis"
                    className={buttonVariants({ variant: "primary" })}
                  >
                    Download NSIS
                  </Link>
                  <Link
                    href="/download/msi"
                    className={buttonVariants({ variant: "secondary" })}
                  >
                    Download MSI
                  </Link>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <DownloadBadge href="/download/nsis" label="NSIS" />
                  <DownloadBadge href="/download/msi" label="MSI" />
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                    {versionLabel}
                  </span>
                </div>
                <div className="mt-8 flex flex-wrap gap-2">
                  {["Windows", "ADB", "Fire TV", "Spotify Connect"].map(
                    (pill) => (
                      <span
                        key={pill}
                        className="rounded-full border border-cyan-200/10 bg-cyan-200/[0.04] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80"
                      >
                        {pill}
                      </span>
                    ),
                  )}
                </div>
              </div>

              <div className="surface-panel p-6 md:p-7">
                <p className="section-label">Quick read</p>
                <div className="mt-5 space-y-4">
                  <InfoRow
                    icon={<SquareTerminal className="h-4 w-4" />}
                    label="Runtime"
                    value="Windows + adb"
                  />
                  <InfoRow
                    icon={<Tv2 className="h-4 w-4" />}
                    label="TV target"
                    value="Fire TV with ADB debugging"
                  />
                  <InfoRow
                    icon={<Network className="h-4 w-4" />}
                    label="Flow"
                    value="Install, connect, select, test"
                  />
                </div>

                <div className="mt-6 rounded-[18px] border border-white/10 bg-cyan-300/[0.04] p-4">
                  <p className="text-sm leading-7 text-slate-300">
                    Sendo is local-first. There is no cloud setup layer between
                    install and device control.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-4">
          <div className="page-shell">
            <div className="surface-panel overflow-hidden p-0">
              <div className="grid divide-y divide-white/10 md:grid-cols-4 md:divide-x md:divide-y-0">
                {requirements.map((item, index) => (
                  <div
                    key={item}
                    className="group px-5 py-5 transition-colors hover:bg-cyan-300/[0.025] md:px-6 md:py-6"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="font-mono text-[11px] font-semibold tracking-[0.22em] text-cyan-300/70">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Check className="h-4 w-4 text-cyan-200/60 transition-colors group-hover:text-cyan-200" />
                    </div>
                    <p className="text-sm font-medium leading-6 text-slate-100">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <SectionShell
          eyebrow="Requirements"
          title="Before first run"
          description="Make sure the machine, the TV, and the target playback path are set up before the first action."
          className="page-shell"
        >
          <div className="grid gap-5 md:grid-cols-[1.2fr_0.8fr]">
            <div className="surface-panel p-6 md:p-7">
              <h3 className="text-xl font-semibold text-white">
                What to confirm
              </h3>
              <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
                <p>
                  The install itself is straightforward. Most first-run failures
                  come from missing ADB, Fire TV debugging not enabled, or
                  selecting the wrong Spotify device.
                </p>
                <p>
                  If those three things are correct, the rest of the setup is
                  usually quick.
                </p>
              </div>
            </div>

            <div className="surface-panel p-6 md:p-7">
              <h3 className="text-xl font-semibold text-white">
                Recommended path
              </h3>
              <ol className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
                <li className="flex gap-3">
                  <span className="mt-[2px] font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                    01
                  </span>
                  <span>
                    Install Sendo and keep{" "}
                    <code className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[0.92em] text-slate-200">
                      adb
                    </code>{" "}
                    available in{" "}
                    <code className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[0.92em] text-slate-200">
                      PATH
                    </code>
                    .
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-[2px] font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                    02
                  </span>
                  <span>Enable Fire TV debugging before opening the app.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-[2px] font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                    03
                  </span>
                  <span>
                    Authenticate Spotify and explicitly select a target.
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </SectionShell>
        <SectionShell
          eyebrow="Setup"
          title="First-run flow"
          description="From installation to first successful media control, this is the expected flow."
          className="page-shell"
        >
          <div className="surface-panel overflow-hidden">
            <ol className="divide-y divide-white/10">
              {site.installSteps.map((step, index) => (
                <li
                  key={step}
                  className="group grid gap-3 px-5 py-4 transition-colors hover:bg-cyan-300/[0.02] md:grid-cols-[4.5rem_1fr] md:px-6"
                >
                  <div className="flex items-start pt-0.5">
                    <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[15px] leading-7 text-slate-200">
                      {step}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </SectionShell>
        <SectionShell
          eyebrow="Troubleshooting"
          title="Common setup failures"
          description="These are the setup failures you are most likely to hit first."
          className="page-shell"  
        >
          <div className="surface-panel overflow-hidden">
            {site.troubleshooting.map((item, index) => (
              <div
                key={item.title}
                className="grid gap-3 border-b border-white/10 px-5 py-4 last:border-b-0 md:grid-cols-[4.5rem_1fr] md:px-6"
              >
                <div className="flex items-start pt-0.5">
                  <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-white">
                    <Wrench className="h-4 w-4 text-cyan-200" />
                    <h3 className="text-[15px] font-semibold md:text-base">
                      {item.title}
                    </h3>
                  </div>
                  <TroubleshootingBody title={item.title} />
                </div>
              </div>
            ))}
          </div>
        </SectionShell>
      </main>
      <SiteFooter />
    </>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-3 text-slate-200">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300/[0.08] text-cyan-200">
          {icon}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="max-w-[12rem] text-right text-sm text-slate-300">
        {value}
      </span>
    </div>
  );
}

function TroubleshootingBody({ title }: { title: string }) {
  const codeClass =
    "rounded bg-white/[0.05] px-1.5 py-0.5 text-[0.92em] text-slate-200";

  if (title === "ADB not connected") {
    return (
      <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-300">
        <li className="flex gap-3">
          <span className="text-cyan-200">-</span>
          <span>Make sure the TV is on the same network as this machine.</span>
        </li>
        <li className="flex gap-3">
          <span className="text-cyan-200">-</span>
          <span>Enable Fire TV ADB debugging before testing the connection.</span>
        </li>
        <li className="flex gap-3">
          <span className="text-cyan-200">-</span>
          <span>
            Confirm <code className={codeClass}>adb</code> is available in{" "}
            <code className={codeClass}>PATH</code>.
          </span>
        </li>
      </ul>
    );
  }

  if (title === "Wrong Spotify device") {
    return (
      <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-300">
        <li className="flex gap-3">
          <span className="text-cyan-200">-</span>
          <span>Open the Spotify page inside Sendo.</span>
        </li>
        <li className="flex gap-3">
          <span className="text-cyan-200">-</span>
          <span>Select the explicit playback target you actually want.</span>
        </li>
        <li className="flex gap-3">
          <span className="text-cyan-200">-</span>
          <span>Do not rely on whatever Spotify marks as the current device.</span>
        </li>
      </ul>
    );
  }

  if (title === "Auth expired") {
    return (
      <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-300">
        <li className="flex gap-3">
          <span className="text-cyan-200">-</span>
          <span>Go to the Spotify page in Sendo.</span>
        </li>
        <li className="flex gap-3">
          <span className="text-cyan-200">-</span>
          <span>Run re-authentication and refresh the cached token state.</span>
        </li>
      </ul>
    );
  }

  if (title === "Startup and tray behavior") {
    return (
      <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-300">
        <li className="flex gap-3">
          <span className="text-cyan-200">-</span>
          <span>Open the General page in the desktop app.</span>
        </li>
        <li className="flex gap-3">
          <span className="text-cyan-200">-</span>
          <span>Adjust launch-at-startup and start-minimized-to-tray behavior there.</span>
        </li>
      </ul>
    );
  }

  return null;
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
