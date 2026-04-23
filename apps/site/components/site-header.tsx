import Image from "next/image";
import Link from "next/link";

const nav = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/install", label: "Install" },
  { href: "https://github.com/postigodev/sendo", label: "GitHub" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/6 bg-[rgba(6,10,14,0.28)] backdrop-blur-xl supports-[backdrop-filter]:bg-[rgba(6,10,14,0.62)]">
      <div className="page-shell flex h-[68px] items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/10 bg-white/[0.03]">
            <Image
              src="/brand/sendo.svg"
              alt="Sendo"
              width={22}
              height={22}
              priority
            />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-base font-semibold text-white">Sendo</span>
            <span className="mt-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100/55">
              Desktop utility
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-5 text-sm text-slate-300">
          {nav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="transition-colors hover:text-cyan-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
