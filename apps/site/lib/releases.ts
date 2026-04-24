export type ReleaseAsset = {
  name: string;
  browser_download_url: string;
};

export type LatestRelease = {
  tagName: string;
  versionLabel: string;
  htmlUrl: string;
  assets: ReleaseAsset[];
};

const REPO_OWNER = "postigodev";
const REPO_NAME = "sendo";
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

export async function getLatestRelease(): Promise<LatestRelease | null> {
  try {
    const response = await fetch(API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "sendo-site",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return null;
    }

    const release = (await response.json()) as {
      tag_name: string;
      html_url: string;
      assets: Array<{
        name: string;
        browser_download_url: string;
      }>;
    };

    return {
      tagName: release.tag_name,
      versionLabel: normalizeTag(release.tag_name),
      htmlUrl: release.html_url,
      assets: release.assets ?? [],
    };
  } catch {
    return null;
  }
}

export function findWindowsAsset(
  assets: ReleaseAsset[],
  kind: "nsis" | "msi",
): ReleaseAsset | null {
  const preferred = assets.find((asset) => matchesKind(asset.name, kind) && isPreferredWindowsAsset(asset.name));
  if (preferred) return preferred;

  return assets.find((asset) => matchesKind(asset.name, kind)) ?? null;
}

function matchesKind(name: string, kind: "nsis" | "msi") {
  const lower = name.toLowerCase();

  if (kind === "msi") {
    return lower.endsWith(".msi");
  }

  return lower.endsWith(".exe") && !lower.includes("updater");
}

function isPreferredWindowsAsset(name: string) {
  const lower = name.toLowerCase();
  return lower.includes("x64") || lower.includes("setup");
}

function normalizeTag(tag: string) {
  return tag.startsWith("v") ? tag : `v${tag}`;
}
