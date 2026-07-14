param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$')]
    [string]$Version,

    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Repository = 'postigodev/sendo'
$RepoRoot = $PSScriptRoot
$Tag = "v$Version"
$VersionFiles = @(
    (Join-Path $RepoRoot 'apps/tauri/package.json'),
    (Join-Path $RepoRoot 'apps/tauri/src-tauri/Cargo.toml'),
    (Join-Path $RepoRoot 'apps/tauri/src-tauri/tauri.conf.json')
)

function Invoke-Checked {
    param([string]$FilePath, [string[]]$ArgumentList)
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath failed with exit code $LASTEXITCODE."
    }
}

function Set-Utf8NoBomContent {
    param([string]$Path, [string]$Content)
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Set-JsonVersion {
    param([string]$Path, [string]$NewVersion)
    $content = Get-Content -Raw -LiteralPath $Path
    $regex = [regex]'(?m)("version"\s*:\s*")([^"]+)(")'
    $updated = $regex.Replace($content, "`$1$NewVersion`$3", 1)
    if ($updated -eq $content) { throw "Could not update version in $Path" }
    Set-Utf8NoBomContent $Path $updated
}

function Set-CargoVersion {
    param([string]$Path, [string]$NewVersion)
    $content = Get-Content -Raw -LiteralPath $Path
    $regex = [regex]'(?ms)(^\[package\]\s.*?^version\s*=\s*")([^"]+)(")'
    $updated = $regex.Replace($content, "`$1$NewVersion`$3", 1)
    if ($updated -eq $content) { throw "Could not update [package] version in $Path" }
    Set-Utf8NoBomContent $Path $updated
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI (gh) is required.' }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Cargo is required.' }

$branch = (git -C $RepoRoot branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') { throw "Release preparation must run on main; current branch is '$branch'." }

$status = @(git -C $RepoRoot status --porcelain)
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the Git worktree.' }
if ($status.Count -ne 0) { throw 'Release preparation requires a clean worktree.' }

$localCommit = (git -C $RepoRoot rev-parse HEAD).Trim()
$remoteCommit = (& gh api "repos/$Repository/commits/main" --jq '.sha').Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($remoteCommit)) { throw 'Could not resolve the remote main commit.' }
if ($localCommit -ne $remoteCommit) { throw "Local main ($localCommit) does not match remote main ($remoteCommit)." }

$releaseJson = & gh release view $Tag --repo $Repository --json 'isDraft,url' 2>$null
if ($LASTEXITCODE -eq 0) {
    $release = $releaseJson | ConvertFrom-Json
    $state = if ($release.isDraft) { 'Draft' } else { 'Public' }
    throw "$state GitHub release $Tag already exists: $($release.url)"
}

git -C $RepoRoot show-ref --verify --quiet "refs/tags/$Tag"
if ($LASTEXITCODE -eq 0) { throw "Local tag $Tag already exists." }

& gh api "repos/$Repository/git/ref/tags/$Tag" --silent 2>$null
if ($LASTEXITCODE -eq 0) { throw "Remote tag $Tag already exists." }

Write-Host "Release preparation plan for $Tag" -ForegroundColor Cyan
Write-Host "  commit: $localCommit"
Write-Host '  update: apps/tauri/package.json'
Write-Host '  update: apps/tauri/src-tauri/Cargo.toml'
Write-Host '  update: apps/tauri/src-tauri/tauri.conf.json'
Write-Host '  refresh: Cargo.lock'
Write-Host '  leaves commit, tag, push, build, and publication to you/CI'

if ($DryRun) {
    Write-Host 'Dry run complete; no files changed.' -ForegroundColor Green
    exit 0
}

$backupPaths = @($VersionFiles + (Join-Path $RepoRoot 'Cargo.lock'))
$backups = @{}
foreach ($path in $backupPaths) { $backups[$path] = [System.IO.File]::ReadAllBytes($path) }

try {
    Set-JsonVersion $VersionFiles[0] $Version
    Set-CargoVersion $VersionFiles[1] $Version
    Set-JsonVersion $VersionFiles[2] $Version

    Push-Location $RepoRoot
    try { Invoke-Checked cargo @('check', '-p', 'sendo') }
    finally { Pop-Location }

    & (Join-Path $RepoRoot 'scripts/Test-ReleaseVersion.ps1') -RepoRoot $RepoRoot -ExpectedTag $Tag
    if ($LASTEXITCODE -ne 0) { throw 'Version consistency validation failed.' }

    $changed = @(git -C $RepoRoot diff --name-only)
    $allowed = @('Cargo.lock', 'apps/tauri/package.json', 'apps/tauri/src-tauri/Cargo.toml', 'apps/tauri/src-tauri/tauri.conf.json')
    $unexpected = @($changed | Where-Object { $_ -notin $allowed })
    if ($unexpected.Count -gt 0) { throw "Unexpected files changed: $($unexpected -join ', ')" }
}
catch {
    foreach ($entry in $backups.GetEnumerator()) { [System.IO.File]::WriteAllBytes($entry.Key, $entry.Value) }
    throw
}

Write-Host "Prepared $Tag. Review and commit these four version files." -ForegroundColor Green
Write-Host 'After the reviewed commit is on main, tag that exact commit:'
Write-Host "  git tag -a $Tag -m `"Sendo $Tag`""
Write-Host "  git push origin $Tag"
