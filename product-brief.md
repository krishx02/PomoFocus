# PomoFocus — Product Brief v0.6

> **Status:** Phase 5 complete (Research — Section 13 threads verified, Section 14 expanded).
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

> **Research note:** Ariely & Wertenbroch (2002) and Bryan, Karlan & Nelson (2010) confirm that commitment devices are among the most effective behavior change tools available — and that *observability* is a key amplifier. The physical device is itself a commitment device: purchasing it is a public act of precommitment. This confirms the core thesis: the product isn't just a timer, it's a tangible commitment artifact. Environmental design research (Kanjo 2022, PNAS 2025) further confirms that removing the phone from the visual field is more effective than willpower-based blocking.

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

## 6. Session Flow

### The widget is a critical touchpoint

The lock screen / home screen widget is visible *without opening the app*. It does the goal salience job — keeping goals visible — without pulling the user into the phone. For software-only users, the widget is the software equivalent of glancing at the physical device on the desk.

**Widget shows:**
- Current/next goal ("Study calculus — 2 sessions today")
- Quick-start button (tap → timer starts, app opens in minimal mode)
- Streak or progress indicator ("5-day streak" or "3/5 sessions done")

> **Research note:** Gollwitzer (1999) and Gollwitzer & Sheeran (2006) — meta-analysis of 94 studies, N > 8,000, effect size d = 0.65 — confirm that implementation intentions (a specific "if [cue], then [behavior]" plan) significantly outperform goal intentions alone. The widget operationalizes this: seeing "Study calculus — 0/3 sessions today" the moment you unlock your phone creates the cue-response link automatically. Goal visibility doesn't need to be manually scheduled — the widget and device ensure it is always present.

### Goal model — three layers

Goals aren't just "study calculus today." Process-oriented goals (what you *do*) drive more consistent behavior than outcome goals (what you *achieve*). The product supports both, in a hierarchy:

**Long-term goals (the "why"):**
- Big-picture, ongoing aspirations: "Get strong at calculus," "Finish my novel," "Launch the side project"
- No daily session count — these are directional, not completable in a day
- Provide *meaning* to daily work. Every session connects back to a long-term goal.
- Can run for weeks or months. The user creates, evolves, and eventually completes or retires them.

**Process goals (the "how"):**
- Daily/weekly habits attached to a long-term goal: "Study calculus 3 sessions/day" or "Write 2 sessions every morning"
- These appear on the device and in the widget — they're the actionable layer
- Trackable: you either did your 3 sessions today or you didn't
- Streaks attach here (not to the long-term goal)
- A long-term goal can have multiple process goals

**Session intentions (the "what right now"):**
- Optional, per-session: "Finish problem set 4" or "Write the intro paragraph"
- Most granular level — what you're doing *this specific* 25 minutes
- Shows on the device screen during the session

**Example hierarchy:**
```
Long-term:  "Get strong at calculus"
  Process:  "3 study sessions per day"
    Session: "Finish problem set 4"
    Session: "Review chapter 7 notes"
    Session: "Practice integration problems"

Long-term:  "Write my novel"
  Process:  "2 writing sessions every morning"
    Session: "Draft chapter 3 opening"
    Session: "Edit yesterday's pages"
```

**How this flows through the system:**
- App manages all three levels (create, edit, track, visualize)
- Device caches process goals + displays session intention text
- Widget shows process goals with today's progress
- Stats roll up at every level: "45 sessions toward 'Get strong at calculus' this month"

### Pre-session (in the app — under 30 seconds)

The user opens the app when they're ready to focus. If the pre-session flow takes more than 30 seconds, the app has become the distraction.

**What they see:**
- **Today's process goals** — 3-5 active process goals, each with progress ("Study calculus — 1/3 sessions today"), grouped under their long-term goals
- **Quick stats** — current streak, sessions completed today, total focused time today. Visible immediately, not buried in a dashboard. This is the "evidence that structure is working."
- **Start session button** — prominent

**What they do:**
1. Pick which process goal (or accept the app's suggestion based on what's unfinished)
2. Optionally set a session intention — one sentence: "Finish problem set 4." This is the text that shows on the device screen during focus.
3. Hit start. Put the phone down.

### During session

**Device users:** Phone should be away. Device shows goal text + countdown. If the app is open, it shows a minimal screen: "Focus session in progress. Put your phone down." (If the user keeps opening the app during sessions, surface that pattern in post-session reflection.)

**Software-only users:** App shows the timer, but the design still pushes phone-down habits:
- Minimal UI — just countdown + goal text. No navigation, no stats, no feeds.
- Do-not-disturb integration — prompt to enable DND when session starts
- Lock screen widget updates with countdown (no need to unlock to check time)
- "Flip to focus" suggestion — encourage placing phone face-down

**Key principle:** Even for software-only users, the app makes itself *boring* during a session. The timer is there because it has to be, but nothing else invites interaction.

### Post-session (the highest-leverage moment)

The user just finished a focused block. They feel good. This moment is emotionally charged and serves two purposes: **reinforcement** (acknowledging the accomplishment strengthens the habit loop) and **reflection** (brief check-in builds self-awareness over time).

**Step 1: Completion acknowledgment (automatic, ~2 seconds)**
- "Session complete. 25 minutes focused on: Study calculus."
- Updated count: "3/5 sessions today" or "45 minutes focused today"
- Streak update if relevant: "Day 12"

**Step 1 (abandoned): Abandonment reason (~3 seconds)**
- If the user stops a session early, ask: **"Had to stop"** (extenuating — excluded from success rate) or **"Gave up / lost focus"** (counts against success rate). See Section 10 for full abandonment logic.

**Step 2: Quick reflection (optional, ~10-15 seconds)**
- One question: **"How was your focus?"** — three options: Locked in / Decent / Struggled
- If "Struggled": one follow-up — **"What pulled you away?"** — quick-tap options: Phone, People, Thoughts wandering, Got stuck on the task, Other
- Two taps max. No journaling. No open-ended text (unless they want to add a note).

**Step 3: Next action (~5 seconds)**
- "Start another session?" (same goal or pick different)
- "Take a break" (starts break timer — 5 min short, 15-20 min long after 4 sessions)
- "Done for now" (closes the flow)

**Step 3b: Post-break check-in (after break ends, before next session)**
- "Was that break helpful?" — Yes / Somewhat / No. Feeds into break usefulness analytics (see Section 10).

**What happens in the background:**
- Session record uploads to cloud (timestamp, duration, goal, completed/abandoned, abandonment reason, focus rating, distraction type, break usefulness)
- Device syncs buffered sessions if phone is in BLE range
- Data feeds into pattern tracking over time (see Section 10 for full analytics design)

