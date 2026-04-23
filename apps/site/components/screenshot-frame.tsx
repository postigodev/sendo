import Image from "next/image";

export function ScreenshotFrame() {
  return (
    <div className="rounded-[28px] border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(18,24,31,0.92),rgba(11,16,22,0.98))] p-3 shadow-[0_26px_90px_rgba(15,177,197,0.14)]">
      <div className="mb-3 flex items-center gap-2 px-2">
        <span className="h-2 w-2 rounded-full bg-slate-600" />
        <span className="h-2 w-2 rounded-full bg-slate-600" />
        <span className="h-2 w-2 rounded-full bg-slate-600" />
      </div>
      <div className="overflow-hidden rounded-[20px] border border-white/8 bg-[#0f141a]">
        <Image
          src="/images/sendo-home.png"
          alt="Sendo home screen"
          width={1919}
          height={1079}
          priority
          className="h-auto w-full opacity-[0.985]"
        />
      </div>
    </div>
  );
}
