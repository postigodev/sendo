Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$workflow = Get-Content -Raw (Join-Path $PSScriptRoot '../.github/workflows/release.yml')
if ($workflow -notmatch '(?m)^  pull_request:\s*$' -or
    $workflow -notmatch '(?m)^  push:\s*\r?\n    branches:\s*\r?\n      - main\s*\r?\n    tags:\s*\r?\n      - "v\*"') {
    throw 'Validation must run for pull requests, main pushes, and version tags.'
}

$tagGuard = "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')"
foreach ($job in @('build-windows', 'publish')) {
    if (-not $workflow.Contains("  ${job}:`n") -and -not $workflow.Contains("  ${job}:`r`n")) {
        throw "Missing release job: $job"
    }
    if ($workflow -notmatch ("(?m)^  " + $job + ":\s*\r?\n    name:[^\r\n]*\r?\n    if: " + [regex]::Escape($tagGuard) + '\s*$')) {
        throw "$job must be restricted to version tag pushes."
    }
}
if (-not $workflow.Contains("EXPECTED_TAG: " + '${{ ' + $tagGuard + " && github.ref_name || '' }}")) {
    throw 'Ordinary main pushes must not be interpreted as release tags.'
}
foreach ($job in @('plan', 'validate')) {
    $block = [regex]::Match($workflow, "(?ms)^  ${job}:.*?(?=^  [a-z-]+:|\z)").Value
    if (-not $block -or $block -match '(?m)^    if:') {
        throw "$job must run for every triggered validation event."
    }
}
if (-not $workflow.Contains('cargo test --workspace --locked -- --test-threads=1')) {
    throw 'Environment-mutating persistence tests must run serially.'
}
./scripts/Test-ReleaseVersion.ps1 -ExpectedTag ''
Write-Host 'Validation workflow regression checks passed.'
