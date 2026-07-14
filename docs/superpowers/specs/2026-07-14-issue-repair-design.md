# Issue Repair Design

## Goal

Repair the bodies and labels of the eight open GitHub issues without changing
their numbers, URLs, discussion history, or state. Make the local PowerShell
generator safe to run repeatedly and incapable of creating issues during this
repair workflow.

## Root cause

The generator stores Markdown in double-quoted PowerShell here-strings. In that
context, Markdown backticks are PowerShell escape characters. Backticks before
letters become control characters and backticks at line endings can continue
the string into following issue definitions. The corrupted text was then sent
unchanged to GitHub.

## Chosen approach

Keep the existing issue definitions as the canonical source, but express every
body with a single-quoted here-string so Markdown remains literal. Pin the
repository to `postigodev/sendo` and pin each definition to its expected issue
number and exact title: #5, #6, #7, #8, #10, #11, #12, and #14.

The repair script never creates an issue. It supports preview mode by default
and requires `-Apply` before performing GitHub writes. All eight targets must
pass one global, write-free preflight before any label or issue mutation begins.
Future issue creation, if needed, must use a separate explicitly designed mode.

## Components and data flow

1. The static label and issue definitions are loaded locally. Duplicate local
   issue numbers or titles and unexpected control characters are rejected.
2. The script validates GitHub CLI authentication, verifies that every command
   is scoped with `--repo postigodev/sendo`, and confirms `nameWithOwner`.
3. The script fetches all pages of open and closed issues. Each target is looked
   up by number, then checked against its ordinal, case-sensitive, untrimmed
   expected title and required `OPEN` state. Matches are retained as collections
   rather than stored in PowerShell's case-insensitive dictionaries.
4. The script compares each current body and unordered label set with the local
   definition. Body comparison normalizes CRLF to LF and performs no trimming.
   Each target becomes `update` or `unchanged`; create is not an operation.
5. The global preflight aborts with zero writes on any authentication or repo
   failure, missing target, title/state mismatch, duplicate definition, control
   character, ambiguous identity, unexpected target count, or label-plan error.
6. Preview prints issue number, title, operation, and a safe body/label diff
   summary without dumping control characters. It performs zero writes.
7. Before apply, the script writes a recovery snapshot containing repository,
   timestamp, issue number, URL, title, state, complete body, label assignments,
   and relevant label metadata. It re-fetches all targets immediately before
   the first write and aborts if any state, body, or labels changed since the
   preflight snapshot.
8. Apply mode updates label catalog entries only when their desired metadata
   differs, then updates only issues classified as `update`. Issue label sets
   are authoritative and must exactly equal the definitions; unrelated labels
   on a target are removed, but unrelated repository label definitions are
   never deleted or modified.
9. The script tracks completed mutations. On failure it preserves the recovery
   snapshot and prints exact `gh` restore commands for every completed issue and
   label mutation; it does not continue to later targets.
10. A final full fetch verifies identities, states, complete normalized bodies,
    unordered label sets, and absence of unexpected issue creation.

## Error handling

- Stop before writes if any global preflight condition fails.
- Check every GitHub CLI exit code and identify the affected number and title.
- Use temporary body files and remove them in a `finally` block.
- Never reopen, close, delete, or recreate an existing issue as part of repair.
- Preserve the recovery snapshot on failure and report completed mutations plus
  exact restore commands.

## Validation

- Parse-check the PowerShell script.
- Run preview mode and confirm exactly eight pinned open targets resolve to
  `update` or `unchanged`, with zero writes.
- Run apply mode once and verify the remote bodies and labels against the local
  definitions.
- Run preview mode again and confirm all eight targets are `unchanged`, with
  zero creates and zero updates.
- Confirm the repository still has eight open issues and no open pull requests.
- Confirm issue numbers and URLs are unchanged, closed issues #9, #13, and #15
  are unchanged, and no unexpected issue was created.

## Out of scope

- Changing issue titles, priorities, assignees, milestones, or state.
- Editing closed issues #9, #13, or #15.
- Adding new roadmap items.
- Creating issues or providing a general-purpose issue creation mode.
