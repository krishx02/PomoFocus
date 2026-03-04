# PomoFocus — Product Brief v0.2

> **Status:** Phase 2 in progress (Solution Framing).
> **Last updated:** 2026-03-04
> **Author:** Discovery session with founder

---

## 1. Problem Statement

### The Intention-Action Gap

People who thrive in structured environments (office, school, routines) lose focus when that external structure disappears. At home, on weekends, or in unstructured time, the phone becomes a dopamine trap — TikTok, Snapchat, iMessage, YouTube, Gmail — and minutes of "quick checking" turn into hours of scrolling.

This isn't laziness. It's a well-documented psychological pattern:

- **Present bias / temporal discounting** — The brain values "scroll now" over "become who I want to be later." The immediate reward always outweighs the abstract future goal.
- **Goal salience** — Out of sight = out of mind. When your goals aren't physically visible in your environment, they lose the fight against whatever's on your phone screen.
- **Environmental dependence** — Performance is tied to context. A structured workplace (colleagues, expectations, routine) provides external scaffolding. Remove the scaffolding, and habits collapse.

### The Post-Scroll Guilt Cycle

After losing time to scrolling, users feel bad — which makes them less likely to start a productive session, which leads to more avoidance, which leads to more scrolling. The emotional cost is real and compounds.

### Why Existing Pomodoro Apps Fail

Existing Pomodoro apps live on the phone — the same device that is the source of the problem. Opening a timer app means unlocking the device that has every distraction one swipe away. It's like putting a gym inside a candy store. The tool and the trap share the same screen.

---

## 2. Target User

### Primary Segment: Structure Seekers

> People who perform well in structured environments but fall apart without external structure — and know it, and feel bad about it.

**Characteristics:**
- They are not lazy. They are environment-dependent.
- They have goals and ambitions. They know what they *should* be doing.
- They perform in structured contexts (work, school, routines imposed by others).
- They crumble in unstructured contexts (home, weekends, holidays, transitions).
- They experience guilt and frustration about the gap between who they are and who they want to be.

**Demographic starting points (not exclusive):**
- College students between classes and during study sessions
- New grads entering the workforce (especially remote/hybrid roles)
- Anyone who has recently changed environments (moved cities, started a new job, graduated)

### What They Need (Jobs to Be Done)

1. **Create structure when my environment doesn't provide it** — "I need something external to keep me on track when nobody's watching."
2. **Stay connected to my larger goals** — "I need to be reminded of why I'm doing this, not just told to focus for 25 minutes."
3. **Break the phone-grab reflex** — "I need something on my desk that isn't my phone, so I look at that instead."
4. **See evidence that I'm making progress** — "I need proof that the structure is working, or I'll stop trusting it."

---

## 3. Core Insight

### The product is not a timer. The product is portable structure.

The founder's own experience crystallized this: at Nike in Portland, performance is high — the environment provides structure. At home, it collapses. The difference isn't willpower or motivation. It's environment.

**What triggers the "put the phone away" moment:** Reconnecting with larger goals. Being reminded of who you're trying to become. This requires active effort — the user has to fight their brain's dopamine-seeking impulse and consciously recall their goals.

**The product thesis:**

> A physical commitment device that keeps your goals visible, creates structure through focused work sessions, and replaces your phone as the object on your desk you reach for.

The timer is a mechanism. The product is environmental structure you carry with you.

---

## 4. Device + Software Relationship

### The device is the anchor. The app is the brain. But the app stands alone.

**The physical device is the *best* experience, not a *required* one.** The software must be a complete product on its own — with a full timer, goals, tracking, and cloud sync. Users who choose to stay software-only are making a valid choice. The device is the premium layer for users who want the strongest version of environmental structure, but the app never feels incomplete without it.

This matters for adoption: requiring a hardware purchase to use a Pomodoro app would kill growth. The software brings people in. The device deepens the experience for those who want it.

**Three tiers of experience:**
1. **Software-only** — App with timer, goals, reflection, tracking, cloud sync. Complete product.
2. **Software + device** — App handles preparation/reflection, device handles focus sessions. The recommended experience.
3. **Device-only** — Basic timer works out of the box without the app, but no goals/tracking/sync. Functional but limited.

