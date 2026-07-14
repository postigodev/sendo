param(
  [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repo = "postigodev/sendo"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$ghCommand = Get-Command gh -ErrorAction SilentlyContinue
if ($null -eq $ghCommand) {
  throw "GitHub CLI (gh) is required."
}
$ghPath = $ghCommand.Source

$labels = @(
  @{ Name = "good first issue"; Color = "7057ff"; Description = "Well-scoped task suitable for first-time contributors" },
  @{ Name = "help wanted"; Color = "008672"; Description = "Maintainer would welcome contribution here" },
  @{ Name = "bug"; Color = "d73a4a"; Description = "Something is broken or incorrect" },
  @{ Name = "enhancement"; Color = "a2eeef"; Description = "New capability or workflow improvement" },
  @{ Name = "refactor"; Color = "cfd3d7"; Description = "Internal cleanup or modularization work" },
  @{ Name = "frontend"; Color = "1d76db"; Description = "TypeScript frontend work" },
  @{ Name = "backend"; Color = "5319e7"; Description = "Rust or native backend work" },
  @{ Name = "spotify"; Color = "1db954"; Description = "Spotify auth, routing, or playback logic" },
  @{ Name = "firetv"; Color = "fbca04"; Description = "Fire TV, ADB, or device communication" },
  @{ Name = "performance"; Color = "f9d0c4"; Description = "Performance, bundle size, or responsiveness" },
  @{ Name = "desktop"; Color = "bfdadc"; Description = "Desktop shell, tray, startup, or packaging work" },
  @{ Name = "devops"; Color = "0e8a16"; Description = "Release, automation, or build pipeline work" },
  @{ Name = "test"; Color = "e4e669"; Description = "Test coverage or validation work" }
)

$issues = @(
  @{
    Number = 5
    Title = "Split apps/tauri/src/main.ts into smaller controller modules"
    Labels = @("good first issue", "refactor", "frontend")
    Body = @'
## Summary

`apps/tauri/src/main.ts` still owns too much wiring: event binding, async actions, polling, drag-and-drop, and page-specific orchestration.

## Why this matters

The file is workable, but it raises the entry cost for contributors and makes small behavior changes harder to reason about.

## Expected outcome

Split the file into smaller modules by concern, for example:

- Spotify actions/polling
- Fire TV actions
- Bindings/hotkeys
- Layout/sidebar/render helpers

## Constraints

- Preserve current behavior
- Prefer small, readable modules over introducing a large abstraction layer
- Keep the app biased toward explicit control flow

## Likely files

- `apps/tauri/src/main.ts`
- `apps/tauri/src/features/*`
- `apps/tauri/src/pages/*`
- new controller/helper modules under `apps/tauri/src`
'@
  },
  @{
    Number = 6
    Title = "Normalize version display across desktop surfaces"
    Labels = @("good first issue", "bug", "frontend")
    Body = @'
## Summary

The desktop app should display the runtime app version consistently across sidebar, topbar, and any other version badges.

## Current behavior

This area recently had a mismatch between UI-displayed version values and the actual Tauri bundle version.

## Expected outcome

Verify all desktop surfaces use the same runtime version source and stay aligned after future releases.

## Scope

- confirm sidebar and topbar stay in sync
- confirm release/version automation does not regress the display
- tighten any remaining version-source inconsistencies

## Likely files

- `apps/tauri/src/main.ts`
- `apps/tauri/src/ui/*`
- `apps/tauri/src-tauri/src/commands.rs`
'@
  },
  @{
    Number = 7
    Title = "Improve Fire TV app metadata beyond package-name inference"
    Labels = @("help wanted", "enhancement", "firetv")
    Body = @'
## Summary

Fire TV app scanning works, but display metadata still has room to improve.

## Current behavior

Some apps rely on inferred or raw package-name-based display values, which makes the launcher surface less readable than it could be.

## Expected outcome

Improve app presentation by exploring better display-name resolution, grouping, or cache enrichment without adding too much complexity.

## Constraints

- keep the launcher fast
- preserve current app scan flow
- avoid turning this into a large metadata service

## Likely files

- `crates/core/src/firetv/*`
- `apps/tauri/src/pages/apps*`
'@
  },
  @{
    Number = 8
    Title = "Make release automation validate existing tags and releases before publish"
    Labels = @("help wanted", "bug", "devops")
    Body = @'
## Summary

The current PowerShell release flow already automates version sync, Tauri build, and GitHub release creation, but it should be more defensive around tag/release state.

## Why this matters

We already hit a case where a local tag conflicted with GitHub release creation.

## Expected outcome

Before publish, the script should validate things like:

- target tag already exists locally
- target tag already exists remotely
- release already exists on GitHub
- repo has uncommitted changes that would make the release inconsistent

## Likely files

- `release.ps1`
'@
  },
  @{
    Number = 10
    Title = "Modularize Spotify page controller logic"
    Labels = @("help wanted", "refactor", "spotify", "frontend")
    Body = @'
## Summary

Spotify logic is one of the richest parts of the app: auth flow, polling, playback actions, target-device selection, and session rendering.

## Why this matters

This code works, but it is still concentrated enough that it raises the cost of changing one area without understanding all of them.

## Expected outcome

Split Spotify page/controller logic into smaller pieces while preserving:

- active-view-only polling
- no duplicate intervals
- no stale target-device behavior
- current UI behavior

## Likely files

- `apps/tauri/src/main.ts`
- `apps/tauri/src/pages/spotify.ts`
- `apps/tauri/src/features/*`
'@
  },
  @{
    Number = 11
    Title = "Reduce desktop frontend bundle size and split large chunk"
    Labels = @("help wanted", "performance", "frontend")
    Body = @'
## Summary

The desktop frontend currently emits a large minified chunk during production build.

## Current signal

Vite warns that the main chunk is larger than the recommended size threshold.

## Expected outcome

Investigate safe ways to reduce bundle size and/or improve chunk splitting.

## Good directions

- identify oversized dependencies
- split code by page or feature where it actually helps
- avoid changes that make the app architecture less clear

## Likely files

- `apps/tauri/vite.config.*`
- `apps/tauri/src/*`
- package dependency graph
'@
  },
  @{
    Number = 12
    Title = "Fix Windows toast notifications for tray and background events"
    Labels = @("bug", "desktop")
    Body = @'
## Summary

Windows toast notifications do not currently behave reliably for tray/background events.

## Current behavior

The app has notification plumbing, but in real use the toasts do not consistently appear when expected.

## Expected outcome

Investigate and fix desktop notification behavior for cases like:

- tray action failure
- background action failure
- startup/tray lifecycle-related notifications if applicable

## Notes

This is a real product bug, not just polish. A user should not need to open the app window just to discover that an action failed.

## Likely files

- `apps/tauri/src-tauri/src/lib.rs`
- tray / notification setup
- any Windows-specific notification assumptions
'@
  },
  @{
    Number = 14
    Title = "Add stronger tests for Spotify target-device selection"
    Labels = @("help wanted", "spotify", "backend", "test")
    Body = @'
## Summary

Explicit target-device selection is one of the most important reliability features in Sendo, especially for multi-device setups.

## Cases worth covering

- multiple devices on the same account
- ambiguous name matching
- selected device persistence
- selected device no longer available
- playback currently active elsewhere

## Expected outcome

Protect current target-selection behavior and reduce regressions around playback routing.

## Likely files

- `crates/core/src/spotify/*`
- associated tests
'@
  }
)

function Invoke-GhJson {
  param([Parameter(Mandatory)][string[]]$Arguments)

  $output = & $ghPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "gh failed: gh $($Arguments -join ' ')"
  }
  if ([string]::IsNullOrWhiteSpace(($output -join "`n"))) {
    return $null
  }
  return (($output -join "`n") | ConvertFrom-Json)
}

function Invoke-Gh {
  param([Parameter(Mandatory)][string[]]$Arguments)

  & $ghPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "gh failed: gh $($Arguments -join ' ')"
  }
}

