import Image from "next/image";

export function ScreenshotFrame() {
  return (
    <div className="flex items-center justify-center">
      <div className="flex">
        <Image
          src="/brand/sendo.svg"
          alt="Sendo"
          width={500}
          height={500}
          priority
        />
      </div>
    </div>
  );
}
