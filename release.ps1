param(
    [Parameter(Mandatory = $true)]
    [string]$Version,

    [string]$Notes,

    [switch]$GenerateNotes,

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Write-FileUtf8NoBom {
    param(
        [string]$Path,
        [string]$Content
    )

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Step {
    param(
        [scriptblock]$Action,
        [string]$Description
    )

    Write-Step $Description
    if ($DryRun) {
        Write-Host "[dry-run] skipped" -ForegroundColor Yellow
        return
    }

    & $Action
}

function Get-GitHubCliPath {
    $command = Get-Command gh -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $candidates = @(
        "C:\Program Files\GitHub CLI\gh.exe",
        (Join-Path $env:LOCALAPPDATA "Programs\GitHub CLI\gh.exe")
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    throw "GitHub CLI (gh) was not found in PATH or the usual Windows install locations."
}

function Set-JsonVersion {
    param(
        [string]$Path,
        [string]$NewVersion
    )

    $content = Get-Content -Raw $Path
    $updated = [regex]::Replace(
        $content,
        '(?m)("version"\s*:\s*")([^"]+)(")',
        ('$1' + $NewVersion + '$3'),
        1
    )

    if ($updated -eq $content) {
        throw "Could not update version in $Path"
    }

    Write-FileUtf8NoBom -Path $Path -Content $updated
}

function Set-CargoVersion {
    param(
        [string]$Path,
        [string]$NewVersion
    )

    $content = Get-Content -Raw $Path
    $updated = [regex]::Replace(
        $content,
        '(?ms)(^\[package\]\s.*?^version\s*=\s*")([^"]+)(")',
        ('$1' + $NewVersion + '$3')
    )

    if ($updated -eq $content) {
        throw "Could not update version in $Path"
    }

    Write-FileUtf8NoBom -Path $Path -Content $updated
}

function Find-Artifact {
    param(
        [string]$Directory,
        [string]$Pattern
    )

    $matches = Get-ChildItem -Path $Directory -Filter $Pattern -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending

    if (-not $matches) {
        throw "No artifact matched '$Pattern' in '$Directory'."
    }

    return $matches[0].FullName
}

$repoRoot = $PSScriptRoot
$tauriAppDir = Join-Path $repoRoot "apps\tauri"
$packageJsonPath = Join-Path $tauriAppDir "package.json"
$cargoTomlPath = Join-Path $tauriAppDir "src-tauri\Cargo.toml"
$tauriConfigPath = Join-Path $tauriAppDir "src-tauri\tauri.conf.json"
$bundleRoot = Join-Path $repoRoot "target\release\bundle"
$nsisDir = Join-Path $bundleRoot "nsis"
$msiDir = Join-Path $bundleRoot "msi"
$tag = "v$Version"
$ghPath = Get-GitHubCliPath

Write-Host "Release version: $Version" -ForegroundColor Green
Write-Host "GitHub CLI: $ghPath" -ForegroundColor DarkGray

Invoke-Step -Description "Sync version across package.json, Cargo.toml, and tauri.conf.json" -Action {
    Set-JsonVersion -Path $packageJsonPath -NewVersion $Version
    Set-CargoVersion -Path $cargoTomlPath -NewVersion $Version
    Set-JsonVersion -Path $tauriConfigPath -NewVersion $Version
}

Invoke-Step -Description "Build Sendo installers with Tauri" -Action {
    Push-Location $tauriAppDir
    try {
        cmd /c npm run tauri -- build
        if ($LASTEXITCODE -ne 0) {
            throw "Tauri build failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

Write-Step "Resolve release artifacts"
$nsisPattern = "Sendo_${Version}_*-setup.exe"
$msiPattern = "Sendo_${Version}_*.msi"
$nsisAsset = Find-Artifact -Directory $nsisDir -Pattern $nsisPattern
$msiAsset = Find-Artifact -Directory $msiDir -Pattern $msiPattern

Write-Host "NSIS: $nsisAsset" -ForegroundColor Green
Write-Host "MSI : $msiAsset" -ForegroundColor Green

Write-Step "Create GitHub release"
if ($DryRun) {
    Write-Host "[dry-run] gh release create $tag `"$nsisAsset`" `"$msiAsset`"" -ForegroundColor Yellow
}
else {
    $arguments = @(
        "release",
        "create",
        $tag,
        $nsisAsset,
        $msiAsset,
        "--title",
        $tag
    )

    if ($GenerateNotes -or [string]::IsNullOrWhiteSpace($Notes)) {
        $arguments += "--generate-notes"
    }
    else {
        $arguments += @("--notes", $Notes)
    }

    & $ghPath @arguments

    if ($LASTEXITCODE -ne 0) {
        throw "gh release create failed with exit code $LASTEXITCODE"
    }
}

Write-Host ""
Write-Host "Release flow completed." -ForegroundColor Green