function Normalize-Body {
  param([AllowEmptyString()][string]$Body)
  return $Body.Replace("`r`n", "`n")
}

function Get-LabelNames {
  param($Issue)
  return @($Issue.labels | ForEach-Object { [string]$_.name })
}

function Test-StringSetEqual {
  param([string[]]$Left, [string[]]$Right)

  $leftCopy = @($Left)
  $rightCopy = @($Right)
  [Array]::Sort($leftCopy, [StringComparer]::Ordinal)
  [Array]::Sort($rightCopy, [StringComparer]::Ordinal)
  if ($leftCopy.Count -ne $rightCopy.Count) { return $false }
  for ($index = 0; $index -lt $leftCopy.Count; $index++) {
    if (-not [string]::Equals($leftCopy[$index], $rightCopy[$index], [StringComparison]::Ordinal)) {
      return $false
    }
  }
  return $true
}

function Assert-NoControlCharacters {
  param([string]$Value, [string]$Context)
  if ([regex]::IsMatch($Value, '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')) {
    throw "Unexpected control character in $Context."
  }
}

function Get-AllIssues {
  return @(Invoke-GhJson @("issue", "list", "--repo", $repo, "--state", "all", "--limit", "1000", "--json", "number,title,state,url,body,labels"))
}

function Get-AllLabels {
  return @(Invoke-GhJson @("label", "list", "--repo", $repo, "--limit", "1000", "--json", "name,color,description"))
}

