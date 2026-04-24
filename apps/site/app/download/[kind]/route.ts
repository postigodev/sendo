import { redirect } from "next/navigation";
import { findWindowsAsset, getLatestRelease } from "@/lib/releases";

export const dynamic = "force-dynamic";

export async function GET(
  _: Request,
  context: { params: Promise<{ kind: string }> },
) {
  const { kind } = await context.params;
  const normalizedKind = kind === "msi" ? "msi" : "nsis";

  const release = await getLatestRelease();
  if (!release) {
    redirect("https://github.com/postigodev/sendo/releases/latest");
  }

  const asset = findWindowsAsset(release.assets, normalizedKind);
  redirect(asset?.browser_download_url ?? release.htmlUrl);
}
