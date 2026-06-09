# AgentBid — Color System

**Aesthetic direction:** *premium control room* — Linear's restraint meets a Bloomberg
terminal. Dark, cool, dense, calm. Desktop only.

Source of truth: CSS variables in `apps/web/app/globals.css`, surfaced as Tailwind
tokens in `apps/web/tailwind.config.ts`. This file is the reference + migration map.

---

## 1. How the palette was chosen (Design for Hackers, Ch 8–9)

Walked the "I Need to Choose Colors" decision tree:

1. **Mood → dark + sparse accents.** The product is a procurement *governance* tool —
   it must feel exclusive, authoritative, analytical. That maps to two mood patterns
   from Ch 9: *mysterious/exclusive* (dark background, sparse bright accents) and
   *muted/sophisticated* (low-saturation neutral dominant + strong accents).

2. **Background → dark is appropriate here.** Ch 9 warns against dark/bright
   backgrounds only for *content-heavy reading* pages. AgentBid is a low-text,
   high-signal dashboard (panels, decisions, a node graph), so a dark canvas is
   the correct call, not a violation.

3. **Base hue → cool blue-gray.** Cool colors recede and calm (short-wavelength cones
   are sparse in the fovea — Ch 8), which is exactly what a financial/analytical
   surface wants. The neutral ramp is a desaturated blue-black (hue ≈ 218°), never
   pure `#000` (Ch 9: pure black is flat and unnatural; hue-shift it).

4. **Scheme → analogous accents + functional semantics.** Primary accent **blue**
   (action) and governance **purple** sit adjacent on the wheel → an *analogous*
   pairing that reads harmonious and professional. The semantic trio
   (green/red/amber) are warmer and contrast strongly against the cool dominant, so
   they *pop* precisely where attention is needed (Ch 9: accents must contrast the
   dominant scheme).

5. **Functional colors → conventional.** green = accept/success, red = block/error,
   amber = review/pending, blue = primary action. **Why red is safe here:** Ch 9 warns
   that red harms *analytical* contexts by overloading the prefrontal cortex — but only
   when red is a *dominant/ambient* color. Here red is reserved strictly for the BLOCK
   error state (its legitimate urgency role). The ambient palette stays cool, keeping
   rational decision-making intact.

6. **Depth → warm/cool temperature hierarchy.** Backgrounds are coolest and recede;
   surfaces step *up* in lightness as they come forward (`surface` → `surface-raised`).
   Primary text is a faint-warm near-white that advances; secondary/muted text is
   cooler and recedes — temperature reinforces hierarchy beyond size/weight (Ch 9).

7. **Shadows → hue-shifted, not black.** Elevation shadows use a cool blue-black
   (`rgba(5,8,14,…)`), not `#000` (Ch 9 Pattern 2).

---

## 2. Token reference

### Background hierarchy
| Token | Tailwind class root | Value | Role |
|---|---|---|---|
| `--bg` | `bg-bg` | `#0b0e14` | Page canvas (deepest, recedes) |
| `--surface` | `bg-surface` | `#12161f` | Panels, cards |
| `--surface-raised` | `bg-surface-raised` | `#1b2130` | Modals, popovers, hovered rows, insets |
| `--border-subtle` | `border-border-subtle` | `#1e2632` | Hairlines within a surface |
| `--border` | `border-border` | `#2a3342` | Dividers, input borders |

### Text
| Token | Tailwind class | Value | Role |
|---|---|---|---|
| `--text-primary` | `text-text-primary` | `#e6eaf1` | Headings, key values |
| `--text-secondary` | `text-text-secondary` | `#9ba6b7` | Body, descriptions |
| `--text-muted` | `text-text-muted` | `#5e6b7e` | Labels, metadata, timestamps |
| `--text-inverse` | `text-text-inverse` | `#0b0e14` | Text on solid accent/semantic fills |

### Accents (analogous)
| Token | Tailwind class | Value | Role |
|---|---|---|---|
| `--accent-blue` | `bg/text/border-accent-blue` | `#4c8fff` | Primary action / links |
| `--accent-blue-hover` | `…-accent-blue-hover` | `#6ba5ff` | Action hover |
| `--accent-blue-subtle` | `bg-accent-blue-subtle` | `rgba(76,143,255,.12)` | Action tint / selection |
| `--accent-purple` | `…-accent-purple` | `#9d7bff` | Governance / contract |
| `--accent-purple-hover` | `…-accent-purple-hover` | `#b197ff` | Governance hover |
| `--accent-purple-subtle` | `bg-accent-purple-subtle` | `rgba(157,123,255,.12)` | Governance tint |