function Get-IssueByNumber {
  param([object[]]$AllIssues, [int]$Number)
  $matches = @($AllIssues | Where-Object { [int]$_.number -eq $Number })
  if ($matches.Count -ne 1) {
    throw "Expected exactly one issue #$Number; found $($matches.Count)."
  }
  return $matches[0]
}

function Assert-IssueSnapshotEqual {
  param($Expected, $Actual, [string]$Context)

  if (-not [string]::Equals([string]$Expected.title, [string]$Actual.title, [StringComparison]::Ordinal) -or
      -not [string]::Equals([string]$Expected.state, [string]$Actual.state, [StringComparison]::Ordinal) -or
      -not [string]::Equals((Normalize-Body ([string]$Expected.body)), (Normalize-Body ([string]$Actual.body)), [StringComparison]::Ordinal) -or
      -not (Test-StringSetEqual (Get-LabelNames $Expected) (Get-LabelNames $Actual))) {
    throw "$Context changed after preflight. Aborting before writes."
  }
}

function ConvertTo-SingleQuotedPowerShell {
  param([string]$Value)
  return "'" + $Value.Replace("'", "''") + "'"
}

function Write-RecoveryScript {
  param(
    [string]$SnapshotDir,
    [object[]]$CompletedIssues,
    [object[]]$CompletedLabels
  )

  $restorePath = Join-Path $SnapshotDir "restore.ps1"
  $lines = [System.Collections.Generic.List[string]]::new()
  $lines.Add('$ErrorActionPreference = "Stop"')
  $lines.Add('$repo = "postigodev/sendo"')

  foreach ($labelChange in $CompletedLabels) {
    if ($null -eq $labelChange.Current) {
      $lines.Add("gh label delete $(ConvertTo-SingleQuotedPowerShell $labelChange.Desired.Name) --repo `$repo --yes")
    } else {
      $lines.Add("gh label create $(ConvertTo-SingleQuotedPowerShell $labelChange.Current.name) --repo `$repo --color $(ConvertTo-SingleQuotedPowerShell $labelChange.Current.color) --description $(ConvertTo-SingleQuotedPowerShell ([string]$labelChange.Current.description)) --force")
    }
  }

  foreach ($planItem in $CompletedIssues) {
    $bodyPath = Join-Path $SnapshotDir "issue-$($planItem.Number)-before.md"
    $args = [System.Collections.Generic.List[string]]::new()
    $args.Add("gh issue edit $($planItem.Number) --repo `$repo --body-file $(ConvertTo-SingleQuotedPowerShell $bodyPath)")
    $allKnownLabels = @($planItem.CurrentLabels + $planItem.DesiredLabels | Sort-Object -Unique)
    foreach ($label in $allKnownLabels) {
      $args.Add(" --remove-label $(ConvertTo-SingleQuotedPowerShell $label)")
    }
    foreach ($label in $planItem.CurrentLabels) {
      $args.Add(" --add-label $(ConvertTo-SingleQuotedPowerShell $label)")
    }
    $lines.Add(($args -join ""))
  }

  [System.IO.File]::WriteAllLines($restorePath, $lines)
  return $restorePath
}

# Global, write-free preflight.
Invoke-Gh @("auth", "status", "--hostname", "github.com")
$repoInfo = Invoke-GhJson @("repo", "view", $repo, "--json", "nameWithOwner")
if (-not [string]::Equals([string]$repoInfo.nameWithOwner, $repo, [StringComparison]::Ordinal)) {
  throw "Repository mismatch: expected $repo, got $($repoInfo.nameWithOwner)."
}

if ($issues.Count -ne 8) {
  throw "Expected exactly eight issue definitions; found $($issues.Count)."
}

