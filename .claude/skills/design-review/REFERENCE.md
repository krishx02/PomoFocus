# Design Review — Reference Guide

> Extended guidance for the `/design-review` skill. Read this file for platform checklists, accessibility criteria, dark pattern detection, motion evaluation, and common design questions.

---

## Platform-Specific Checklists

### iOS App (HIG)
- [ ] Uses Tab Bar for primary navigation (not hamburger menu)
- [ ] SF Pro for text, SF Symbols for icons
- [ ] Dynamic Type supported — text scales with user settings
- [ ] VoiceOver labels on all interactive elements
- [ ] Touch targets ≥ 44×44 pt
- [ ] Respects system appearance (light/dark mode via `UIUserInterfaceStyle`)
- [ ] Uses standard iOS patterns: sheets for tasks, Navigation Bar for hierarchy
- [ ] No custom gestures that conflict with system gestures (swipe-back, Control Center)
- [ ] Supports `UIAccessibilityTraits` for all controls

### watchOS
- [ ] Single-gesture activation — start a session in one tap from complication or app
- [ ] Complication design follows ClockKit/WidgetKit guidelines
- [ ] "Faster is more" — users glance, tap once or twice, done
- [ ] Haptic feedback at session boundaries (`.notification` type)
- [ ] Smart Stack card shows relevant timer state
- [ ] Text is legible at watch-face distance
- [ ] Minimal navigation depth — 1-2 levels max

### macOS Menu Bar Widget
- [ ] Minimal footprint — icon changes state, no persistent window
- [ ] Click to reveal popover, not a full window
- [ ] Keyboard shortcut to start/stop session
- [ ] Respects system appearance (light/dark)
- [ ] Does not steal focus from the user's active app

### iOS Home Screen Widget
- [ ] Glanceable — conveys state in <2 seconds
- [ ] No scrolling (WidgetKit limitation)
- [ ] Supports Small, Medium, Large sizes with appropriate layouts
- [ ] Deep links to the correct screen on tap
- [ ] Refreshes at appropriate intervals (timeline provider)

### Web App
- [ ] Fully keyboard navigable (Tab, Enter, Escape)
- [ ] Respects `prefers-color-scheme` and `prefers-reduced-motion`
- [ ] WCAG 2.2 AA compliant (4.5:1 contrast for text, 3:1 for large text/UI)
- [ ] Focus indicators visible on all interactive elements
- [ ] Responsive across viewport sizes (mobile-first)
- [ ] Skip-to-content link for screen readers
- [ ] Semantic HTML (`<main>`, `<nav>`, `<button>`, not `<div onClick>`)

### Android (Material Design 3)
- [ ] Uses Material 3 components and design tokens
- [ ] Dynamic Color from wallpaper (optional but expected)
- [ ] TalkBack-compatible with proper content descriptions
- [ ] Touch targets ≥ 48×48 dp
- [ ] Respects system font size settings
- [ ] Back gesture and predictive back animation supported

### e-ink Device
- [ ] No fast animations — e-ink refresh is ~250ms partial, ~1s full
- [ ] High contrast (black on white or white on black) — no grays that ghost
- [ ] Embrace slow refresh as a feature, not a limitation
- [ ] Large, readable typography (minimum 16pt equivalent)
- [ ] Physical button interactions, not touch gestures
- [ ] Screen designed for "active rest" — beautiful when idle

### VS Code Extension
- [ ] Uses VS Code Webview API or TreeView for UI
- [ ] Respects user's color theme (access `--vscode-*` CSS variables)
- [ ] Status bar item shows timer state unobtrusively
- [ ] Commands registered and discoverable via Command Palette
- [ ] Does not block the editor or steal focus during sessions

---

## Accessibility Check

Evaluate against these criteria regardless of platform:

