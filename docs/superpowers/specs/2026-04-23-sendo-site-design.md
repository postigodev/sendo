# Sendo Site Design

Date: 2026-04-23
Status: Draft for review

## Goal

Add a product site to the existing Sendo repository as a small companion app focused on distribution, onboarding, and portfolio-quality product presentation.

The site should not behave like a startup landing page. It should feel like a polished desktop-tool release page that happens to have strong product storytelling.

## Why This Exists

Sendo already has a strong desktop product and a strong README, but it lacks a dedicated install surface.

The website should solve three problems at once:

1. Give new users a clean place to understand and install Sendo.
2. Give recruiters and engineers a clearer product narrative than a README alone.
3. Keep release, branding, screenshots, and install guidance in the same repository as the actual app.

## Product Positioning

Sendo should be presented as:

- a local-first desktop utility
- a control layer for TV workflows, media routing, and reusable shortcuts
- a real distributed-device orchestration product, not just a remote wrapper

The website should communicate that Sendo is wider than Spotify alone. Spotify is one important capability, but the product identity is broader: TV control, explicit device targeting, reusable actions, and desktop-native workflows.

## Site Type

Recommended structure:

- `Home` for product story + screenshot + technical credibility
- `Install` for download, requirements, setup, and troubleshooting

This is intentionally a hybrid:

- product site enough to feel premium and portfolio-ready
- install/docs enough to feel practical and real

It should not grow into a large documentation site yet.

## Repository Placement

The site should live in the same repo as the desktop app.

Recommended top-level structure:

```text
apps/
  tauri/
  site/
crates/
assets/
docs/
```

Reasons:

- keeps branding, screenshots, and release artifacts close to the product
- avoids version drift between app and site
- improves the portfolio narrative by showing one product repository rather than fragmented repos
- makes Vercel deployment straightforward without separating the product story from the codebase

## Technical Stack

Recommended stack:

- `Next.js` App Router
- `TypeScript`
- `Tailwind CSS`
- `shadcn/ui` primitives only
- `lucide-react`
- `Geist` typography
- Vercel deployment

## Stack Rationale

### Why Next.js

Next.js is the best fit for this site because it gives:

- strong Vercel alignment
- static-first deployment
- good metadata and SEO defaults
- clean routing for `Home` and `Install`
- low operational overhead

Vite would work, but Next is a better match for a product/download site that should feel deploy-ready and production-grade from day one.

### Why Tailwind + shadcn/ui

Tailwind keeps the implementation fast and precise.

`shadcn/ui` should only supply low-level primitives. The page should not be assembled from generic marketing blocks. The layout and sections need to feel custom to Sendo.

### Why lucide-react

Lucide is already compatible with the design language of the existing desktop app. It is a better fit than Material icons for a restrained tool-oriented product site.

### Why not Material UI

Material UI would push the site toward a more generic web-product look and adds weight that this project does not need.

## Design Direction

### Intent

The site should feel:

- technical
- dark
- premium
- local-first
- operational

It should feel closer to a polished developer tool or desktop utility release page than to a startup landing page.

### Visual World

Base:

- near-black background
- graphite surfaces
- low-contrast borders

Accent system:

- cyan/teal derived from the Sendo logo
- stronger accent intensity in the hero
- more restrained usage in the rest of the site

### Signature

The hero should combine:

- screenshot-led presentation
- abstract ambient glow inspired by the Sendo logo
- sharp technical typography
- compact but premium CTAs

This gives Sendo a recognizable brand moment without turning the whole site into a flashy marketing page.

### Typography

Typography should be clean and technical rather than editorial.

Recommended:

- `Geist Sans` for UI and body copy
- optional `Geist Mono` or equivalent only for very small metadata or labels

### Depth and Surfaces

Depth should be subtle:

- translucent sticky navbar on scroll
- low-contrast borders
- minimal shadow system
- screenshot frame with slightly stronger elevation than surrounding content

The screenshot should be the most visually credible object on the page.

## Navbar

Navbar behavior:

- sticky
- transparent at the top of the page
- transitions into a dark translucent blurred surface on scroll

Content:

- left: Sendo mark + Sendo wordmark
- right: `How it works`, `Install`, `GitHub`

The navbar should stay compact and quiet.

## Hero Content

Approved hero copy:

Eyebrow:

`Local-first desktop utility`

Headline:

`Control your TV from one desktop workflow with shortcuts, media actions, and explicit device targeting.`

Subhead:

`Sendo is a Windows desktop utility for Fire TV control, Spotify routing, reusable shortcuts, and local execution flows.`

Primary CTA:

`Download for Windows`

Secondary CTA:

`View on GitHub`

Support pills:

- `Windows`
- `Fire TV`
- `Spotify Connect`
- `Local-first`

## Homepage Information Architecture

### Section 1: Hero

Layout:

- two columns on desktop
- stacked on mobile

Left column:

- eyebrow
- headline
- subhead
- CTA row
- small capability pills

Right column:

- large screenshot inside a premium app frame

The screenshot is the main proof element.

### Section 2: Core Principles