for ($left = 0; $left -lt $issues.Count; $left++) {
  Assert-NoControlCharacters ([string]$issues[$left].Title) "issue #$($issues[$left].Number) title"
  Assert-NoControlCharacters ([string]$issues[$left].Body) "issue #$($issues[$left].Number) body"
  for ($right = $left + 1; $right -lt $issues.Count; $right++) {
    if ($issues[$left].Number -eq $issues[$right].Number) {
      throw "Duplicate issue number: $($issues[$left].Number)."
    }
    if ([string]::Equals([string]$issues[$left].Title, [string]$issues[$right].Title, [StringComparison]::Ordinal)) {
      throw "Duplicate issue title: $($issues[$left].Title)."
    }
  }
}

$allIssues = Get-AllIssues
$allLabels = Get-AllLabels
$initialIssueNumbers = @($allIssues | ForEach-Object { [int]$_.number })
$protectedClosed = @(9, 13, 15 | ForEach-Object { Get-IssueByNumber $allIssues $_ })
$plan = [System.Collections.Generic.List[object]]::new()

foreach ($definition in $issues) {
  $current = Get-IssueByNumber $allIssues $definition.Number
  if (-not [string]::Equals([string]$current.title, [string]$definition.Title, [StringComparison]::Ordinal)) {
    throw "Title mismatch for issue #$($definition.Number)."
  }
  if (-not [string]::Equals([string]$current.state, "OPEN", [StringComparison]::Ordinal)) {
    throw "Issue #$($definition.Number) is not open."
  }

  $currentLabels = @(Get-LabelNames $current)
  $desiredLabels = @($definition.Labels | ForEach-Object { [string]$_ })
  $bodyChanged = -not [string]::Equals(
    (Normalize-Body ([string]$current.body)),
    (Normalize-Body ([string]$definition.Body)),
    [StringComparison]::Ordinal
  )
  $labelsChanged = -not (Test-StringSetEqual $currentLabels $desiredLabels)
  $operation = if ($bodyChanged -or $labelsChanged) { "update" } else { "unchanged" }

  $plan.Add([pscustomobject]@{
    Number = [int]$definition.Number
    Title = [string]$definition.Title
    Url = [string]$current.url
    Operation = $operation
    BodyChanged = $bodyChanged
    LabelsChanged = $labelsChanged
    CurrentBody = [string]$current.body
    DesiredBody = [string]$definition.Body
    CurrentLabels = $currentLabels
    DesiredLabels = $desiredLabels
    Baseline = $current
  })
}

$labelPlan = [System.Collections.Generic.List[object]]::new()
foreach ($definition in $labels) {
  Assert-NoControlCharacters ([string]$definition.Name) "label name"
  $matches = @($allLabels | Where-Object {
    [string]::Equals([string]$_.name, [string]$definition.Name, [StringComparison]::Ordinal)
  })
  if ($matches.Count -gt 1) {
    throw "Multiple label definitions found for '$($definition.Name)'."
  }
  $current = if ($matches.Count -eq 1) { $matches[0] } else { $null }
  $changed = $null -eq $current -or
    -not [string]::Equals([string]$current.color, [string]$definition.Color, [StringComparison]::OrdinalIgnoreCase) -or
    -not [string]::Equals([string]$current.description, [string]$definition.Description, [StringComparison]::Ordinal)
  $labelPlan.Add([pscustomobject]@{ Current = $current; Desired = $definition; Changed = $changed })
}

Write-Host "Repository: $repo"
Write-Host "Mode: $(if ($Apply) { 'APPLY' } else { 'PREVIEW (zero writes)' })"
foreach ($item in $plan) {
  Write-Host ("#{0} {1}: {2} (body={3}, labels={4})" -f $item.Number, $item.Title, $item.Operation, $item.BodyChanged, $item.LabelsChanged)
}
$changedLabels = @($labelPlan | Where-Object { $_.Changed })
Write-Host "Label metadata changes: $($changedLabels.Count)"

if (-not $Apply) {
  Write-Host "Preview complete. Re-run with -Apply to perform the planned updates."
  exit 0
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$snapshotDir = Join-Path ([System.IO.Path]::GetTempPath()) "sendo-issue-repair-$timestamp"
New-Item -ItemType Directory -Path $snapshotDir | Out-Null

$snapshot = [pscustomobject]@{
  Repository = $repo
  CreatedAt = (Get-Date).ToString("o")
  Issues = @($plan | ForEach-Object {
    [pscustomobject]@{
      Number = $_.Number
      Url = $_.Url
      Title = $_.Title
      State = [string]$_.Baseline.state
      Body = $_.CurrentBody
      Labels = $_.CurrentLabels
    }
  })
  Labels = @($labelPlan | ForEach-Object { $_.Current })
}
$snapshot | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $snapshotDir "snapshot.json") -Encoding utf8
foreach ($item in $plan) {
  [System.IO.File]::WriteAllText((Join-Path $snapshotDir "issue-$($item.Number)-before.md"), $item.CurrentBody)
  [System.IO.File]::WriteAllText((Join-Path $snapshotDir "issue-$($item.Number)-desired.md"), $item.DesiredBody)
}

