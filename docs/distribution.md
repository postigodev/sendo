# Sendo distribution

Sendo publishes Windows installers from Git tags. A tag matching `vX.Y.Z` (including SemVer prereleases such as `v0.2.0-rc.1`) is the only event that can build and publish a GitHub Release.

## Install Sendo

Each supported release contains six assets:

- `Sendo_<version>_x64-setup.exe` — the recommended NSIS installer for most users
- `Sendo_<version>_x64_en-US.msi` — an MSI intended for managed or administrative deployment
- one `.sha256` sidecar for each installer
- `sha256.sum` with both installer checksums
- `release-manifest.json` with the tag, commit, sizes, and SHA-256 hashes

The source `.zip` and `.tar.gz` files shown automatically by GitHub are source snapshots, not portable Sendo applications.

Sendo's installers are currently unsigned. Windows SmartScreen may display an unknown-publisher warning. Verify that the release belongs to this repository and compare the downloaded file against its published SHA-256 checksum before running it.

```powershell
Get-FileHash .\Sendo_0.1.0_x64-setup.exe -Algorithm SHA256
```

## Prepare a release

The repository pins Rust 1.92.0, Node.js 24.12.0, and pnpm 10.26.2. Start from a clean local `main` that exactly matches `postigodev/sendo` on GitHub:

```powershell
.\release.ps1 -Version 0.2.0 -DryRun
.\release.ps1 -Version 0.2.0
```

The preparation script changes only the four committed version sources:

- `apps/tauri/package.json`
- `apps/tauri/src-tauri/Cargo.toml`
- `apps/tauri/src-tauri/tauri.conf.json`
- the `sendo` package entry in `Cargo.lock`

It does not build installers, commit, create a tag, push, or publish a release. Review the diff, commit it, push `main`, and let the normal pull-request/main checks pass. Then tag that exact commit:

```powershell
git tag -a v0.2.0 -m "Sendo v0.2.0"
git push origin v0.2.0
```

The Release workflow validates the tag against all four version sources, runs the Rust and frontend checks, builds only NSIS and MSI packages on Windows, and uploads a run-specific Actions artifact. Publication happens through a draft GitHub Release. The workflow downloads every remote asset into a clean directory and rechecks the complete inventory, sizes, and hashes before making the draft public.

Pull requests run the planning and validation jobs but never package or publish a release.

## Failure and rerun behavior

A failed run may resume an existing draft only when its tag and prerelease state match and it contains no unknown assets. The workflow refuses to mutate an already-public release. It also refuses to publish when the remote tag does not resolve to the workflow commit.

If a draft is intentionally abandoned, inspect and delete it manually before rerunning. Do not replace or move a published release tag; prepare a new patch version instead.

## Scope

The current distribution surface is Windows x64 NSIS and MSI. Portable app archives, package-manager manifests, in-app updates, code signing, and non-Windows bundles are not part of this workflow yet.