### Semantic (each: base / text / border / subtle bg)
| State | base `…-{name}` | text `text-{name}-text` | border `border-{name}-border` | subtle `bg-{name}-subtle` |
|---|---|---|---|---|
| **accept** (green) | `#22c55e` | `#4ade80` | `rgba(34,197,94,.35)` | `rgba(34,197,94,.12)` |
| **block** (red) | `#ef4444` | `#f87171` | `rgba(239,68,68,.35)` | `rgba(239,68,68,.12)` |
| **review** (amber) | `#f59e0b` | `#fbbf24` | `rgba(245,158,11,.35)` | `rgba(245,158,11,.12)` |

Usage: `bg-{name}-subtle` for the card fill, `border-{name}-border` for its edge,
`text-{name}-text` for label text, `bg-{name}` for solid fills (badges, meter fills)
with `text-text-inverse`.

### Node graph
| Token | Tailwind class | Value | Meaning |
|---|---|---|---|
| `--node-broadcast` | `…-node-broadcast` | `#4c8fff` | Search broadcast / origin pulse |
| `--node-vendor` | `…-node-vendor` | `#8b97a8` | Discovered vendor (neutral) |
| `--node-contract` | `…-node-contract` | `#9d7bff` | Governance contract |
| `--node-winner` | `…-node-winner` | `#22c55e` | Selected vendor |
| `--node-loser` | `…-node-loser` | `#4a5462` | Eliminated vendor (dim, recedes) |

> Note: a losing vendor is **not** an error — `node-loser` is a dim neutral, not red.
> Red stays reserved for the BLOCK semantic.

### Elevation
`shadow-sm` / `shadow-md` / `shadow-lg` → hue-shifted cool blue-black shadows.

---

## 3. Palette visualization

```
PAGE        #0b0e14  ████   coolest — recedes
SURFACE     #12161f  ████
RAISED      #1b2130  ████   ↑ lighter = forward
BORDER      #2a3342  ▓▓▓▓

TEXT  pri #e6eaf1 ░  sec #9ba6b7 ▒  muted #5e6b7e ▓   (cool → cooler, recedes)

ACCENT   blue #4c8fff ████   purple #9d7bff ████      (analogous, harmonious)

SEMANTIC accept #22c55e ████  block #ef4444 ████  review #f59e0b ████
         (warm/contrasting — pop against the cool dominant, used sparingly)

NODES    broadcast●blue  vendor●slate  contract●purple  winner●green  loser●dim
```

The cool neutrals carry ~85% of every screen. Blue/purple appear on actions and
governance only. Green/red/amber appear only on decisions and meters. One or two
colors dominate; the rest are accents — per Ch 9 ("more colors ≠ better design").

---

## 4. Accessibility notes

- **Colorblind-safe (critical, Ch 8).** Status is never color-only. ACCEPT/BLOCK
  already pair color with a text label *and* a ✓/✗ glyph; keep that. The node graph
  must add redundant cues — node **shape/label/position/motion** — so broadcast vs
  vendor vs winner is legible to deuteranopes/protanopes, not just by hue.
- **Contrast (WCAG):**
  - `text-primary` on `bg` ≈ 14:1 ✓ · on `surface` ≈ 12:1 ✓
  - `text-secondary` on `surface` ≈ 7:1 ✓
  - `accept-text` / `block-text` / `review-text` / `accent-blue` on `bg`/`surface`
    all clear 4.5:1 ✓
  - ⚠️ `text-muted` (`#5e6b7e`) on `bg` ≈ 3.3:1 — **passes only as large text or
    non-essential metadata.** Don't use it for small, essential copy; step up to
    `text-secondary`.
  - On solid fills (`bg-accept`, `bg-block`, `bg-review`, `bg-accent-blue`) use
    `text-text-inverse` for legible labels.
- **Functional convention check (Ch 9):** red = error, green = success, amber =
  attention, blue = action/link — all respected. Blue is not used for non-interactive
  text.

---

## 5. Migration map — every ad-hoc class → token

Replace all raw Tailwind palette classes in `app/page.tsx` and `app/dashboard/page.tsx`.