> **Research note (session intervals):** Biwer et al. (2023) — 87 students, *British Journal of Educational Psychology* — found that systematic breaks (both Pomodoro 24/6 and shorter 12/3) produced higher concentration, motivation, and lower perceived task difficulty vs. self-regulated breaks, with no difference in total task completion. A 2025 scoping review (PMC, N=5,270) confirms systematic Pomodoro-style intervals consistently outperform self-paced work. **This confirms:** (1) the break structure is essential and must not be optional/skipped; (2) the exact interval (25 vs. 50 minutes) is less critical than the systematic structure itself — offering interval presets is research-backed.

> **Research note (abandonment tone):** Sirois & Pychyl (2013) confirm that self-criticism after procrastination reinforces avoidance rather than correcting it. The non-judgmental abandonment framing ("Had to stop" / "Gave up / lost focus" as data, not shame) is evidence-based. Wohl, Pychyl & Bennett (2010) show self-forgiveness after past procrastination *reduces* future procrastination. The completion acknowledgment step should be warm regardless of session outcome.

---

## 7. Pricing Model

### Free tier — complete product, local data

- Timer works (app and device)
- Goals work (create, track, sync to device via BLE)
- Post-session reflection works
- Local data on device and app
- Basic stats: today's sessions, current streak

### Paid tier — cloud sync + deep insights (subscription)

- Cross-device sync (phone ↔ web ↔ device, all through the cloud)
- Full history and pattern tracking (weekly trends, time-of-day analysis, goal completion rates)
- Data export
- Eventually: social features, accountability partners

**Why this split works:** A free user gets a complete Pomodoro + goals + reflection experience. They hit the upgrade moment naturally — "I've been using this for 3 weeks, I want to see my trends across devices" — rather than hitting a wall on basic functionality. The paywall gates *convenience and depth*, not *core value*.

---

## 8. Onboarding — First 60 Seconds to First Session

### Entry points — not just the app store

The user's first experience is NOT necessarily a mobile download. They could:
- Download from App Store / Google Play (mobile)
- **Open it in a web browser** — no install, no download, just a URL (desktop or mobile)
- Get sent a link by a friend

The onboarding flow must work identically across all entry points. The web version is especially important: zero-friction, open a URL and go. For web users without an account, session data and goals persist via browser local storage (cookies / localStorage) until they sign up.

### Step 1: The hook (~5 seconds)

One screen. No sign-up. No account creation.

> "Build structure when your environment doesn't. Set a goal. Start a session. Put your phone down."

Big button: **"Get started"**

### Step 2: First goal (~20 seconds)

Structure seekers cluster around common goals. Pre-built templates remove the blank-page problem — one tap instead of typing. But the option to type a custom goal is always visible.

Screen says:
> "What do you want to make progress on?"

**Pre-built templates (tap to select):**

| Template | Long-term goal created | Default process goal |
|----------|----------------------|---------------------|
| Studying | "Stay on top of [my classes]" | "3 study sessions/day" |
| Working out | "Build a consistent fitness habit" | "1 workout session/day" |
| Side project | "Build [my project]" | "2 deep work sessions/day" |
| Reading | "Read more consistently" | "1 reading session/day" |
| Writing | "Write consistently" | "2 writing sessions/day" |
| Learning a skill | "Learn [skill]" | "2 practice sessions/day" |

- User taps a template → bracketed parts become editable (e.g., "my classes" → "calculus"). Process goal session count is pre-filled but adjustable with +/-.
- **"Something else"** — always visible below templates. Opens a text field for fully custom goal input.
- Result: one long-term goal + one process goal. App is now functional. Add more goals later.

### Step 3: Timer preference (~10 seconds)

> "How long do you like to focus?"

- **25 / 5** — "Classic Pomodoro" (default, highlighted)
- **50 / 10** — "Deep work"
- **Custom** — user sets their own

### Step 4: Device check (~5 seconds)

> "Do you have a PomoFocus device?"

- **Yes** → BLE pairing flow (scan, connect, goals sync to device, confirm display). Adds 30-60 seconds.
- **No** → Skip entirely. No upsell. Subtle line: "You can pair a device anytime in Settings."

### Step 5: Widget prompt (~10 seconds, mobile only)

> "Add PomoFocus to your lock screen so your goals stay visible without opening your phone."

