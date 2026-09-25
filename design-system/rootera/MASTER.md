# Rootera design system — "Greenhouse Glass"

Source of truth for every screen. Code: `src/ds/` (tokens, theme, icons, components).
Living reference: web preview `?gallery=1` (add `&scheme=dark` or `&reduceTransparency=1`).
Page-specific overrides go in `pages/<page>.md` and win over this file.

> Built with the ui-ux-pro-max skill. Verified matches used: style **Liquid Glass**
> (Apple platform material: navigation and controls only, reduced-transparency fallback)
> and **Organic Biophilic** (identity layer); React Native guidance (Reanimated on the UI
> thread, native gestures) and UX rules (reduced motion, 1–2 animated elements per view).
> The generated landing-page pattern, generic palette and Lora/Raleway pairing were
> rejected as off-product and replaced with the brand values below.

## Principle

Content grows on solid, organic paper. **Glass is only for what floats above content**:
tab bar, headers, floating controls, sheets, toasts. Never on plant content, lists or forms.

## Colour (all text pairs ≥ 4.5:1, measured)

| Role | Light | Dark | Use |
|---|---|---|---|
| canvas | #F3F5EC | #0F130B | screen background |
| raised | #FBFCF7 | #171D12 | grouped lists, solid glass fallback |
| sunken | #E8ECDD | #1E2518 | plant stages, inputs, chips |
| ink / ink2 / ink3 | #1C2314 / #4A533C / #5C654E | #EEF2E6 / #BFC7B1 / #A2AB93 | text levels (min 5.06:1 light, 6.59:1 dark) |
| action / onAction | #34431D / #FFF | #B5DE7C / #0F130B | primary controls (10.7:1 / 12.3:1) |
| leaf | #6DBF2E | #8FCB4E | brand green: illustration and fills, **never text** |
| leafText / leafMark | #386F16 / #4F9A1C | #A6D96A / #8FCB4E | green text / status marks (≥3:1) |
| clay / clayText | #C0582E / #A1461F | #E08A63 / #EB9A73 | "needs you" marks / text |
| water | #2C6474 | #86BCCB | watering only |
| danger | #9E3620 | #F08D78 | destructive |
| soil scale | #D8C39E → #5A3E27 | same, lifted | soil checks only |

One accent family (greens). Terracotta and water are semantic, not decorative.

## Glass levels

| Level | Blur | Tint | Text? | Where |
|---|---|---|---|---|
| chrome | 28 | 86% light / 84% dark | yes | tab bar, headers, sheets |
| control | 18 | same | yes | floating buttons, segmented, toasts |
| clear | 14 | 55% / 50% | **no** | decorative only |

Tint density keeps ink3 ≥ 4.5:1 over the worst backdrop (dark foliage / bright leaf).
Specular edge: 1 px light line along the top + hairline rim. Shadows are tinted
(`rgba(40,52,20,.14)`), one light source from above. **Reduce Transparency → solid `raised`.**

## Type

One family, two voices: **Instrument Sans** for the interface and **Instrument Serif** for plant
names, section headings (italic) and editorial moments. Chosen over Inter in a side-by-side test
(`review/font-A-instrument-vs-B-inter.jpg`): narrower, more character, same family as the serif.
Custom fonts select weight by family name; `fontWeight` is never used.

display 46 serif · hero 36 serif · section 22 serif italic · latin 18 serif italic ·
largeTitle 32/600 · title 26/600 · title2 21/500 · headline 17/500 · body 17/400 · callout 16 ·
subhead 15 · footnote 13 · caption 12/500 · figure 34/500 tabular.
Weights: 400 to read, 500 to emphasise, 600 only for titles. Labels are sentence case,
**no letter-spaced all-caps**.

## Space, radius, elevation

4-pt grid: 4 8 12 16 20 24 32 44 64; gutter 20. Spacious.
Radius grows with size: inner 4 · input 6 · control 10 · card 16 · chrome 26 · pill (only glass chrome and tab plates). Continuous corners.
Controls read as tools: near-square buttons, rectangular option tags, baseline-rule fields, underlined tabs.
Lists read as a catalogue index: serif italic heading, full-width hairlines, no cards, no per-row icons.
Elevation: `float` (glass chrome) and `lift` (selected segment). No other shadows.

## Motion

Reanimated on the UI thread; **springs**, not linear easing.
snappy (22/340) press, toggle, select · smooth (26/190) layout, sheets, morphs ·
bouncy (11/170) celebrations and plant settle · gentle (30/80) ambient.
Exits faster than enters (160 ms). Animate transform/opacity only.
1–2 animated focal elements per view; continuity over cuts (an element becomes the next one).
**Reduce Motion → final state immediately; crossfades ≤ 120 ms.**

## Iconography

Own glyph set (`src/ds/icons.tsx`): 24-pt grid, 1.75 stroke, round caps; domain metaphors
(soil clump, drop, leaf, pot, sprout). Filled variant only for the selected tab. No emoji.

## Components

`T` text · `Glass` · `Tap` (spring press + visible focus ring, ≥44 pt) · `Btn` filled/outline/plain/glass/destructive ·
`GlassIcon` · `Chip` · `Segmented` · `Field` (label above, focus ring) · `Group` + `Row` (inset grouped) ·
`SourceLabel` + `SourceMark` legend (● observed · ○ told · ■ species · ◆ suggested · – not connected) · `Figure` · `Toast` · `FloatingTabBar`.

## Anti-patterns (rejected here)

Glass on content or lists · all-caps tracked labels everywhere · three equal boxes in a row ·
generic icon kits · raw hex in screens · fake percentages · width/height animations ·
more than two animated focal points per view · motion without a reduced-motion path.