**Physical device (during session):**
- Present on desk — replaces phone as the thing you look at
- Displays current goal / intention for this session
- Runs the timer with tangible, physical feedback
- Acts as a commitment device — harder to ignore than a phone notification
- Should make the phone unnecessary during focus time

**Software app (between sessions — or during session for software-only users):**
- **Timer** — Full Pomodoro timer for software-only users. This is a deliberate choice the user makes, knowing the phone is a riskier environment.
- **Preparation:** Set goals, plan sessions, define what you're working toward
- **Reflection:** Quick post-session check-in ("Did I stay focused? What pulled me away?")
- **Pattern tracking:** When are you most focused? What days do you crumble? How long before you break?
- **Goal evolution:** Goals develop over time. The app is where you write, refine, and prioritize — the device pulls from this
- **Cross-environment continuity:** Goals and streaks follow you across locations and devices. Cloud sync is the connective tissue.
- **Accountability:** Streaks, weekly reviews, eventually sharing with friends or groups

**Critical design rule:** For device users, the app is a preparation and reflection tool, never a during-session distraction. For software-only users, the timer is available in-app — but the product should still encourage phone-down habits (e.g., lock screen widget, do-not-disturb integration, minimal UI during sessions).

---

## 5. Solution Shape — Device Architecture

### v1 target: Software (iOS + web) + prototype physical device

The founder has no hardware background. v1 is a working prototype device (dev board, 3D-printed or off-the-shelf enclosure) paired with the software app. Not a shippable consumer product — something for personal use and 10-20 testers.

**The critical feature to prove in v1:** Sync between the physical device and the cloud. Session data, goals, and progress must flow between device → app → cloud seamlessly.

### Device is independent during focus. Sync is eventual.

The device must work **without the phone nearby.** If the device requires a live BLE connection to start a session, the user needs their phone on the desk — which is the problem being solved. Instead:

- **Goals are created and edited only in the app.** The device has no keyboard or text input. Think Apple Watch pulling calendar events from the iPhone — you don't type on the watch.
- **Goals sync to the device via BLE** whenever the phone is nearby (could be once a day, could be after every session).
- **The device caches goals locally** (3-5 active goals, stored as short text strings in flash memory — a few KB).
- **During a session, the device is fully self-sufficient.** User scrolls through cached goals with a button/dial, selects one, starts the timer. Phone can be in another room, turned off, doesn't matter.
- **Completed sessions are buffered locally** (last ~50 sessions: timestamp, duration, goal ID, completed/abandoned).
- **Sync happens when convenient.** Next time the phone is in BLE range, buffered sessions push up to the app/cloud, and any new/changed goals push down to the device. If sync doesn't happen for a week, nothing breaks.

### Hardware direction

| Component | Choice | Why |
|-----------|--------|-----|
| Microcontroller | **ESP32** (e.g., LILYGO T-Display S3) | $3-5 chip, BLE + WiFi built in, flash storage, massive community. The standard for this kind of project. |
| Display | **E-ink** (lean) or OLED (alternative) | E-ink: paper-like, readable in sunlight, uses battery only on screen change (timer shows mostly static content). Matches the calm/focused aesthetic. Battery lasts weeks. OLED: brighter, faster refresh, but higher power draw and burn-in risk from static content. |
| Input | **1-3 physical buttons** or a small rotary dial | Enough to: scroll goals, select, start timer, pause, done. Minimal and tactile. |
| Power | **USB-C** (for desk use) + battery for portability | Rechargeable LiPo battery. E-ink display means battery lasts much longer. |
| Connectivity | **BLE only** (no WiFi needed on device) | Phone is the relay to the cloud. Keeps device simple, cheap, low-power. |
| Enclosure | **Off-the-shelf dev board** → later 3D-printed case | Start with a bare LILYGO board. Enclosure is cosmetic and can come later. |