Visual guide showing how to add the iOS/Android widget (system-level action, app can't automate).

- **Web users:** Skip this step — not relevant.
- **If skipped:** Remind once after 3rd session: "Want your goals on your lock screen?"

### Step 6: First session — immediately

> "Ready? Your first session: [Goal name]. 25 minutes."

**Start** button. They're in. No more screens between them and focusing.

### Step 7: Account creation (deferred)

No sign-up before the first session. Everything works locally (or in browser storage for web).

After 1-2 completed sessions, prompt:
> "Create a free account to save your progress."

Or on return visit (web): "Sign up so you don't lose your sessions."

Value-first, account-later. User has experienced the product before being asked to commit.

### What is NOT in onboarding (deliberate)
- No account/sign-up (deferred to after first session)
- No full goal hierarchy setup (just one long-term + one process — add more later)
- No tutorial or feature walkthrough (learn by doing)
- No settings beyond timer length
- No social features or sharing prompts
- No payment or plan selection

### Time to first session

| Entry point | Time | Notes |
|-------------|------|-------|
| Web browser | ~40 seconds | No install, no widget step |
| Mobile, software-only | ~50-60 seconds | Includes widget prompt |
| Mobile + device | ~90-120 seconds | Adds BLE pairing |

**Principle:** Get the user into their first focus session as fast as possible. Everything else can wait. The product proves itself through the experience, not through explanation.

---

## 9. Social Features — Accountability Without Comparison

### Design philosophy

Social features in PomoFocus follow one rule: **encourage through presence, never pressure through numbers.** The research is clear — social accountability (knowing someone is working alongside you) increases focus time by up to 87% (Stanford). But social comparison (leaderboards, public stats, visible rankings) correlates with anxiety, guilt, and worse long-term adherence.

PomoFocus is not a social network. It's a focus tool where knowing your friends are also putting in work makes you more likely to show up.

**Core principles:**
- Goals are always private. Nobody sees what you're working on unless you choose to share.
- No numbers are visible to others. No session counts, no hours, no streaks shown publicly.
- Encouragement is private — only the recipient knows. No public kudos counts.
- No feeds, no algorithms, no engagement optimization. Social features serve focus, not attention.

### v1 social features

**1. Add friends**
Foundation for everything else. Simple friend system — search by username or share an invite link. No follower/following asymmetry. Friendships are mutual (both must accept).

**2. Library Mode (presence signals)**
A small indicator showing which of your friends are currently in a focus session. Like glancing across a library and seeing your friend at another table — no interruption, just awareness.

- Shows a dot or subtle status next to friend's name: "focusing" / "on break" / "offline"
- No details about what they're working on or how long they've been going
- Seeing a friend focusing creates gentle social motivation: "they're working, maybe I should too"

**Why this works:** Focusmate proved that just *seeing* another person working changes behavior. Body doubling — the presence of someone doing tasks alongside you — is one of the strongest accountability mechanisms, especially for people who struggle with self-structure. Library Mode is async body doubling.

**3. Quiet Feed ("Krish focused today")**
Friends see that you completed focus sessions — but not how many, not how long, not what goal. Just evidence of effort.

- Feed entry: "[Name] focused today" — that's it. One entry per day max, no matter how many sessions.
- No timestamps, no session counts, no streaks. You see that your friend showed up. Not whether they did 1 session or 10.
- Inspired by BeReal's anti-comparison design: sharing without showing off.

**Why this works:** The user sees their friends putting in work and feels motivated to do the same — "damn, Sarah's been consistent" — without the toxic comparison of knowing exactly how much. The absence of numbers is deliberate. You can't feel "behind" if there's no metric to measure against.

**4. Encouragement tap (private kudos)**
When you see a friend in the quiet feed or in Library Mode, you can tap once to send encouragement. One tap. No text, no emoji picker, no comments.

- The recipient sees: "[Name] sent you encouragement" — a private notification.
- **Nobody else sees how many encouragements anyone received.** No counts, no popularity signals. Completely invisible to everyone except the recipient.
- There is no way to see who *didn't* get encouragement. No absence signal.

**Why this works:** Strava's kudos system drives massive engagement (14B+ kudos given) because it celebrates effort, not performance. PomoFocus takes it further by making kudos counts invisible — removing even the possibility of comparison.

**5. Invite link (growth + social proof)**
One-tap shareable link: "Focus with me on PomoFocus." Share via iMessage, WhatsApp, text, whatever. The friend clicks the link, lands on the web version, and can start a session in 40 seconds (no install required).

- This is both a social feature and a growth mechanism. Friend-to-friend sharing is how Forest and Study Together scaled.
- The social proof of "my friend uses this and they've been getting things done" is more powerful than any ad.

### Backlog (post-v1, needs more design thinking)

These features are promising but require more complexity and will be revisited after v1 launches and we have real user feedback.

**Shared sessions ("Focus with me" / ambient join)**
Two friends focus at the same time with a shared timer. Not video — just a shared commitment. A friend can also join mid-session without any interruption to the person already focusing. The original user is only notified *after* their session ends: "Sarah joined your session and focused for 18 minutes."

- No punishment for quitting early (unlike Forest's tree-dying mechanic). Gentle, not punitive.
- The mid-session join is the key differentiator: it's like silently sitting down next to your friend in a library.

**Study Crew (private group goals)**
Small private groups (2-5 people) set a shared weekly commitment ("We'll each do 15 sessions this week"). The group sees a collective progress bar — not individual breakdowns. Goals remain private. The group shares commitment to showing up, not what they're working on.

**Weekly reflection card (opt-in sharing)**
The app generates a personal weekly summary — qualitative, not quantitative. "You focused on 3 different goals this week. Your best day was Tuesday." Users can optionally share this card with friends. Like Spotify Wrapped: private by default, shareable by choice. No raw numbers — just narrative.

**Real-world impact (session donations)**
Focus sessions translate into something tangible — trees planted, study hours donated, etc. Forest partnered with Trees for the Future and it became one of their strongest retention hooks. Requires partnerships and logistics — clearly post-launch.

### What social features PomoFocus will NEVER have
- Public leaderboards or rankings
- Visible session counts, hours, or streaks on profiles
- Public kudos/like counts
- Algorithmic feeds or engagement optimization
- Comments or messaging within the app (use your existing messaging apps)
- "Top focuser" badges or competitive rankings
- Any feature where seeing someone else's numbers could make you feel "behind"

### Where social features live in pricing

Social features are **free**. Adding friends, Library Mode, Quiet Feed, kudos, invite links — all free tier. Social accountability is core to the product thesis (portable structure), not a premium upsell. Putting social behind a paywall would kill the network effect that makes these features work.

---

## 10. Analytics & Insights — What We Track and Why

### Design philosophy

The insight is the product. The timer is just the data collection mechanism. Existing Pomodoro apps treat the timer as the product — they stop at "you did 4 sessions today." Users have no idea *why* some days feel productive and others don't. PomoFocus surfaces patterns that help users set themselves up to succeed.

**Principles:**
- **Insights over data** — never show a raw table. Every number must answer a question the user actually has.
- **Automatic over manual** — minimize user input. Most data points are captured without the user doing anything.
- **Goal-centric, not session-centric** — stats roll up to goals, not just calendar days.
- **Process goals over outcome goals** — "Did I show up?" matters more than "Did I finish?"
- **Non-judgmental tone** — the app observes and reflects, never scolds.

### Raw data captured per session

Eight data points per session, most automatic. The user actively provides at most two.

| Data point | Source | How captured |
|-----------|--------|-------------|
| **Timestamp** (start + end) | Automatic | Timer start/stop |
| **Session duration** | Automatic | Calculated from timestamps |
| **Goal/task associated** | User selects before starting | Goal picker (pre-session) |
| **Completed vs. abandoned** | Automatic + user input | See abandonment logic below |
| **Focus quality rating** | Post-session reflection | "Locked in / Decent / Struggled" |
| **Distraction type** (conditional) | Post-session reflection | Only shown if user reports "Struggled" — "Phone / People / Thoughts wandering / Got stuck / Other" |
| **Process goal hit** | Automatic | Did they complete the number of sessions they committed to today? |
| **Break taken vs. skipped** | Automatic | Did they take the break or skip to next session? |
| **Break usefulness** (conditional) | Post-break reflection | After break ends, before next session starts — "Was that break helpful?" — Yes / Somewhat / No |

### Abandonment logic and success rate

**Success rate = sessions completed / sessions started**, expressed as a percentage. But not all abandoned sessions count against the user.

When someone stops a session early, we ask why:

- **"Had to stop"** (extenuating circumstances — meeting pulled in, emergency, life happened) → Session is **excluded entirely** from success rate. Not counted as started, not counted as completed. Life happening to you is not a failure.
- **"Gave up / lost focus"** → Counts as started but **not completed**. This hits the success rate.

This means the success rate only measures intentional follow-through, not external circumstances. If you start 10 sessions, abandon 2 because you lost focus, and cancel 1 because of a fire alarm, your success rate is 8/10 (80%) — the fire alarm session doesn't exist in the calculation.

### Post-session reflection flow (updated)

**Step 1: Focus quality (always shown, ~5 seconds)**
- "How was your focus?" — Locked in / Decent / Struggled

**Step 1b: Distraction type (only if Struggled, ~5 seconds)**
- "What pulled you away?" — Phone / People / Thoughts wandering / Got stuck / Other

**Step 2: Break (if taking a break)**
- Break timer runs (5 min short / 15-20 min long after 4 sessions)

**Step 2b: Break usefulness (after break ends, before next session starts)**
- "Was that break helpful?" — Yes / Somewhat / No

This keeps post-session input to two taps max on good sessions, three taps max on struggled sessions, and adds one question after breaks.

### Derived metrics (computed from raw data)

These are never stored per session — they're calculated across sessions automatically.

| Metric | Calculated from | Timeframe |
|--------|----------------|-----------|
| **Daily completion rate** | Sessions completed / sessions started (excluding extenuating abandonments) | Per day |
| **Goal-level completion rate** | Sessions completed per goal / sessions started per goal | Per goal, rolling |
| **Focus quality distribution** | % of sessions rated locked in / decent / struggled | Weekly + monthly |
| **Distraction frequency by type** | Count of each distraction type across struggled sessions | Weekly + monthly |
| **Best time of day** | Focus quality ratings grouped by hour of day | Rolling 4 weeks |
| **Best days of week** | Focus quality ratings grouped by day of week | Rolling 4 weeks |
| **Consistency rate** | Days with at least one session / total days in period | Weekly + monthly |
| **Break usefulness patterns** | Correlation between break ratings and subsequent session quality | Rolling 4 weeks |
| **Focus Score** (composite) | Weighted blend of: self-reported quality (primary), completion rate, consistency, trend direction | Daily, recalculated |

### Insight tiers — how data reaches the user

**Tier 1 — Glanceable (home screen, always visible)**

Information the user sees every time they open the app, without navigating anywhere.

- Today's progress: "2/3 sessions done"
- Focus Score: single composite number (the headline metric)
- Total focus time this week: "3h 45m this week"
- Success rate this month: "82%"

**Tier 2 — Weekly insight card (surfaced proactively)**

The app generates this weekly and pushes it to the user — they don't have to go looking for it.

- Best and worst days of the week + best times of day
- Distraction patterns: "Phone was your #1 distraction this week (4 of 6 struggled sessions)"
- Goal-level progress and trends: "You're averaging 2.3 sessions/day on calculus, up from 1.8 last week"
- Break usefulness patterns (if enough data): "You rate breaks helpful 80% of the time — and sessions after rated-helpful breaks are 'locked in' 60% more often"

**Tier 3 — Monthly deep view (goal-centric, user pulls)**

Available in a dedicated stats/insights section. The user navigates here when they want to go deep.

- Goal-by-goal breakdown: sessions, completion rate, focus quality per goal
- Focus quality trends over time: are you getting better?
- Distraction evolution: are the types of distractions changing?
- Break correlation insights: how break behavior relates to focus quality
- Session length insights: do you focus better in 25-minute or 50-minute blocks?
- Best/worst time and day patterns over a longer window

### Focus Score (composite metric)

A single number that answers "how's my focus going?" without the user needing to interpret multiple charts. Weighted blend of:

1. **Self-reported focus quality** (primary weight) — the user's own assessment matters most
2. **Completion rate** — are you finishing what you start?
3. **Consistency** — are you showing up regularly?
4. **Trend direction** — are things getting better or worse?

Exact weights need tuning with real user data. The score should feel intuitively right — if a user had a great focus week, the number should reflect that without them needing to check the formula.

### Open questions (analytics)

- **Focus Score weighting** — needs calibration with real usage data. Initial weights are a hypothesis.
- **Break usefulness** — new metric with no precedent in other Pomodoro apps. Worth tracking to see if actionable patterns emerge. If it turns out to be noise, we can remove the question.
- **Cold start problem** — how many sessions before insights become meaningful? Need to define minimums (e.g., "weekly insights require at least 5 sessions that week") and show appropriate messaging before that threshold.

> **Research note (cold start):** Lally et al. (2010) found that habit automaticity takes 18–254 days (mean 66 days) and that exercise-type behaviors take ~1.5x longer than simple habits. Focus sessions are exercise-complexity behaviors. This means: (1) minimum thresholds for "weekly insights" should be ≥5 sessions / ≥3 weeks before monthly patterns surface; (2) the product must be intrinsically rewarding for 3–9+ months before the habit feels automatic for most users; (3) the 66-day mark is worth surfacing explicitly as a milestone ("You've been showing up for 66 days — research says this is where structure starts to feel automatic").

---

## 11. Opportunity Solution Tree (Phase 3)

### Desired Outcome
> Create portable structure so I follow through on my goals instead of losing time to my phone.

### Opportunity Map

```
Desired Outcome: Create portable structure so I follow through
                 on my goals instead of losing time to my phone

├── Opportunity D (PRIMARY): Distraction triggers a guilt → avoidance →
│   more distraction spiral that compounds over time
│   │
│   │   Core insight: In the moment of craving, the user can't FEEL
│   │   the future reward of focusing — even though they know it exists.
│   │   The dopamine pull is immediate; the satisfaction is abstract.
│   │
│   ├── ★ Surface cumulative personal evidence — show all progress made
│   │     across sessions, goals, and streaks. "Look at everything you've
│   │     built" is harder to argue with than "remember last Tuesday."
│   ├── ★ Reward the act of STARTING, not finishing — immediate positive
│   │     feedback at the moment of highest resistance (competing with
│   │     the dopamine hit from other apps)
│   └── Own satisfaction numbers — "You rated 9/10 after your last 5
│         sessions" (concrete, personal, inarguable)
│
├── Opportunity A (PAIRED): Goals are invisible when structure disappears
│   ├── Lock screen / home screen widget (goal always visible)
│   ├── Physical device on desk showing current goal
│   └── Push notifications tied to process goal schedule
│
├── Opportunity E (SUPPORTING): No social accountability for solo focus
│   ├── Library Mode (presence signals — friends are focusing)
│   ├── Quiet Feed ("Krish focused today" — no numbers)
│   └── Encouragement tap (private kudos)
│
└── Opportunity B (DESIGN PRINCIPLE): The focus tool lives on the
    distraction device
    ├── Physical device replaces phone during sessions
    └── Minimal UI during sessions (don't compete with distraction apps)
```

### Focused Opportunity

**D + A together: Break the spiral by making accumulated progress visible at the moment of craving.**

The physical device on the desk is itself a progress artifact — "I own this because I'm someone who focuses." The app surfaces cumulative evidence (sessions completed, goals advanced, streaks maintained, personal satisfaction ratings) so the user can *see* the person they're becoming, not just intellectually know it.

The intervention has two parts:
1. **Cumulative progress as craving antidote** — when the user is tempted to scroll, the evidence of everything they've built is visible (widget, device, app home screen). Not motivational quotes — their own data.
2. **Reward starting, not finishing** — the dopamine hit comes at session start (immediate feedback, acknowledgment), not 25 minutes later. This competes directly with the craving for other apps.

> **Research note:** Sirois & Pychyl (2013) confirm that procrastination is an emotion-regulation failure — the guilt spiral is real, self-reinforcing, and worsened by self-judgment. Self-compassion (Sirois & Pychyl) and self-forgiveness (Wohl, Pychyl & Bennett 2010) are the empirically-supported counter-interventions. This **confirms** both parts of the intervention: (1) cumulative evidence ("look at what you've built") reduces the perceived cost of starting by increasing self-efficacy; (2) rewarding the act of starting directly addresses the highest-resistance emotional moment. The non-judgmental tone is not a stylistic preference — it is evidence-based design that will measurably reduce procrastination vs. a punitive alternative.

### Riskiest Assumption

**Users will complete post-session reflections consistently enough to build a useful dataset.**

Mitigating factors:
- **Self-selection**: the target user actively wants to change. Someone who buys a physical focus device is signaling serious intent — they'll do a 2-tap reflection.
- **Minimal friction**: reflection is 2 taps max on good sessions (focus rating + next action). No journaling, no open-ended text.
- **The data is the product**: users see their own numbers played back to them. The more they reflect, the more powerful the craving intervention becomes. The feedback loop is self-reinforcing.

### Design Implications

These opportunity findings refine several existing sections of the brief:

1. **Post-session reflection (Section 6)** is now understood as a *data collection mechanism* for the craving intervention, not just a self-awareness exercise. This raises its priority.
2. **Focus Score and analytics (Section 10)** serve double duty: they're both an insight tool AND the ammunition for breaking the guilt spiral. The Tier 1 glanceable stats ("82% success rate", "45 sessions this month") are the craving antidote.
3. **The widget (Section 6)** isn't just a convenience — it's the primary touchpoint for the craving moment. It should show cumulative progress prominently.
4. **The physical device** is the strongest version of this intervention: a tangible object on your desk that represents your commitment and progress. It breaks the scroll trance through a different sensory channel.
5. **Tone must be non-judgmental everywhere.** The app observes and reflects accumulated progress — it never scolds. "Look at everything you've built" not "you scrolled for 40 minutes." (Research basis: Sirois & Pychyl 2013; Wohl et al. 2010 — self-judgment reinforces procrastination; self-compassion and self-forgiveness reduce it.)

---

## 12. v1 Shape — Fixed Boundaries (Phase 4)

### Appetite

No fixed calendar deadline — but a fixed *scope*. The shape below is the ceiling, not the floor. If something isn't listed, it's not in v1. Period.

### What's in the box

**Platforms:**
- iOS (native via Expo/React Native)
- Web (Next.js — zero-friction entry point, shareable URL)
- ESP32 physical device (BLE sync)
- Android is NOT in v1

**Core loop (must ship — this is the product):**
1. **Three-layer goal model** — long-term goals → process goals → session intentions. Create, edit, track in app. Process goals + session intentions sync to device.
2. **Timer** — Pomodoro timer in app (software-only users) and on device (device users). Configurable intervals (25/5, 50/10, custom).
3. **Post-session reflection** — 2-tap flow: focus quality (locked in / decent / struggled) + distraction type (if struggled). Break usefulness question after breaks.
4. **Cumulative progress surfaces** — widget (iOS lock screen / home screen), app home screen, device idle screen. Shows: sessions today, streak, success rate, total focus time. This is the craving intervention.
5. **BLE device sync** — goals push from app → device. Completed sessions push from device → app. Eventual consistency (works offline, syncs when in range).
6. **Cloud sync** — all data syncs across iOS + web via Supabase. Free for all v1 testers (no paywall).
7. **Accounts** — Supabase Auth. Deferred sign-up (after first session). Free cloud sync for all users in v1.

**Analytics (must ship):**
- Tier 1 glanceable stats (home screen): sessions today, Focus Score, weekly focus time, success rate
- Tier 2 weekly insight card (pushed proactively): best/worst days, distraction patterns, goal-level progress
- Tier 3 monthly deep view: goal-by-goal breakdown, focus quality trends, distraction evolution
- Focus Score composite metric (self-reported quality + completion rate + consistency + trend)
- Abandonment logic with "had to stop" vs. "gave up" distinction

**Social (must ship):**
- Add friends (mutual, symmetric)
- Library Mode (presence signals — who's currently focusing)
- Quiet Feed ("Krish focused today" — one entry per day, no numbers)
- Encouragement tap (private, one-tap kudos, invisible counts)
- Invite link (shareable URL, friend lands on web version)

**Onboarding (must ship):**
- 60-second flow as designed in Section 8
- Goal templates (studying, working out, side project, reading, writing, learning a skill)
- Timer preference selection
- Device pairing (if applicable)
- Widget prompt (iOS)
- Deferred account creation

### What's NOT in the box (explicit no-go's)

| Feature | Why not v1 |
|---------|-----------|
| **Android** | Expo makes it possible but triples QA. Ship iOS + web first, add Android when the core loop is proven. |
| **Shared sessions / ambient join** | Requires real-time session state sync between users (WebSockets). Significant infrastructure beyond the v1 social features. Post-v1. |
| **Study Crew (group goals)** | Needs more design thinking. Group dynamics are complex. Post-v1. |
| **Weekly reflection card (shareable)** | Nice retention feature but not core. Post-v1. |
| **Session donations (trees planted, etc.)** | Requires partnerships. Post-v1. |
| **Payment / subscription billing** | Everyone gets full access free in v1. Paywall comes when we know what people value enough to pay for. |
| **Mac menu bar widget** | SwiftUI + WidgetKit is a separate native project. Post-v1. |
| **VS Code extension** | Post-v1. |
| **Claude Code MCP server** | Post-v1. |
| **Data export** | Post-v1. |
| **Accessibility / i18n** | v1 is English-only; accessibility follows iOS/web platform defaults. |
| **Haptic/audio feedback on device** | Device v1 is visual only (display + buttons). Buzzer for timer end is a maybe. |
| **E-ink display** | Start with OLED (LILYGO T-Display S3). E-ink adds complexity for v1 prototype. |

### Rabbit holes (time sinks to watch for)

These are areas where scope can silently expand. Set a time limit and move on if stuck.

1. **BLE reliability** — Bluetooth is notoriously finicky. Define "good enough" sync: goals update within 30 seconds of phone being in range. Don't chase 100% reliability. Retry logic + local cache handles the rest.
2. **Focus Score weighting** — Don't over-engineer the formula before having real data. Ship with simple equal weights, tune later with actual user sessions.
3. **Widget design** — iOS widgets have strict size/update constraints. Don't fight the platform. Ship a simple widget that shows streak + today's progress. Iterate on design after launch.
4. **Goal template UX** — The template picker is 20 seconds of onboarding, not a product in itself. Don't build a template editor or let users create/share templates. Six hardcoded templates + "something else."
5. **Device enclosure** — The device is a bare dev board for v1. No 3D printing, no case design. If testers complain about aesthetics, that's v2.
6. **Real-time presence (Library Mode)** — Can be polling-based (check every 30-60 seconds) rather than true WebSocket real-time. "Focusing" status doesn't need sub-second accuracy.
7. **Offline-first architecture** — Local-first with background sync is the right architecture but can become an endless rabbit hole. Use Supabase's built-in real-time sync. Don't build a custom CRDT.

### De-risking order (build this sequence)

Build in the order that retires the biggest risks first:

1. **Data layer + cloud sync** — Supabase schema, auth, real-time sync. If this doesn't work, nothing works.
2. **Core timer + goal model** — The atomic unit. Timer runs, sessions record, goals track.
3. **Post-session reflection** — Data collection mechanism for the core thesis. Without this, no insights.
4. **Cumulative progress surfaces** — Widget + home screen stats. This IS the product differentiator.
5. **BLE device sync** — Prove the phone-away thesis. This is the riskiest technical piece.
6. **Device firmware** — ESP32 timer + goal display + local storage + BLE.
7. **Analytics & insights** — Tier 1 → Tier 2 → Tier 3. Each tier is independently valuable.
8. **Social features** — Friends → Library Mode → Quiet Feed → kudos → invite link. Each layer builds on the previous.
9. **Onboarding** — Build last. Onboarding for a product that doesn't exist yet is wasted work.

### Success criteria for v1

v1 is done when 10-20 testers can:
- [ ] Create goals, run sessions, and see their cumulative progress on iOS or web
- [ ] Pair a physical device that displays their goal and runs a timer independently
- [ ] See sessions from the device appear in the app after BLE sync
- [ ] Get a weekly insight card showing their focus patterns
- [ ] Add friends and see who's currently focusing (Library Mode)
- [ ] Open a shared link and start a session in the web browser in under 60 seconds

---

## 13. Research Threads — Findings

These threads were flagged during discovery as needing verification before finalizing the solution design. Findings below, with direct PomoFocus implications.

**v1 relevance:** Threads 1 (commitment devices) and 7 (guilt-productivity cycle) directly validate the core thesis and should inform v1 design decisions. Threads 2 (goal salience) and 3 (environmental design) support the widget and device rationale. Threads 4 (habit timelines), 5 (screen time intervention), and 6 (Pomodoro efficacy) are useful background but won't change what gets built for v1.

---

### Thread 1: Present Bias & Commitment Devices

**Key question:** What commitment device types have the highest adherence rates?

**Findings:**

1. **Ariely & Wertenbroch (2002)** — Students who self-imposed deadlines before the final deadline outperformed students with maximum flexibility, completing fewer tasks late and scoring higher overall. Precommitment works even at low stakes because the act of choosing to constrain future behavior reframes failure. *(Psychological Science)*

2. **Bryan, Karlan & Nelson (2010)** — Commitment devices increase adherence across health, finance, and education contexts. Public commitment outperforms private commitment: observability is a key multiplier — when others can see your commitment, both demand and follow-through increase significantly. *(Annual Review of Economics)*

3. **StickK platform data** — Users who tied financial penalties to their goals were 60 percentage points more likely to report success. StickK users overall are ~3x more likely to achieve their goals than non-users. The highest-performing contracts combine financial stakes + a referee + social visibility — each element compounds the effect.

4. **Exley & Naecker (HBS, 2021)** — Observability increases both the demand for and the effectiveness of commitment devices. Making a commitment observable (to others, or to a physical environment) significantly strengthens follow-through.

> **→ PomoFocus implication:** The physical device IS the commitment device. Purchasing it is an observable act of precommitment — it signals intent to self and environment. The social layer (Quiet Feed, streak sharing) amplifies this through partial social visibility. Onboarding should reinforce the framing: "You've already made the commitment. Now let's keep it."

---

### Thread 2: Goal Salience & Implementation Intentions

**Key question:** How frequently must goals be visible to maintain motivation?

**Findings:**

1. **Gollwitzer (1999)** — Implementation intentions ("If [situation], then [behavior]") significantly improve goal attainment vs. goal intentions alone. Meta-analysis of 94 studies (N > 8,000) showed a medium-to-large effect on goal attainment (d = 0.65). The mechanism: forming an implementation intention activates the cue-situation representation, making it highly accessible — users *notice* and *act on* the cue automatically when it occurs. *(American Psychologist)*

2. **Gollwitzer & Sheeran (2006)** — Implementation intentions bridge the intention-action gap by delegating control from conscious deliberation to automatic cue-response links. The goal doesn't need to be consciously recalled — the environment recalls it.

3. **Visual cue specificity** — Environmental cues (objects in the visual field, time-of-day triggers, specific locations) are more reliable habit triggers than memory-based reminders. The more specific the cue, the stronger and faster the habit loop forms.

> **→ PomoFocus implication:** The widget is not a convenience feature — it *is* the implementation intention made visible. Seeing "Study calculus — 0/3 sessions today" the moment you pick up your phone creates the "if [pick up phone], then [focus on calculus]" trigger. The physical device on the desk is an even stronger implementation intention: it replaces the phone as the cue-object in the environment. Goal visibility doesn't need manual optimization — it happens automatically because both the widget and device are always present.

---

### Thread 3: Environmental Design & Phone Usage

**Key question:** What specific environmental changes most reduce phone usage?

**Findings:**

1. **Ward et al. (2017)** — The mere presence of a smartphone on a desk reduces available cognitive capacity, even when face-down and silenced. Effect was largest for high-dependency users. *(Journal of the Association for Consumer Research)* **Note:** A 2022 replication study did not reproduce the effect, so this should be cited with caution — but the directional logic (phone in field of view = cognitive resource consumption) remains consistent with broader attention research.

2. **Kanjo et al. (2022 RCT)** — A nudge-based intervention testing 10 environmental strategies (greyscale display, notification disabling, app restructuring, phone-free zones) reduced problematic smartphone use, screen time, and anxiety after 2 weeks in two independent studies (N=51, N=70). Environmental restructuring outperformed willpower-based approaches. *(IJMHA)*

3. **PNAS Nexus (2025)** — Blocking mobile internet on smartphones improved sustained attention, mental health, and subjective well-being. Critically, the mechanism was *reduced attractor pull* from fewer competing stimuli — not willpower suppression. Removing the pull is more effective than resisting it.

4. **James Clear (Atomic Habits, 2018)** — Environmental design operationalized: friction is the primary lever. Making the desired behavior one tap away and the undesired behavior require physical effort (phone in another room) compounds over time. Environment beats intention.

> **→ PomoFocus implication:** The core product thesis is well-grounded in evidence. Removing the phone from the desk during sessions isn't just intuitive — it's supported by multiple lines of research. The device's job is to replace the phone as "the thing you reach for." For software-only users, the app must make itself maximally boring during sessions (minimal UI, DND integration, lock screen widget) to reduce the pull toward distraction apps.

---

### Thread 4: Habit Formation Timelines

**Key question:** How long before a "structure seeker" internalizes the structure?

**Findings:**

1. **Lally et al. (2010)** — Mean time to habit automaticity was 66 days, but the range was 18–254 days — a 14x spread. Exercise behaviors took ~1.5x longer to automatize than simple eating/drinking behaviors. Missing a single day did not significantly set back formation. *(European Journal of Social Psychology)*

2. **The variance is the finding** — "66 days" is a statistical mean of a wide, skewed distribution. Some users will form the focus habit in 3 weeks; others will need 8+ months of consistent structure. Any product that treats day 66 as an endpoint misunderstands the data.

3. **Focus behavior complexity** — Session-based focus habits (structured Pomodoro work) are closer to exercise behaviors than simple habits in terms of cognitive and behavioral complexity. This pushes the realistic automaticity timeline toward 2–3 months for most users, with some taking much longer.

> **→ PomoFocus implication:** The analytics cold-start threshold must be designed with patience. "Weekly insights" require ≥5 sessions that week; monthly patterns require ≥3 weeks of data. The product must be rewarding long before the habit is automatic — the first 3 weeks are critical for retention. Streaks should be forgiving (one missed day shouldn't reset a 30-day streak). The 66-day milestone is worth surfacing: "You've been showing up for 66 days — research says this is where it starts to feel automatic."

---

### Thread 5: Screen Time Intervention — Physical Alternatives

**Key question:** Do physical alternatives to phones reduce screen time?

**Findings:**

1. **Strehle et al. (2025, BMC Medicine RCT)** — A 3-week RCT restricting screen time to ≤2 hours/day (N=111) showed significant improvements in well-being (small-to-medium effect sizes). Sustained screen reduction is achievable in controlled conditions and produces measurable psychological benefit. *(BMC Medicine)*

2. **PNAS Nexus (2025)** — Blocking mobile internet improved sustained attention and mental health. The mechanism was *reduced pull* from fewer competing stimuli — not willpower. This supports product design that reduces the attractor force of the phone, not just adds friction.

3. **Light Phone user experience** — Qualitative data consistently shows that a dedicated, non-smartphone device reduces habitual reach-for-phone behavior. Users report significantly reduced reflexive checking. No peer-reviewed RCT exists specifically on Light Phone 2, but the behavioral mechanism (different object = different habit loop) is consistent with environmental design evidence.

4. **Cultural signal** — The dumbphone movement (r/nosurf, Light Phone 3 sold out, Punkt MP02 waitlist, growing "digital minimalism" community) indicates strong, authentic demand for physical alternatives among a motivated subset. This is the PomoFocus device's early adopter population.

> **→ PomoFocus implication:** The physical device addresses the deepest behavioral lever: replacing habitual reach-for-phone with reach-for-focus-tool. The software-only version reduces screen time through cues (widget, lock screen timer, DND integration) but cannot replicate the sensory replacement the physical device provides. Marketing should be direct: "Your phone stays in your pocket during focus time. This stays on your desk."

---

### Thread 6: Pomodoro Technique Efficacy

**Key question:** Does Pomodoro specifically work, or is any structured interval effective?

**Findings:**

1. **Biwer et al. (2023)** — Compared Pomodoro breaks vs. self-regulated breaks vs. shorter systematic breaks in 87 students across real study sessions. Both systematic break conditions (Pomodoro and shorter) produced higher self-reported concentration, motivation, and lower perceived task difficulty vs. self-regulated breaks. No significant difference in total task completion. The structure matters; the exact interval is secondary. *(British Journal of Educational Psychology)*

2. **Recent scoping review (PMC, 2025)** — 32 studies (N=5,270) found that structured Pomodoro-style interventions consistently improved focus, reduced mental fatigue, and enhanced sustained task performance vs. unstructured self-paced work.

3. **Cognitive capacity window** — Research supports 20–45 minutes as the peak cognitive capacity window for most people. 25 minutes falls comfortably within this range. 50-minute sessions are appropriate for users with trained focus who need deeper work blocks.

4. **Flowtime finding** — Flowtime (work until focus naturally breaks, take a proportional break) shows similar effectiveness to Pomodoro in some studies, suggesting that any systematic approach to breaks outperforms pure self-regulation.

> **→ PomoFocus implication:** The 25/5 default is research-justified. Flexible intervals (25/5, 50/10, 90/20) are also justified — the mechanism is systematic structure, not the specific number. Offering interval presets rather than a locked 25-minute duration is both user-friendly and consistent with the evidence. The "custom interval" feature in the v1 scope is correct. What must *not* be removed is the systematic break structure — free-form timers without enforced breaks are the weakest version of this product.

---

### Thread 7: Guilt-Productivity Cycle

**Key question:** How does post-scrolling guilt affect subsequent productivity?

**Findings:**

1. **Sirois & Pychyl (2013)** — Procrastination is fundamentally an emotion-regulation failure, not a time-management problem. Tasks perceived as unpleasant trigger short-term mood repair (scrolling, avoidance), which provides immediate relief but leads to guilt, shame, and escalating avoidance. The cycle is self-reinforcing: avoidance → guilt → lower self-efficacy → more avoidance. *(Social and Personality Psychology Compass)*

2. **Self-compassion as buffer** — High self-compassion individuals procrastinate significantly less because they don't enter the self-criticism loop that makes starting feel even harder. Self-compassion predicts effective self-regulation and reduces the stress associated with self-blame.

3. **Self-forgiveness reduces future procrastination** — Wohl, Pychyl & Bennett (2010) found that forgiving yourself for past procrastination significantly *reduces* future procrastination; self-criticism *reinforces* it. Punishing users for missed sessions directly worsens outcomes.

4. **The starting problem is emotional, not motivational** — The perceived difficulty of beginning a focus session peaks when negative affect is highest (post-scroll guilt). Reducing the emotional cost of starting — or providing an immediate positive reward at start — directly addresses the hardest moment.

> **→ PomoFocus implication:** The "reward starting, not finishing" mechanic in OST Opportunity D is strongly research-backed. Positive feedback at session start competes directly with the dopamine hit from scrolling and counter-acts the emotional barrier created by guilt. The app's non-judgmental tone is evidence-based design, not just a stylistic choice. The abandonment flow (Section 6) must never shame — even "Gave up / lost focus" should be framed as data to learn from, never as failure.

---

---

## 14. Competitive Landscape

### Focus Apps (on the distraction device)

| Product | What It Does | Why Users Choose It | PomoFocus Advantage |
|---------|-------------|---------------------|---------------------|
| **Forest App** | Gamified phone-down timer — grow a virtual tree during sessions. Social sharing, charity mode. | Visual reward for phone-free time; satisfying completion animation; social bragging | Lives on the phone. No goals. No physical presence. The tree is on the phone you're supposed to put down. |
| **Focus Keeper / Tide** | Pomodoro timers with ambient sounds. Tide adds nature sounds and breathing exercises. | Low friction, beautiful design, ambient sound aids focus | Timer-only. No goal system. No pattern analytics. On the phone. |
| **Opal / One Sec** | App blockers and friction tools — Opal blocks apps on schedule, One Sec adds 1-second delay before opening distraction apps. | Treats the symptom directly; works even without motivation | Treats symptoms (block apps) not cause (no structure or purpose). Willpower-based. No positive replacement for the phone habit. |
| **RescueTime / Toggl Track** | Automatic or manual time tracking across apps and websites. Analytics on where time goes. | Detailed time audit; works in background automatically | Tracks time retrospectively, doesn't create structure prospectively. No goal connection. No behavior change mechanic. |
| **BeTimeful** | Social media blocker with scheduled access windows | Hard limits on social apps; scheduling reduces mindless checking | Blocking-only. No focus structure, no goal system, no positive replacement behavior. |

### Accountability & Social Focus

| Product | What It Does | Why Users Choose It | PomoFocus Advantage |
|---------|-------------|---------------------|---------------------|
| **Focusmate** | Virtual body doubling — book 25- or 50-minute video sessions with a matched accountability partner. 5M+ sessions, 150+ countries. 90% of users report increased focus. | Live social accountability; especially effective for ADHD (152% productivity increase in company survey); structure from external commitment | Requires scheduling a partner in advance; can't start spontaneously; heavy social overhead for light users; no goal system or long-term tracking |
| **Study Together / StudyStream** | Discord-based virtual study rooms (largest study Discord, 24/7). Free. Camera/screen share required for accountability rooms. | Free, always available, ambient social presence, student community | No goal structure; no personal tracking; accountability is ambient not specific; not designed for non-students |
| **Strava** | Social fitness tracking — activities, kudos, segments, clubs. 14B+ kudos given in 2025 (20% YoY). Research shows kudos causally increase running frequency. | Powerful social layer; accountability through audience; 1hr activity per 2min in-app (exceptional ratio) | Fitness-only. But the *kudos model* is the direct inspiration for PomoFocus's Quiet Feed — social validation without comparison metrics. |

### Visual Planning & Scheduling

| Product | What It Does | Why Users Choose It | PomoFocus Advantage |
|---------|-------------|---------------------|---------------------|
| **Tiimo** | Visual planner for ADHD/autism. Visual timers, AI planning, sensory-friendly design, 500K+ users. Apple 2025 iPhone App of the Year. | Purpose-built for neurodiverse users; visual time representation; reduces overwhelm | Planning-focused, not focus-session focused. No accountability mechanic, no social layer, no physical device. Great at "what to do"; not at "doing it." |
| **Structured** | Visual daily timeline planner with icons/colors. 1.5M active users, 4.8/5 App Store. Apple Watch + Mac. | Beautiful visual design; drag-and-drop time blocking; calm aesthetic | Timeline planning, not structured work sessions. No Pomodoro intervals, no focus accountability, no goal hierarchy. Solves the planning problem, not the execution problem. |
| **Todoist / Things 3** | Task management with GTD-style organization. Powerful capture, projects, priorities. | Comprehensive task system; great for complex projects | Task *capture* and *planning*; no focus session structure, no environment change, no behavioral design. The tasks still live on the phone. |

### Physical Timers & Devices

| Product | What It Does | Why Users Choose It | PomoFocus Advantage |
|---------|-------------|---------------------|---------------------|
| **Time Timer** | Visual analog timer — a red disk that shrinks as time elapses. Used in ADHD/autism education, 504 plan accommodation, classrooms. | Tangible time visualization; no screens; works without apps; education-tested | No goal connection. No tracking. No BLE. No app. It's a timer — nothing more. PomoFocus is a system; Time Timer is a tool. |
| **Timeular** | Physical time-tracking die — flip to the face representing your current activity category. App syncs and shows time distribution. | Tactile time tracking; automatic capture; great for freelancers | Tracks time categories, doesn't create structure. No focus blocks, no goals, no distraction-blocking mechanic. Retrospective, not prospective. |
| **Pomodoro mechanical timers** | Kitchen timer in tomato shape. The original physical timer. | Cheap, no setup, no phone required, satisfying tactile click | No goal connection. No tracking. No system. No BLE. The tomato timer was the 1987 version of this idea. |

### Wearable Data Loops (hardware analogy)

| Product | What It Does | Why Users Choose It | PomoFocus Analogy |
|---------|-------------|---------------------|-------------------|
| **Oura Ring** | Continuous biometric tracking (sleep, recovery, readiness). Daily "crown" reward system. Behavioral tag correlation. | Actionable daily readiness score; jewelry-grade hardware; strong habit loop (daily crowns) | The Oura/Whoop model is the closest hardware analog to what PomoFocus is doing in the focus domain. Both are device + app data loops where the device captures what the app interprets. The behavioral tag journal (Whoop) is structurally similar to PomoFocus's post-session reflection. |
| **WHOOP** | Wearable strain/recovery tracker with daily journal (tag habits, correlate with metrics). Subscription-only, no hardware purchase. | Deep habit correlation data; athlete community; subscription model without upfront cost | Same analogy as Oura. Neither tracks focus or goals — but the *product architecture* (passive device + active reflection → personal insights → behavior change) is the template. |

### Design Inspirations (not direct competitors)

| Product | What PomoFocus Borrowed |
|---------|------------------------|
| **BeReal** | Anti-comparison design: no public metrics, no likes, no infinite scroll. Inspired Quiet Feed's "presence without performance" philosophy. |
| **Strava** | Kudos model: social validation without ranking or comparison. Research confirms kudos causally increase behavior frequency. |
| **Oura Ring** | Device + app data loop. Passive capture → active insight → behavior change. Hardware that makes the app more valuable, not the other way around. |
| **Light Phone** | The "minimum viable phone" framing. Not a replacement for your smartphone — a different object for different contexts. |

---

**The gap:** No product combines a physical focus device + goal-connected software + behavioral science foundation. Physical timers have no brains. Apps live on the distraction device. Accountability tools (Focusmate) require scheduling overhead. Planning apps (Tiimo, Structured) solve "what to do" not "actually doing it." Nothing bridges the physical-digital divide with goals, tracking, and environmental replacement in one system.

---

*Phase 4 complete. v1 shaped and bounded.*
