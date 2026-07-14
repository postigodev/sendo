# Tag-Driven Distribution Design

## Goal

Build a cargo-dist-inspired, tag-driven GitHub Actions release pipeline for
Sendo without using dist's generated artifact graph. A reviewed `vX.Y.Z` tag
builds the Windows Tauri installers, generates SHA-256 metadata, stages a draft
GitHub Release, verifies it, and publishes it. NSIS is the primary download and
MSI is the managed-install alternative. No portable application archive is
published.

## Why the workflow is custom

dist 0.32 always plans a Windows executable archive for a distributable Cargo
binary. `extra-artifacts` can add Tauri bundles but cannot suppress that archive,
and a generic dist package without binaries is not considered releasable. Sendo
therefore adopts cargo-dist's release shape—plan, validate, build, host,
announce—through a checked-in workflow that models the actual Tauri artifacts
directly.

## Release contract

- GitHub Releases is the canonical binary channel.
- Only pushed tags matching exact SemVer `vX.Y.Z` or a SemVer prerelease trigger
  publication. A broad GitHub tag glob may start the workflow, but a script must
  reject every nonconforming tag before building.
- The tag version must exactly match the committed version in
  `apps/tauri/src-tauri/Cargo.toml`, `apps/tauri/package.json`,
  `apps/tauri/src-tauri/tauri.conf.json`, and the `sendo` entry in `Cargo.lock`.
- Release preparation happens in a normal reviewed commit or pull request.
- CI never edits versions, creates commits, or pushes tags.
- A public release exists only after every validation, build, hash, and asset
  inventory check succeeds.

## Components

### Shared version checker

Add a cross-platform PowerShell script used locally and in CI. It:

- parses strict SemVer and optional `v` prefix;
- reads the three product-version files and the Cargo lockfile;
- compares them with each other and, on tag runs, with `GITHUB_REF_NAME`;
- rejects missing, duplicate, malformed, or mismatched versions;
- performs no writes.

### Local release preparation

Refactor `release.ps1` into a preparation tool. Given `-Version X.Y.Z`, it:

- requires a clean worktree on `main` and an up-to-date remote view;
- refuses an existing local tag, remote tag, draft release, or public release;
- updates the three product-version files;
- updates the lockfile through Cargo rather than editing it as text;
- runs the shared checker and prints the remaining review/tag commands;
- supports `-DryRun`;
- never builds a public release, commits, tags, pushes, or calls
  `gh release create`.

### Windows packaging script

Add a PowerShell packaging script that:

- runs on Windows x64 only;
- uses Rust `1.92.0`, Node `24.12.0`, pnpm `10.26.2`, and committed lockfiles;
- runs `corepack pnpm install --frozen-lockfile` in `apps/tauri`;
- removes only the resolved staging directory and known NSIS/MSI bundle output
  directories before building;
- invokes Tauri with explicit `nsis,msi` bundles;
- resolves exactly one current-version NSIS file and one current-version MSI;
- rejects missing, duplicate, stale, wrong-version, or unexpected bundle files;
- copies the installers to deterministic staging names;
- writes one `.sha256` file per installer, a unified `sha256.sum`, and a JSON
  release manifest containing tag, commit SHA, version, asset names, sizes, and
  hashes.

Change `tauri.conf.json` from `"targets": "all"` to explicit NSIS and MSI
targets. Add `rust-toolchain.toml` and `"packageManager": "pnpm@10.26.2"` to
pin the build toolchain.

## GitHub Actions workflow

Add one checked-in `.github/workflows/release.yml`, inspired by cargo-dist's
phase boundaries but owned by Sendo.

### Triggers and concurrency

- `pull_request`: run planning and validation only;
- `push` tags matching `v*`: run the complete release pipeline;
- tag-scoped concurrency with `cancel-in-progress: false` prevents two runs for
  the same tag from publishing concurrently.

### Permissions

Default workflow permissions are `contents: read`. Only the publish job receives
`contents: write`. Checkout uses `persist-credentials: false`; no PAT or other
long-lived token is introduced.

### Jobs

1. `plan` runs the shared version checker and emits normalized version, tag, and
   prerelease status. On pull requests it verifies internal version consistency;
   on tag pushes it also verifies exact tag equality.
2. `validate` runs on Windows after `plan`: PowerShell parser checks,
   `cargo fmt --check`, `cargo check --workspace --locked`,
   `cargo test -p desk_remote_core --locked`, frozen pnpm installation, frontend
   build, and `git diff --check`.