### Visual
- [ ] **Color contrast**: 4.5:1 minimum for normal text, 3:1 for large text and UI components (WCAG 2.2 AA)
- [ ] **Color is not the only indicator**: Status, errors, and state changes use shape, icon, or text in addition to color
- [ ] **Text scaling**: UI remains usable at 200% text size

### Motor
- [ ] **Touch targets**: Meet platform minimum (44pt iOS, 48dp Android)
- [ ] **No precision gestures required**: Long-press, pinch, and multi-finger gestures have alternatives
- [ ] **Physical device**: Buttons are large enough and have enough travel for users with limited dexterity

### Cognitive
- [ ] **Information density**: Only essential information is shown per screen (aligns with Emptiness principle)
- [ ] **Consistent patterns**: Same action works the same way everywhere (aligns with Familiarity principle)
- [ ] **No time pressure on decisions**: The timer counts *for* the user, not against them
- [ ] **Plain language**: Labels and messages use simple, direct wording

### Assistive Technology
- [ ] **Screen reader**: All interactive elements have labels; images have alt text; decorative elements are hidden from AT
- [ ] **Reduced motion**: Animations respect `prefers-reduced-motion` / `UIAccessibilityReduceMotion`
- [ ] **Keyboard/Switch**: Full functionality available without touch or mouse

---

## Deceptive Design Check

