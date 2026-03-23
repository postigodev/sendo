$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tauriAppDir = Join-Path $repoRoot "apps\tauri"

Push-Location $tauriAppDir
try {
    pnpm tauri dev
}
finally {
    Pop-Location
}
