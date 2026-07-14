param(
    [Parameter(Mandatory = $true)]
    [string]$Version,
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$OutputDir = (Join-Path (Split-Path -Parent $PSScriptRoot) 'dist/release')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $IsWindows) { throw 'Windows release packages must be built on Windows.' }
if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne [System.Runtime.InteropServices.Architecture]::X64) {
    throw 'Windows release packages must be built on x64.'
}

function Invoke-Checked {
    param([string]$FilePath, [string[]]$ArgumentList)
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) { throw "$FilePath failed with exit code $LASTEXITCODE." }
}

function Assert-SafeChildPath {
    param([string]$Parent, [string]$Child)
    $parentPath = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    $childPath = [System.IO.Path]::GetFullPath($Child)
    if (-not $childPath.StartsWith($parentPath, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to clean path outside $Parent`: $Child"
    }
}

function Write-Utf8NoBomLine {
    param([string]$Path, [string]$Content)
    [System.IO.File]::WriteAllText($Path, "$Content`n", [System.Text.UTF8Encoding]::new($false))
}

$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)
$TauriDir = Join-Path $RepoRoot 'apps/tauri'
$BundleRoot = Join-Path $RepoRoot 'target/release/bundle'
$NsisDir = Join-Path $BundleRoot 'nsis'
$MsiDir = Join-Path $BundleRoot 'msi'

Assert-SafeChildPath $RepoRoot $OutputDir
Assert-SafeChildPath $RepoRoot $NsisDir
Assert-SafeChildPath $RepoRoot $MsiDir

$versionInfo = & (Join-Path $RepoRoot 'scripts/Test-ReleaseVersion.ps1') -RepoRoot $RepoRoot -ExpectedTag "v$Version" -PassThru
if (-not $versionInfo) { throw 'Version consistency validation did not return a result.' }

foreach ($path in @($OutputDir, $NsisDir, $MsiDir)) {
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Recurse -Force }
}
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

Push-Location $TauriDir
try {
    Invoke-Checked corepack @('pnpm', 'install', '--frozen-lockfile')
    Invoke-Checked corepack @('pnpm', 'exec', 'tauri', 'build', '--bundles', 'nsis,msi')
}
finally { Pop-Location }

$unexpectedBundleEntries = @(
    Get-ChildItem -LiteralPath $BundleRoot -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notin @('nsis', 'msi') }
)
if ($unexpectedBundleEntries.Count -gt 0) {
    throw "Unexpected bundle output: $($unexpectedBundleEntries.Name -join ', ')"
}

$nsisMatches = @(Get-ChildItem -LiteralPath $NsisDir -File -Filter "Sendo_${Version}_x64-setup.exe")
$msiMatches = @(Get-ChildItem -LiteralPath $MsiDir -File -Filter "Sendo_${Version}_x64_en-US.msi")
if ($nsisMatches.Count -ne 1) { throw "Expected exactly one NSIS installer for $Version; found $($nsisMatches.Count)." }
if ($msiMatches.Count -ne 1) { throw "Expected exactly one MSI installer for $Version; found $($msiMatches.Count)." }

$expectedBundlePaths = @($nsisMatches[0].FullName, $msiMatches[0].FullName) | Sort-Object
$actualBundlePaths = @(Get-ChildItem -LiteralPath $BundleRoot -Recurse -File | Select-Object -ExpandProperty FullName | Sort-Object)
if (($expectedBundlePaths -join "`n") -ne ($actualBundlePaths -join "`n")) {
    throw "Unexpected files in bundle output: $($actualBundlePaths -join ', ')"
}

$installerNames = @(
    "Sendo_${Version}_x64-setup.exe",
    "Sendo_${Version}_x64_en-US.msi"
)
$sourceFiles = @($nsisMatches[0], $msiMatches[0])
$assets = @()
$checksumLines = @()

for ($index = 0; $index -lt $sourceFiles.Count; $index++) {
    $name = $installerNames[$index]
    $destination = Join-Path $OutputDir $name
    Copy-Item -LiteralPath $sourceFiles[$index].FullName -Destination $destination
    $hash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
    $line = "$hash  $name"
    Write-Utf8NoBomLine -Path "$destination.sha256" -Content $line
    $checksumLines += $line
    $file = Get-Item -LiteralPath $destination
    $assets += [ordered]@{ name = $name; size = $file.Length; sha256 = $hash }
}

Write-Utf8NoBomLine -Path (Join-Path $OutputDir 'sha256.sum') -Content ($checksumLines -join "`n")

$commit = (git -C $RepoRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $commit -notmatch '^[0-9a-f]{40}$') { throw 'Could not resolve the release commit.' }
$manifest = [ordered]@{
    schemaVersion = 1
    version = $Version
    tag = "v$Version"
    commit = $commit
    assets = $assets
}
$manifestJson = $manifest | ConvertTo-Json -Depth 5
Write-Utf8NoBomLine -Path (Join-Path $OutputDir 'release-manifest.json') -Content $manifestJson

$expectedNames = @(
    $installerNames[0],
    "$($installerNames[0]).sha256",
    $installerNames[1],
    "$($installerNames[1]).sha256",
    'sha256.sum',
    'release-manifest.json'
) | Sort-Object
$actualNames = @(Get-ChildItem -LiteralPath $OutputDir -File | Select-Object -ExpandProperty Name | Sort-Object)
if (($expectedNames -join "`n") -ne ($actualNames -join "`n")) {
    throw "Release staging inventory is invalid: $($actualNames -join ', ')"
}

Write-Host "Built and staged six release assets in $OutputDir" -ForegroundColor Green