Scan for these patterns (from Brignull's taxonomy and Mathur et al.):

| Pattern | What to check | PomoFocus risk area |
|---------|--------------|-------------------|
| **Confirmshaming** | Does canceling or declining use guilt-inducing language? | Subscription downgrade, streak-break messaging |
| **Fake urgency/scarcity** | Are there countdown timers or "limited time" on offers? | Subscription pricing |
| **Nagging** | Does the app repeatedly ask for something the user declined? | Push notification permissions, upgrade prompts |
| **Forced continuity** | Is it easy to cancel a subscription? As easy as subscribing? | Subscription management |
| **Obstruction** | Are negative paths (cancel, delete, downgrade) harder than positive ones? | Account deletion, subscription cancel |
| **Loss aversion as guilt** | Does the app shame broken streaks or missed sessions? | Streak display, session abandonment messaging |
| **Visual interference** | Are decline/cancel buttons visually suppressed? | Upgrade prompts, paywall design |
| **Dark defaults** | Are options pre-selected that benefit the app over the user? | Notification settings, data sharing |

**The PomoFocus test**: Every interaction should pass Principle 9 ("Imperfection Is Human") and Principle 3 ("The Product Should Be Put Down"). If a pattern makes the user feel guilty, anxious, or trapped — it's deceptive, regardless of whether it's "standard practice."

---

## Motion & Animation Evaluation

When Principle 7 ("Emotion Lives in the Transition") applies:

### Purpose Check
- Does this animation **clarify** (show spatial relationship, confirm an action, guide attention)?
- Or is it **decorative** (exists for visual interest but adds no understanding)?
- Decorative animations are acceptable only if they're brief, delightful, and respect reduced-motion.

### Timing Guidelines
| Type | Duration | Example |
|------|----------|---------|
| Micro-interaction | 100–300ms | Button press, toggle, checkbox |
| Component transition | 200–500ms | Sheet appearing, card expanding |
| Page/screen transition | 300–500ms | Navigation push, modal present |
| Celebratory moment | 500–1500ms | Session complete, streak milestone |

### Easing
- Use consistent easing curves across the product (define a motion token system)
- Entry: ease-out (fast start, gentle landing)
- Exit: ease-in (gentle start, fast departure)
- Standard: ease-in-out for repositioning

### Accessibility
- [ ] `prefers-reduced-motion` respected — replace animations with instant state changes or crossfades
- [ ] No flashing content (≤3 flashes per second, WCAG 2.3.1)
- [ ] Animation is not the only way to convey information

### Performance
- Target 60fps — if an animation causes frame drops, simplify or remove it
- Prefer CSS transforms and opacity over layout-triggering properties
- On e-ink: no animation at all (use instant state changes)

---

## Usability Hygiene (Nielsen Gaps)

These usability heuristics are not covered by the 10 PomoFocus design principles but matter for a complete review:

| Heuristic | Check | Example in PomoFocus |
|-----------|-------|---------------------|
| **System status visibility** | Does the user always know what's happening? | Timer state (running/paused/break), sync status, BLE connection state |
| **Error prevention** | Does the design prevent mistakes before they happen? | Confirm before deleting data, prevent accidental session end |
| **Recognition over recall** | Can the user see their options rather than remembering them? | Recent goals visible when starting a session, not requiring typing from memory |
| **User control and freedom** | Can the user undo, go back, or exit without penalty? | Cancel a session without shame, undo a completed session if tapped by mistake |
| **Help and documentation** | Is help available for non-obvious features? | How to pair BLE device, what the stats mean, how sync works |

---

## Common Design Questions

### "Should we add [feature]?"
Start with the Shaker test. Is it necessary? Is it useful? If you can't answer yes to both with conviction, recommend cutting it.

### "How should the [screen] look?"
Start with Familiarity (what does the user expect?), then Emptiness (what can be removed?), then Material Truth (what platform is this on?). Reference the platform checklist above.

### "What should the device look like?"
Think Rams (as little design as possible), Fukasawa (without thought — the interaction should be obvious), Teenage Engineering (an object you want on your desk), and Quiet Luxury (quality in materials, not in branding).

### "How should [transition/moment] feel?"
Think Norman (which emotional level?), Principle 7 (emotion lives in the transition), and the Motion Evaluation criteria above. Specify duration, easing, and reduced-motion fallback.

### "Should we use [animation/color/font/pattern]?"
Start with Material Truth (is this honest to the platform?), then Ordinary Until You Look Closely (does this draw attention to itself or to the content?), then Care Is Visible (is this a detail that rewards attention?).

### "How do we handle [error/empty state/imperfect data]?"
Start with Imperfection Is Human (display imperfect data with warmth), then Emptiness (an empty state is an opportunity for calm, not panic), then the product brief (non-judgmental framing, citing Sirois & Pychyl 2013). Also run the Deceptive Design Check — errors must never blame the user.

### "Is this accessible enough?"
Run the full Accessibility Check above. "Enough" means WCAG 2.2 AA at minimum, plus platform-specific requirements. Accessibility is not a gradient — either it meets the standard or it doesn't.

---

## Sources

### Frameworks Referenced
- **Nielsen's 10 Usability Heuristics** — [nngroup.com/articles/ten-usability-heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- **Brignull's Deceptive Patterns Taxonomy** — [deceptive.design/types](https://www.deceptive.design/types)
- **Mathur et al. (2019)** — Dark pattern classification from 53,000 product pages
- **Calm Tech Institute Evaluation** — [calmtech.institute](https://www.calmtech.institute)
- **WCAG 2.2** — [w3.org/WAI/WCAG22/quickref](https://www.w3.org/WAI/WCAG22/quickref/)
- **Apple Human Interface Guidelines** — [developer.apple.com/design/human-interface-guidelines](https://developer.apple.com/design/human-interface-guidelines)
- **Material Design 3** — [m3.material.io](https://m3.material.io/)
- **Critical Design Strategy (Roberts et al., 2026)** — IEEE TVCG, 3-stage critique method with principle weighting

### Research That Informed This Guide
- Microsoft UX (2025): Generic LLM heuristic evaluation achieves 50-75% accuracy; domain-specific heuristics reach 95%
- DiVA Portal (2025): AI-generated UIs contain dark patterns by default without explicit ethical constraints
- Baymard Institute: 771 domain-specific UX heuristics achieve 95% accuracy vs. human experts
- CHI 2024 (Duan et al.): Condensed JSON UI representation + selected heuristics outperforms open-ended LLM review
