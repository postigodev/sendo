import Link from "next/link";
import { site } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="pb-10 pt-6">
      <div className="page-shell border-t border-white/8 pt-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-white">
              Built by Piero Postigo Rocchetti
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
              Copyright 2026
            </p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-slate-300">
            <Link href={site.links.github} className="hover:text-cyan-100">
              GitHub
            </Link>
            <Link href={site.links.portfolio} className="hover:text-cyan-100">
              Portfolio
            </Link>
            <Link href={site.links.linkedin} className="hover:text-cyan-100">
              LinkedIn
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
