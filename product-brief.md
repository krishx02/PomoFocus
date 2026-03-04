# PomoFocus — Product Brief v0.3

> **Status:** Phase 2 complete.
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

## 6. Session Flow

### The widget is a critical touchpoint

The lock screen / home screen widget is visible *without opening the app*. It does the goal salience job — keeping goals visible — without pulling the user into the phone. For software-only users, the widget is the software equivalent of glancing at the physical device on the desk.

**Widget shows:**
- Current/next goal ("Study calculus — 2 sessions today")
- Quick-start button (tap → timer starts, app opens in minimal mode)
- Streak or progress indicator ("5-day streak" or "3/5 sessions done")

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

---

## 11. Research Threads to Investigate (from Phase 1)

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

## 12. Open Questions (remaining)

*Answered in Phase 2:* ~~device form factor~~, ~~minimum viable device~~, ~~device-app communication~~, ~~v1 scope~~, ~~session flow~~, ~~pricing model~~, ~~onboarding~~, ~~social features~~, ~~pattern tracking / analytics~~.

*(No remaining open questions from Phase 2.)*

---

## 13. Competitive Landscape (to be expanded)

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

*Phase 2 complete. All open questions answered.*