# Optimistic concurrency check immediately before the first write.
$freshIssues = Get-AllIssues
foreach ($item in $plan) {
  Assert-IssueSnapshotEqual $item.Baseline (Get-IssueByNumber $freshIssues $item.Number) "Issue #$($item.Number)"
}

$completedIssues = [System.Collections.Generic.List[object]]::new()
$completedLabels = [System.Collections.Generic.List[object]]::new()
try {
  foreach ($labelChange in $changedLabels) {
    $completedLabels.Add($labelChange)
    Invoke-Gh @(
      "label", "create", [string]$labelChange.Desired.Name,
      "--repo", $repo,
      "--color", [string]$labelChange.Desired.Color,
      "--description", [string]$labelChange.Desired.Description,
      "--force"
    )
  }

  foreach ($item in @($plan | Where-Object { $_.Operation -eq "update" })) {
    $completedIssues.Add($item)
    $arguments = [System.Collections.Generic.List[string]]::new()
    foreach ($argument in @("issue", "edit", [string]$item.Number, "--repo", $repo, "--body-file", (Join-Path $snapshotDir "issue-$($item.Number)-desired.md"))) {
      $arguments.Add($argument)
    }
    if ($item.LabelsChanged) {
      foreach ($label in @($item.CurrentLabels | Where-Object { $item.DesiredLabels -cnotcontains $_ })) {
        $arguments.Add("--remove-label")
        $arguments.Add($label)
      }
      foreach ($label in @($item.DesiredLabels | Where-Object { $item.CurrentLabels -cnotcontains $_ })) {
        $arguments.Add("--add-label")
        $arguments.Add($label)
      }
    }
    Invoke-Gh $arguments.ToArray()
  }
} catch {
  $restorePath = Write-RecoveryScript $snapshotDir $completedIssues.ToArray() $completedLabels.ToArray()
  Write-Error "Repair stopped after a write failure. Snapshot: $snapshotDir"
  Write-Error "Restore completed mutations with: powershell -File `"$restorePath`""
  throw
}

$verifiedIssues = Get-AllIssues
if ($verifiedIssues.Count -ne $allIssues.Count -or
    -not (Test-StringSetEqual @($initialIssueNumbers | ForEach-Object { [string]$_ }) @($verifiedIssues | ForEach-Object { [string]$_.number }))) {
  throw "Issue inventory changed unexpectedly during repair. Snapshot: $snapshotDir"
}

foreach ($definition in $issues) {
  $actual = Get-IssueByNumber $verifiedIssues $definition.Number
  if (-not [string]::Equals([string]$actual.title, [string]$definition.Title, [StringComparison]::Ordinal) -or
      -not [string]::Equals([string]$actual.state, "OPEN", [StringComparison]::Ordinal) -or
      -not [string]::Equals((Normalize-Body ([string]$actual.body)), (Normalize-Body ([string]$definition.Body)), [StringComparison]::Ordinal) -or
      -not (Test-StringSetEqual (Get-LabelNames $actual) @($definition.Labels))) {
    throw "Verification failed for issue #$($definition.Number). Snapshot: $snapshotDir"
  }
}

foreach ($closedBaseline in $protectedClosed) {
  Assert-IssueSnapshotEqual $closedBaseline (Get-IssueByNumber $verifiedIssues ([int]$closedBaseline.number)) "Closed issue #$($closedBaseline.number)"
}

$openIssues = @($verifiedIssues | Where-Object { $_.state -eq "OPEN" })
$openPrs = @(Invoke-GhJson @("pr", "list", "--repo", $repo, "--state", "open", "--limit", "1000", "--json", "number,title"))
if ($openIssues.Count -ne 8 -or $openPrs.Count -ne 0) {
  throw "Final repository counts are unexpected: open issues=$($openIssues.Count), open PRs=$($openPrs.Count)."
}

Write-Host "Repair verified successfully. Snapshot retained at: $snapshotDir"
