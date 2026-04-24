import Image from "next/image";
import Link from "next/link";
import { SquareTerminal } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const nav = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/install", label: "Install" },
  { href: "https://github.com/postigodev/sendo", label: "GitHub" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(7,10,13,0.78)] backdrop-blur-xl">
      <div className="page-shell flex h-[78px] items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-4">
          <span className="flex">
            <Image
              src="/brand/sendo.svg"
              alt="Sendo"
              width={47}
              height={47}
              priority
            />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[1.5rem] font-black tracking-[-0.06em] text-cyan-300">
              Sendo
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-8">
          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            {nav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="border-b-2 border-transparent pb-1 transition-colors hover:border-cyan-300 hover:text-cyan-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <Link
          href="/download/nsis"
          className={buttonVariants({ variant: "primary" })}
        >
          Download
        </Link>
      </div>
    </header>
  );
}

function siteGithub() {
  return "https://github.com/postigodev/sendo";
}
