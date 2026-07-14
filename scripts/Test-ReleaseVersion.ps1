param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$ExpectedTag,
    [switch]$PassThru
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$SemVerPattern = '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$'

function Get-JsonVersion {
    param([string]$Path)
    $value = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace([string]$value.version)) {
        throw "Missing version in $Path"
    }
    return [string]$value.version
}

function Get-CargoPackageVersion {
    param([string]$Path)
    $content = Get-Content -Raw -LiteralPath $Path
    $match = [regex]::Match($content, '(?ms)^\[package\]\s.*?^version\s*=\s*"([^"]+)"')
    if (-not $match.Success) {
        throw "Missing [package] version in $Path"
    }
    return $match.Groups[1].Value
}

function Get-LockPackageVersion {
    param([string]$Path, [string]$PackageName)
    $content = Get-Content -Raw -LiteralPath $Path
    $blocks = [regex]::Matches($content, '(?ms)^\[\[package\]\]\s*(?<body>.*?)(?=^\[\[package\]\]|\z)')
    $versions = @()
    foreach ($block in $blocks) {
        $body = $block.Groups['body'].Value
        $nameMatch = [regex]::Match($body, '(?m)^name\s*=\s*"([^"]+)"\s*$')
        if ($nameMatch.Success -and [string]::Equals($nameMatch.Groups[1].Value, $PackageName, [StringComparison]::Ordinal)) {
            $versionMatch = [regex]::Match($body, '(?m)^version\s*=\s*"([^"]+)"\s*$')
            if (-not $versionMatch.Success) {
                throw "Missing version for package '$PackageName' in $Path"
            }
            $versions += $versionMatch.Groups[1].Value
        }
    }
    if ($versions.Count -ne 1) {
        throw "Expected one '$PackageName' package in $Path; found $($versions.Count)."
    }
    return [string]$versions[0]
}

$resolvedRoot = [System.IO.Path]::GetFullPath($RepoRoot)
$packageJsonPath = Join-Path $resolvedRoot 'apps/tauri/package.json'
$cargoTomlPath = Join-Path $resolvedRoot 'apps/tauri/src-tauri/Cargo.toml'
$tauriConfigPath = Join-Path $resolvedRoot 'apps/tauri/src-tauri/tauri.conf.json'
$cargoLockPath = Join-Path $resolvedRoot 'Cargo.lock'

foreach ($path in @($packageJsonPath, $cargoTomlPath, $tauriConfigPath, $cargoLockPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required version source is missing: $path"
    }
}

$versions = [ordered]@{
    PackageJson = Get-JsonVersion $packageJsonPath
    CargoToml = Get-CargoPackageVersion $cargoTomlPath
    TauriConfig = Get-JsonVersion $tauriConfigPath
    CargoLock = Get-LockPackageVersion $cargoLockPath 'sendo'
}

$distinctVersions = @($versions.Values | Sort-Object -Unique)
if ($distinctVersions.Count -ne 1) {
    $details = ($versions.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ', '
    throw "Sendo version sources disagree: $details"
}

$version = [string]$distinctVersions[0]
if ($version -notmatch $SemVerPattern) {
    throw "Sendo version is not supported SemVer: $version"
}

if (-not [string]::IsNullOrWhiteSpace($ExpectedTag)) {
    if ($ExpectedTag -notmatch '^v(.+)$') {
        throw "Release tag must start with 'v': $ExpectedTag"
    }
    $tagVersion = $Matches[1]
    if ($tagVersion -notmatch $SemVerPattern) {
        throw "Release tag is not supported SemVer: $ExpectedTag"
    }
    if (-not [string]::Equals($version, $tagVersion, [StringComparison]::Ordinal)) {
        throw "Release tag $ExpectedTag does not match committed version $version."
    }
}

$result = [pscustomobject]@{
    Version = $version
    Tag = "v$version"
    IsPrerelease = $version.Contains('-')
}

if ($PassThru) {
    return $result
}

Write-Host "Sendo release version is consistent: $($result.Tag)"