3. `build-windows` runs only for tag pushes after `validate`, invokes the shared
   packaging script, verifies the six-file staging inventory, and uploads one
   immutable workflow artifact. Its name includes both `github.run_id` and
   `github.run_attempt`; `publish` downloads that exact name so UI reruns cannot
   collide with an artifact from an earlier attempt.
4. `publish` runs only for tag pushes after `build-windows`, downloads the
   workflow artifact, re-verifies hashes and exact inventory, creates or resumes
   a draft GitHub Release, uploads assets with replacement allowed only while
   the release is draft, verifies the remote asset inventory, and finally
   publishes the release.

The exact uploaded release assets are:

- `Sendo_<version>_x64-setup.exe`;
- `Sendo_<version>_x64_en-US.msi`;
- `Sendo_<version>_x64-setup.exe.sha256`;
- `Sendo_<version>_x64_en-US.msi.sha256`;
- `sha256.sum`;
- `release-manifest.json`.

GitHub's automatic “Source code (zip)” and “Source code (tar.gz)” links remain
visible for every release; they are repository snapshots, not supported Sendo
portable packages.

## Draft publication and recovery

- Failures before `publish` create no GitHub Release.
- `publish` creates a draft first, so upload or verification failures cannot
  expose an incomplete public release.
- Before creating or resuming a draft, `publish` verifies that the remote tag
  exists and resolves exactly to `GITHUB_SHA`. New drafts are created with
  `--verify-tag` and the prerelease flag emitted by `plan`.
- An existing release is resumable only when it is still a draft, targets the
  expected tag/commit, and its prerelease state exactly matches the `plan`
  output. Any mismatch blocks publication.
- A rerun may resume the same draft, replace its six expected assets, verify it,
  and publish it.
- Before removing draft status, `publish` downloads the six remote assets into
  a clean directory. It validates their exact names and sizes against
  `release-manifest.json`, hashes both downloaded installers, compares those
  hashes with each individual `.sha256` file and `sha256.sum`, and rejects any
  extra, missing, or byte-mismatched asset.
- An existing public release blocks the job; published assets are immutable.
- An unexpected draft with unknown assets blocks automatic recovery and requires
  maintainer inspection.
- A pushed tag is immutable. If validation or build fails before a draft exists,
  fixes use a new prerelease or patch version rather than moving the tag.
- The preparation script reports draft versus public release state and refuses
  either for a new version preparation.

## Documentation

Add `docs/distribution.md` as the operational source of truth and link it from
the README and contributor guide. It documents:

- NSIS as the recommended installer and MSI as the managed alternative;
- exact toolchain versions;
- release preparation and version synchronization;
- local and CI validation commands;
- creating and pushing one reviewed tag;
- workflow phases and expected assets;
- checksum verification;
- prereleases and draft recovery;
- the rule that pushed tags and public releases are immutable;
- unsigned-build Windows reputation warnings;
- current exclusions: portable ZIP, package managers, in-app updater, and code
  signing.

The public install page remains backed by the latest GitHub Release and keeps
NSIS primary and MSI secondary.

## Validation

Local validation before merging:

- PowerShell parser checks for every release script;
- unit-style fixture checks for version agreement, mismatch, invalid tag,
  existing tag/release, artifact inventory, and hash verification;
- `cargo fmt --check`;
- `cargo check --workspace --locked`;
- `cargo test -p desk_remote_core --locked`;
- `corepack pnpm install --frozen-lockfile` and `pnpm build` in `apps/tauri`;
- local Tauri packaging smoke test resolving exactly NSIS and MSI;
- static workflow inspection for triggers, conditions, `needs`, concurrency,
  permissions, and credential persistence;
- `git diff --check`.

Before the first stable release, use a fresh prerelease version and tag. Success
requires a draft-to-public transition containing exactly the six named assets.
Download both installers, verify individual and unified SHA-256 values, inspect
the JSON manifest, and confirm the built version. Rerun behavior is tested once
against a deliberately retained draft before being documented as supported.

## Out of scope

- cargo-dist-generated workflow or dist artifact graph.
- Portable application ZIP distribution.
- Scoop, WinGet, Chocolatey, or other package-manager publication.
- In-app update checks or installation.
- Windows Authenticode signing and artifact attestations.
- Cross-platform builds.