### Neutrals (light → dark)
| Old | New | Context |
|---|---|---|
| `bg-slate-50` (body/page) | `bg-bg` | Page canvas |
| `bg-slate-50` (insets, stat tiles, hover) | `bg-surface-raised` | Inset/hover within a card |
| `bg-white` (cards) | `bg-surface` | Cards, panels |
| `bg-white` (modals) | `bg-surface-raised` | Dialogs |
| `bg-slate-900` (nav) | `bg-surface` | Top nav bar |
| `bg-slate-900` (primary btn, active toggle) | `bg-accent-blue` + `text-text-inverse` | Primary CTA / selected mode |
| `bg-slate-700` (btn hover) | `hover:bg-accent-blue-hover` | CTA hover |
| `bg-slate-100` / `bg-slate-200` (chips, track, add btn) | `bg-surface-raised` | Tag chips, progress track, secondary btn |
| `bg-slate-300` | `bg-border` | Misc fills |
| `border-slate-200` | `border-border` | Card/input borders |
| `border-slate-100` | `border-border-subtle` | Inner dividers |
| `border-slate-300` | `border-border` | Inputs |
| `border-slate-900` + `ring-slate-900` (selected) | `border-accent-blue` + `ring-accent-blue` | Selected contract |
| `ring-slate-300` (focus) | `ring-accent-blue` | Focus ring |
| `text-slate-900` / `text-slate-800` | `text-text-primary` | Headings, key values |
| `text-slate-700` / `text-slate-600` | `text-text-secondary` | Body copy |
| `text-slate-500` | `text-text-secondary` | Sub-copy |
| `text-slate-400` / `text-slate-300` | `text-text-muted` | Labels, bullets, metadata |

### ACCEPT (green → accept)
| Old | New |
|---|---|
| `bg-green-50` (accept banner) | `bg-accept-subtle` |
| `border-green-400` (accept banner) | `border-accept-border` |
| `bg-green-100` / `bg-green-200` (badge) | `bg-accept-subtle` |
| `text-green-800` / `text-green-700` / `text-green-600` / `text-green-500` | `text-accept-text` |
| `bg-green-500` (budget bar, healthy) | `bg-accept` |

### BLOCK (red → block)
| Old | New |
|---|---|
| `bg-red-50` (error box, block banner, modal rationale) | `bg-block-subtle` |
| `border-red-400` / `border-red-200` / `border-red-100` | `border-block-border` |
| `bg-red-100` / `bg-red-200` (badge) | `bg-block-subtle` |
| `text-red-800` / `text-red-700` / `text-red-600` / `text-red-500` / `text-red-400` | `text-block-text` |
| `bg-red-500` (budget bar, >90%) | `bg-block` |

### REVIEW / PENDING (amber/yellow → review)
| Old | New |
|---|---|
| `bg-amber-500` (override buttons) | `bg-review` + `text-text-inverse` |
| `bg-amber-600` (override hover) | `hover:brightness-110` (on `bg-review`) |
| `bg-yellow-50` (override-success banner) | `bg-review-subtle` |
| `border-yellow-400` | `border-review-border` |
| `bg-yellow-100` / `bg-yellow-200` (badge) | `bg-review-subtle` |
| `text-yellow-800` / `text-yellow-700` / `text-yellow-600` | `text-review-text` |
| `bg-amber-500` (budget bar, 70–90%) | `bg-review` |

### Links & action (blue → accent-blue)
| Old | New |
|---|---|
| `text-blue-500` (links: Manage/Create/Edit) | `text-accent-blue hover:text-accent-blue-hover` |

### Governance / LLM badges (purple, emerald, blue → accents)
| Old | New |
|---|---|
| `bg-purple-100` + `text-purple-700`/`text-purple-800` (Winner badge) | `bg-accent-purple-subtle text-accent-purple` |
| `border-purple-400` (winner pitch card) | `border-accent-purple` |
| `LLM_COLORS` `gpt-4o` `bg-emerald-100 text-emerald-800` | `bg-accept-subtle text-accept-text` |
| `LLM_COLORS` `claude…` `bg-purple-100 text-purple-800` | `bg-accent-purple-subtle text-accent-purple` |
| `LLM_COLORS` `gemini…` `bg-blue-100 text-blue-800` | `bg-accent-blue-subtle text-accent-blue` |

> The `LLM_COLORS` map reuses semantic/accent tokens as *categorical* model tags.
> They are decorative labels, not status — acceptable since they're text+name, never
> the sole carrier of meaning.

---

# AgentBid — Type System

Defined in `apps/web/app/layout.tsx` (next/font), surfaced as Tailwind tokens in
`tailwind.config.ts`, base set in `globals.css`. All three families are Google Fonts.

## 6. Font roles & rationale (Design for Hackers, Ch 3 + Appendix A)

| Role | Family | Weights | Used for |
|---|---|---|---|
| **display** | **Sora** | 300–800 | Large headings, vendor names, result numbers — **large sizes only** |
| **ui** (default) | **IBM Plex Sans** | 400–700 | Labels, buttons, nav, body, descriptions |
| **mono** | **IBM Plex Mono** | 400–600 | Logs, transaction IDs, Stripe PIs, prices, code |