Three compact blocks:

- `Local-first`
- `Explicit device targeting`
- `Reusable control flows`

Each block should include:

- small icon
- short title
- one sentence only

This section should be tight and not look like giant SaaS feature cards.

### Section 3: Main Flow

This section should visualize the compressed workflow:

- `Wake the TV`
- `Launch apps`
- `Route playback`
- `Reuse with shortcuts`

Supporting line:

`Sendo turns repeated TV and media actions into one explicit desktop workflow.`

The treatment should feel operational, like a process, not like marketing.

### Section 4: How It Works

Split section:

- left side: compact architecture copy
- right side: system diagram

Suggested heading:

`Built as a local orchestration layer`

The diagram should show:

- `Desktop UI`
- `Tauri shell`
- `Rust core`
- `Spotify API`
- `Fire TV ADB`

This is the section that gives recruiters and engineers strong architectural signal.

### Section 5: Why It Exists

Narrower, calmer text section.

It should explain:

- fragmented surfaces across phone, desktop, TV, and Spotify device routing
- mismatch between playback state and device state
- the need for explicit, local, reusable control flows

Keep this section short. It should feel thoughtful, not essay-like.

### Section 6: Feature Grid

Dense capability inventory:

- Fire TV control over ADB
- Spotify Connect routing
- Persistent shortcuts
- Global hotkeys
- Tray actions
- Startup to tray
- Readiness checks
- Quick access actions

Each feature should be concise.

### Section 7: Final Install CTA

Large but restrained footer CTA:

Headline:

`Install Sendo`

Supporting line:

`Built for Windows. Ready for local control, reusable shortcuts, and explicit device workflows.`

Action:

`Download latest release`

### Section 8: Footer

Author-signature direction:

- `Built by Piero Postigo Rocchetti`
- links: `GitHub`, `Portfolio`, `LinkedIn`
- secondary line: `Copyright 2026`

Email should not appear in the global footer for now.

## Install Page Information Architecture

### Section 1: Install Hero

- title
- one-line explanation
- primary download CTA

### Section 2: Requirements

Compact checklist:

- Windows
- `adb` in `PATH`
- Fire TV with ADB debugging enabled
- Spotify developer credentials if needed

### Section 3: Setup Steps

Ordered flow:

1. install Sendo
2. add Fire TV IP
3. connect Spotify
4. select target device
5. test a first action

### Section 4: Troubleshooting

Grouped help for:

- ADB not connected
- wrong Spotify device
- auth expired
- startup and tray behavior

### Section 5: Technical Links

- GitHub
- README
- Releases

## Copy Rules

The site copy should avoid:

- startup fluff
- vague adjectives like `modern`, `beautiful`, `intuitive`
- over-claiming

Preferred vocabulary:

- explicit
- local
- deterministic
- reusable
- targeted
- persistent
- control surface
- execution flow

## Accessibility and Performance

The site should be built static-first and lightweight.

Requirements:

- semantic headings
- visible focus states
- keyboard-safe nav and CTA usage
- low-JS by default
- no unnecessary client-side state for static sections
- optimized image usage for screenshots

This follows the intent of Vercel React best practices:

- minimal client bundle
- avoid unnecessary interactive wrappers
- keep content server-rendered unless interaction is needed

## File Structure Recommendation for `apps/site`

```text
apps/site/
  app/
    layout.tsx
    page.tsx
    install/page.tsx
    globals.css
  components/
    site-header.tsx
    hero.tsx
    screenshot-frame.tsx
    section-shell.tsx
    principles-strip.tsx
    main-flow.tsx
    system-diagram.tsx
    feature-grid.tsx
    footer-cta.tsx
    site-footer.tsx
  content/
    site.ts
  public/
    images/
      sendo-home.png
  lib/
    metadata.ts
```

## Recommended Implementation Sequence

1. scaffold `apps/site` with Next.js, TypeScript, Tailwind, and basic app router setup
2. add shared design tokens and global theme
3. implement layout shell and sticky navbar
4. implement hero and screenshot frame
5. implement remaining Home sections
6. implement `Install` page
7. add metadata, favicon, OG basics, and Vercel-ready config
8. link release download targets and GitHub references

## License Recommendation

Recommended repository license:

`MIT`

Reasons:

- standard and low-friction for open source tools
- easy for recruiters and engineers to parse
- good fit for an indie desktop utility

## Out of Scope

For the first version of the site, do not add:

- blog
- full docs site
- testimonials
- pricing-style sections
- complex animation system
- CMS
- account systems

## Decision Summary

Approved decisions:

- site lives in the same repository
- stack: Next.js + TypeScript + Tailwind + shadcn/ui primitives + lucide-react
- design language: dark, near-black, cyan/teal from Sendo logo
- homepage direction: screenshot-led
- visual intensity: hybrid leaning toward the more energetic logo-inspired hero
- nav: sticky transparent
- site structure: `Home + Install`
- footer: author-signature
- hero copy: approved first option
- repository license: MIT

## Next Step

After review, convert this design into an implementation plan and then scaffold `apps/site`.
