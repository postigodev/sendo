param(
    [Parameter(Mandatory = $true)][string]$Repository,
    [Parameter(Mandatory = $true)][string]$Tag,
    [Parameter(Mandatory = $true)][string]$CommitSha,
    [Parameter(Mandatory = $true)][string]$AssetDir,
    [Parameter(Mandatory = $true)][bool]$Prerelease
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-Gh {
    param([string[]]$ArgumentList)
    & gh @ArgumentList
    if ($LASTEXITCODE -ne 0) { throw "gh failed with exit code ${LASTEXITCODE}: $($ArgumentList -join ' ')" }
}

function Get-ExpectedNames {
    param([string]$Version)
    $exe = "Sendo_${Version}_x64-setup.exe"
    $msi = "Sendo_${Version}_x64_en-US.msi"
    return @($exe, "$exe.sha256", $msi, "$msi.sha256", 'sha256.sum', 'release-manifest.json')
}

function Assert-ReleaseDirectory {
    param([string]$Directory, [string]$ExpectedTag, [string]$ExpectedCommit)

    $manifestPath = Join-Path $Directory 'release-manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "Missing release manifest in $Directory" }
    $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
    if ($manifest.schemaVersion -ne 1) { throw 'Unsupported release manifest schema.' }
    if ($manifest.tag -cne $ExpectedTag) { throw "Manifest tag $($manifest.tag) does not match $ExpectedTag." }
    if ($manifest.commit -cne $ExpectedCommit) { throw "Manifest commit $($manifest.commit) does not match $ExpectedCommit." }
    if ($ExpectedTag -cne "v$($manifest.version)") { throw 'Manifest version and tag disagree.' }

    $expectedNames = @(Get-ExpectedNames $manifest.version | Sort-Object)
    $actualNames = @(Get-ChildItem -LiteralPath $Directory -File | Select-Object -ExpandProperty Name | Sort-Object)
    if (($expectedNames -join "`n") -cne ($actualNames -join "`n")) {
        throw "Release asset inventory is invalid. Expected [$($expectedNames -join ', ')], found [$($actualNames -join ', ')]."
    }

    $manifestAssets = @($manifest.assets)
    if ($manifestAssets.Count -ne 2) { throw 'Manifest must describe exactly two installers.' }
    $checksumLines = @()
    foreach ($asset in $manifestAssets) {
        if ($asset.name -notin $expectedNames -or $asset.name -notmatch '\.(exe|msi)$') {
            throw "Manifest contains an invalid installer name: $($asset.name)"
        }
        $path = Join-Path $Directory $asset.name
        $file = Get-Item -LiteralPath $path
        $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
        if ([int64]$asset.size -ne $file.Length) { throw "Size mismatch for $($asset.name)." }
        if ([string]$asset.sha256 -cne $hash) { throw "SHA-256 mismatch for $($asset.name)." }
        $line = "$hash  $($asset.name)"
        $sidecar = (Get-Content -Raw -LiteralPath "$path.sha256").TrimEnd("`r", "`n")
        if ($sidecar -cne $line) { throw "Invalid checksum sidecar for $($asset.name)." }
        $checksumLines += $line
    }
    $sum = (Get-Content -Raw -LiteralPath (Join-Path $Directory 'sha256.sum')).TrimEnd("`r", "`n")
    if ($sum -cne ($checksumLines -join "`n")) { throw 'sha256.sum does not match the manifest.' }
    return $manifest
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI (gh) is required.' }
if ($Tag -notmatch '^v.+') { throw "Invalid release tag: $Tag" }
if ($CommitSha -notmatch '^[0-9a-f]{40}$') { throw "Invalid commit SHA: $CommitSha" }
$AssetDir = [System.IO.Path]::GetFullPath($AssetDir)
$manifest = Assert-ReleaseDirectory $AssetDir $Tag $CommitSha

$remoteCommit = (& gh api "repos/$Repository/commits/$Tag" --jq '.sha').Trim()
if ($LASTEXITCODE -ne 0 -or $remoteCommit -cne $CommitSha) {
    throw "Remote tag $Tag resolves to '$remoteCommit', not '$CommitSha'."
}

$releaseJson = & gh release view $Tag --repo $Repository --json 'assets,isDraft,isPrerelease,tagName,targetCommitish,url' 2>$null
$releaseExists = $LASTEXITCODE -eq 0
$expectedNames = @(Get-ExpectedNames $manifest.version)

if ($releaseExists) {
    $release = $releaseJson | ConvertFrom-Json
    if ($release.tagName -cne $Tag) { throw "Draft release tag $($release.tagName) does not match $Tag." }
    if (-not $release.isDraft) { throw "Release $Tag is already public; refusing to mutate it." }
    if ([bool]$release.isPrerelease -ne $Prerelease) { throw "Draft $Tag has the wrong prerelease state." }
    $unknown = @($release.assets | Where-Object { $_.name -notin $expectedNames } | ForEach-Object name)
    if ($unknown.Count -gt 0) { throw "Draft $Tag contains unknown assets: $($unknown -join ', ')" }
    Write-Host "Resuming compatible draft release $Tag."
}
else {
    $createArgs = @('release', 'create', $Tag, '--repo', $Repository, '--draft', '--verify-tag', '--target', $CommitSha, '--title', $Tag, '--generate-notes')
    if ($Prerelease) { $createArgs += '--prerelease' }
    Invoke-Gh $createArgs
}

$paths = @($expectedNames | ForEach-Object { Join-Path $AssetDir $_ })
Invoke-Gh (@('release', 'upload', $Tag, '--repo', $Repository, '--clobber') + $paths)

$verificationDir = Join-Path ([System.IO.Path]::GetTempPath()) ("sendo-release-verify-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $verificationDir | Out-Null
try {
    Invoke-Gh @('release', 'download', $Tag, '--repo', $Repository, '--pattern', '*', '--dir', $verificationDir)
    $null = Assert-ReleaseDirectory $verificationDir $Tag $CommitSha
}
finally {
    if (Test-Path -LiteralPath $verificationDir) { Remove-Item -LiteralPath $verificationDir -Recurse -Force }
}

$prereleaseValue = $Prerelease.ToString().ToLowerInvariant()
Invoke-Gh @('release', 'edit', $Tag, '--repo', $Repository, '--draft=false', "--prerelease=$prereleaseValue", '--verify-tag')
Write-Host "Published verified release $Tag." -ForegroundColor Green