**Reference translation.** The brief named *ITC Avant Garde Gothic + Cooper BT weight
contrast*. Avant Garde = tight **geometric** editorial sans; Cooper = a heavy soft
face. Since this is a financial/governance tool ("premium, not decorative"), the
**weight-contrast concept** is honored — but it lives *inside* the geometric display
family (Sora 300 ↔ 800), the same editorial move, rather than importing Cooper's retro
warmth. **Sora** channels Avant Garde's geometry while reading premium-technical, not
fashion-retro.

**Why geometric is display-only (Ch 3).** Geometric sans with near-perfect circles
render poorly at body sizes on ~96–150 ppi screens (curves fight the pixel grid). So
Sora is reserved for ≥20px. Small UI/body text uses **IBM Plex Sans**, a *realist
grotesque* with a tall x-height built for screen legibility — and chosen over Inter,
which is the most common AI-default "tell."

**Pairing legitimacy (Appendix A).** Two sans-serifs for text technically bends the
"one serif + one sans" rule. It's justified as the **deliberate-extreme-contrast**
exception, not the failure-prone "uncanny valley" middle ground:
- The `n` test: Sora has a geometric arch; Plex Sans has a squared grotesque shoulder —
  structurally distinct.
- They never appear at the same size/weight (geometric-large-heavy vs realist-small-
  regular), so the contrast reads as intentional.
- **IBM Plex Mono is excluded** from the two-family count (code fonts are exempt) and
  is guaranteed to harmonize with Plex Sans via the **same-superfamily shortcut**.

**Authentic weights only.** Each weight is a real font file loaded via next/font — no
faux bold/italic (Appendix A critical rule). `font-extrabold` = Sora 800, a true cut.

## 7. Type scale (Tailwind `text-*` tokens)

~1.25 modular scale, 14px base. **Hierarchy is carried by weight + family first, size
second** (per the brief and Ch 7's "weight before size").

| Token | Size | Line-height | Weight | Family to use | Role |
|---|---|---|---|---|---|
| `text-display-2xl` | 44px | 1.05 | 800 | `font-display` | Hero result / big number |
| `text-display-xl` | 34px | 1.10 | 700 | `font-display` | Page title |
| `text-display-lg` | 26px | 1.15 | 600 | `font-display` | Section heading |
| `text-display-md` | 20px | 1.20 | 600 | `font-display` | Vendor name, card title |
| `text-body-lg` | 16px | 1.50 | 400 | default (sans) | Emphasized body |
| `text-body` | 14px | 1.45 | 400 | default (sans) | Default UI / body |
| `text-label` | 13px | 1.10 | 500 | default (sans) | Buttons, form labels |
| `text-caption` | 12px | 1.00 | 400 | default (sans) | Metadata, timestamps |
| `text-overline` | 11px | 1.00 | 600 | default (sans) | Eyebrow labels (uppercase, tracked) |
| `text-mono` | 13px | 1.45 | 400 | `font-mono` | Logs, IDs, prices |
| `text-mono-sm` | 12px | 1.40 | 400 | `font-mono` | Small IDs |

> **Usage note:** `text-display-*` set size + weight + tracking but not family — always
> pair with `font-display`. Example heading:
> `<h1 className="font-display text-display-xl text-text-primary">`.

## 8. The weight-contrast move (Avant Garde editorial)

Where the brief wants drama, contrast weight *within* Sora rather than reaching for
size or color. Example — a result headline:

```
<p class="font-display">
  <span class="text-display-2xl">$2,480</span>      ← Sora 800, dominant
  <span class="text-display-md font-light">/mo from Acme</span>  ← Sora 300, recedes
</p>
```

The 800↔300 jump is the hierarchy signal. Reserve this for display surfaces (result
card, hero); keep UI labels in steady Plex Sans 400/500/600.

## 9. Typographic etiquette (Appendix B — apply when editing copy)

- Smart quotes (`"` `"` `'` `'`), not straight `"`/`'`.
- Spaced en dash (`–`) or em dash (`—`) for ranges/asides, never `--`.
- One space after periods.
- Ragged-right (left-aligned) body — never `text-align: justify`.
- Prices/IDs/quantities go in `font-mono` so digits align (tabular feel) and read as
  machine data — reinforcing the Bloomberg-terminal aesthetic.

## 10. Loading & performance

- All three via `next/font/google` with `display: "swap"` → self-hosted at build,
  no layout shift, no external request at runtime, no licensing concern.
- Only the weights listed above are fetched. If a weight is unused after the UI
  migration, drop it from `layout.tsx` to trim payload.