**Reference products to look up:**
- "LILYGO T5 e-paper" — ESP32 + e-ink display dev board
- "LILYGO T-Display S3" — ESP32 + small color LCD dev board
- "Watchy" — open-source ESP32 e-ink smartwatch (shows what's possible)
- "Adafruit SSD1306 128x64 OLED" — common small OLED for hardware projects

### Device interaction model

```
[On the app — before focus time]
  1. Create/edit goals ("Study calculus", "Write chapter 3")
  2. Set timer preferences (25/5, 50/10, custom)
  3. Goals + settings sync to device via BLE

[On the device — during focus time, phone is away]
  1. Button press → wake device
  2. Scroll through cached goals → select one
  3. Display shows: goal text + timer countdown
  4. Timer runs independently
  5. Session completes → stored locally on device

[Later — phone comes back in range]
  1. BLE reconnects automatically
  2. Completed sessions push to app/cloud
  3. Updated goals push down to device
  4. App shows full history, streaks, patterns
```

### What the device does NOT do (v1)
- No text input / goal editing on the device
- No WiFi (phone relays to cloud)
- No complex UI (no menus, no settings screens)
- No audio/haptic feedback (maybe later — buzzer for timer end)
- No multi-user support (one device = one person)

---

## 6. Research Threads to Investigate (from Phase 1)

These should be explored before finalizing the solution design:

| Thread | Key Question | Starting Points |
|--------|-------------|-----------------|
| Present bias & commitment devices | What types of commitment devices have the highest adherence rates? | Ariely's work on pre-commitment; StickK app research |
| Goal salience | How frequently must goals be visible to maintain motivation? | Implementation intentions (Gollwitzer, 1999); visual cue research |
| Environmental design | What specific environmental changes most reduce phone usage? | James Clear (Atomic Habits); phone-free zone studies |
| Habit formation timelines | How long before a "structure seeker" internalizes the structure? | Lally et al. (2010) — average 66 days, high variance |
| Screen time intervention research | Do physical alternatives to phones reduce screen time? | Light Phone studies; dumbphone movement research |
| Pomodoro technique efficacy | Does Pomodoro specifically work, or is any structured interval effective? | DeLong (2009); Cirillo's original research |
| Guilt-productivity cycle | How does post-scrolling guilt affect subsequent productivity? | Procrastination research (Pychyl, Sirois) |

---

## 7. Open Questions (remaining)

*Answered in Phase 2:* ~~device form factor~~, ~~minimum viable device~~, ~~device-app communication~~, ~~v1 scope~~.

1. **What happens in the first 5 minutes?** Onboarding for a device + app combo is complex. What's the experience?
2. **Is this a subscription?** The app has ongoing value (tracking, goals, sync). The device is a one-time purchase. How does pricing work?
3. **Social features — yes or no for v1?** Accountability partners, shared goals, study groups — powerful but complex. Where's the line for launch?
4. **What does the session flow feel like end-to-end?** Pre-session (goal setting) → during session (focus) → post-session (reflection) — what specifically happens at each stage in the app?
5. **What data matters for "pattern tracking"?** What charts/insights would actually change user behavior vs. vanity metrics?

---

## 8. Competitive Landscape (to be expanded)

| Product | What It Does | Why It's Not This |
|---------|-------------|-------------------|
| Forest App | Gamified phone-down timer (grow a tree) | Lives on the phone. No goals. No physical presence. |
| Focus Keeper / Tide | Pomodoro timers | Timer-only. No goal system. On the phone. |
| Opal / One Sec | App blockers / friction tools | Treats symptoms (block apps) not cause (no structure). |
| Light Phone | Minimal phone | Replaces your phone entirely. Too extreme for most. |
| Pomodoro physical timers | Mechanical kitchen timers | No goal connection. No tracking. No system. |
| Timeular | Physical time-tracking die | Tracks time categories but doesn't create structure or block distractions. |

**The gap:** No product combines a physical focus device + goal-connected software + behavioral science foundation. Physical timers have no brains. Apps live on the distraction device. Nothing bridges both.

---

*Phase 2 in progress. Remaining: session flow, pricing model, social features, pattern tracking, onboarding.*
