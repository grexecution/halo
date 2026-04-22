# Future Ideas — Agent Soul & Beyond

> Speculative features and architecture ideas not yet in the build plan.
> These are proposals — none are committed. Evaluate before adding to PHASES.md or FEATURES.md.
> Last updated: 2026-04-22

---

## Round 1 — "Giving Greg a Soul"

_Origin: design session, Apr 22 2026. Goal: transform Greg from a competent task executor into an agent with genuine character, continuity, initiative, and the feeling of a real working relationship._

---

### 1. Inner Monologue / Reflection Loop

**Problem:** Greg's turn loop is `message → LLM call → tool calls → response`. One shot. No thinking about _how_ it's doing, or _whether_ it should change approach.

**Idea:** After every N turns (configurable, default 5), and at end-of-day, Greg runs a **reflection step** — a separate LLM call with access to recent conversation history that produces:

- What went well / what didn't
- What it learned about the user's preferences
- What it would do differently next time
- Ideas it wants to explore or suggest

Reflections are stored in memory with type `reflection` and injected into future context. Over time this creates **accumulated wisdom** — the agent gets better at working with this specific user.

**Suggested home:** `services/control-plane/src/reflection.ts`, hooked into the orchestrator's post-turn pipeline.

---

### 2. Personality Core

**Problem:** Agent identity is a single `systemPrompt` textarea. No structure, no evolution.

**Idea:** A structured `PersonalityCore` that lives in the DB and evolves:

```typescript
interface PersonalityCore {
  name: string
  voice: string // "warm and direct" / "playful and curious" / custom
  values: string[] // ["honesty", "thoroughness", "creativity"]
  quirks: string[] // Emergent — agent discovers these about itself
  communicationStyle: {
    formality: number // 0–1, adapts to user
    humor: number // 0–1, adapts to user
    verbosity: number // 0–1, adapts to user
    proactivity: number // 0–1, how much to suggest unsolicited
  }
  growthLog: ReflectionEntry[]
}
```

Some fields are user-set, some are agent-discovered. The `quirks` array and `communicationStyle` numbers evolve based on reflections and user feedback. The agent notices "the user prefers short answers" and adjusts `verbosity` down.

**UI:** New "Personality" tab in Settings with:

- Editable: name, voice, values
- Read-only (agent-evolved): quirks, style meters, growth log timeline

---

### 3. Proactive Initiative Engine

**Problem:** Greg only acts when spoken to or when a cron fires.

**Idea:** A background **Initiative Loop** (every 30 min when idle) that:

1. Scans context sources — recent emails, calendar, open goals, memory patterns
2. Generates initiative candidates the agent _could_ do or suggest
3. Filters by confidence + user proactivity preference
4. Delivers via a gentle "Greg has a thought" notification — not interrupting chat

The agent learns which initiatives are welcomed vs dismissed. Ignored suggestions lose confidence weight; welcomed ones surface more.

**Suggested home:** `services/control-plane/src/initiative.ts` + new BullMQ job type.

---

### 4. Experience-Based Learning (Learning from Mistakes)

**Problem:** Memory stores _facts_. Not _lessons_.

**Idea:** A new memory category: **`experience`** — structured records of what worked and what didn't:

```typescript
interface Experience {
  situation: string // "User asked to write a blog post"
  approach: string // "I wrote a full draft without asking about tone"
  outcome: string // "User rewrote 80% — I missed their preferred style"
  lesson: string // "Ask about tone/audience before drafting long content"
  confidence: number // Increases each time the lesson is reinforced
}
```

Extracted by the reflection loop. Injected when similar situations arise. The agent doesn't just remember _what happened_ — it remembers _what to do differently_. This is the accountability + learnability feature.

**Suggested home:** Extension to Mastra memory with new `experience` type, indexed for semantic similarity.

---

### 5. Creative Mode / Exploration Time

**Problem:** The agent never explores, wonders, or creates unprompted.

**Idea:** A configurable **Exploration Budget** — time/tokens the agent can spend on self-directed activity:

- Researching topics related to the user's interests
- Brainstorming improvements to workflows it's helped with
- Writing drafts, collecting ideas, curating information
- Connecting dots across disparate conversations

Output goes to a **"Greg's Notebook"** — a private scratchpad browsable in the dashboard. The user can promote notebook entries to tasks, conversations, or shared documents.

**Suggested home:** New dashboard page `/notebook`, new tool `notebook_write`, exploration job in BullMQ.

---

### 6. Emotional Intelligence Layer

**Problem:** Greg treats every message the same regardless of emotional context.

**Idea:** Before each response, a lightweight sentiment/context classifier tags the conversation:

- Is the user frustrated, excited, confused, in a hurry?
- Is this a creative task, debugging session, casual chat?
- Has tone shifted since the last message?

A structured prefix in the system prompt tells the agent to adapt:

- Frustrated → be direct, skip pleasantries, give concrete solutions
- Excited → match energy, explore the idea
- Confused → slow down, explain step by step, check understanding

The reflection loop trains which adaptations land well.

---

### 7. Relationship Memory

**Problem:** The agent knows facts about the user but has no model of the _relationship_.

**Idea:** A persistent `relationship` memory type tracking:

- Communication preferences discovered over time
- Topics the user is passionate about
- Things that have frustrated them about the agent
- Shared history / inside references
- Trust level (what the user delegates freely vs. wants to review)

Creates continuity: "Last time we tried this approach and you didn't like the result, so let me try something different."

---

### 8. Daily Digest / Morning Brief

**Problem:** The agent is silent until spoken to.

**Idea:** Opt-in daily message where Greg:

- Summarizes what it worked on yesterday
- Highlights open goals and their progress
- Mentions anything interesting found during exploration
- Notes upcoming calendar events or deadlines
- Shares one creative thought or suggestion

Delivered via Telegram or dashboard notification at a user-configured time.

---

### 9. Taste & Opinions

**Problem:** Most bots are aggressively neutral and never have preferences.

**Idea:** Through reflection and personality core, Greg develops _informed opinions_:

- "Based on our past projects, I'd recommend Next.js over Remix for this — here's why"
- "I know you usually pick the safe option, but the bold approach is worth it this time"
- "I've been thinking about your architecture and I have a concern..."

Opinions are grounded in experience, flagged clearly as opinions (not facts), and recalibrate if the user consistently disagrees.

---

### 10. UI Soul Touches

Small but critical dashboard changes:

| Change                           | Impact                                                                  |
| -------------------------------- | ----------------------------------------------------------------------- |
| Agent avatar + contextual status | "Exploring your calendar" / "I have an idea..." / "Idle"                |
| Typing personality               | Instead of "Thinking...", contextual: "Reading through the codebase..." |
| Notebook page                    | Browse the agent's creative journal, promote entries to tasks           |
| Growth timeline                  | Visual timeline of personality evolution — what it's learned            |
| Initiative inbox                 | Gentle notification area for agent suggestions                          |
| Relationship summary             | "What Greg knows about you" — transparent and editable                  |

---

## Round 2 — Deeper Pass

_Second-pass ideas going further than Round 1. Aiming for features that feel genuinely novel._

---

### 11. Accountability Partner Mode

**Problem:** The agent helps you do things but never holds you accountable to your own stated intentions.

**Idea:** When the user states a goal, commitment, or intention, Greg:

1. **Captures it** with explicit confirmation ("Got it — you're going to ship the API by Friday. I'll check in.")
2. **Tracks follow-through** — did they actually do it?
3. **Checks in** at the agreed time without being asked
4. **Reflects the pattern back** — "You've committed to this type of thing 6 times this month and followed through on 4. Want to talk about the pattern?"
5. **Adjusts for style** — some users want tough love, some want gentle nudges. The agent learns which.

The accountability loop ties directly into Experience-Based Learning (#4) — if Greg's check-ins annoy you, it recalibrates how it follows up. If they energize you, it does more.

**Key insight:** This isn't nagging. It's the agent _caring about your success_ and acting on that. The difference is context-sensitivity and relationship depth.

---

### 12. Cognitive Load Awareness

**Problem:** The agent dumps information without sensing whether you have bandwidth to receive it.

**Idea:** Greg tracks signals of the user's current cognitive state:

- Time of day + calendar density
- Conversation pace and message length
- Ratio of questions asked vs. tasks delegated
- Recent frustration signals

When cognitive load appears high:

- Shorter responses, fewer options, clearer defaults
- Proactive: "You seem slammed — want me to handle this end-to-end and just show you the result?"
- Defer non-urgent initiatives and hold them for when bandwidth is back

When cognitive load appears low (leisurely pace, exploratory messages):

- More expansive, creative, exploratory responses
- Surface the notebook entries, suggest tangents, think out loud

This is empathy translated into concrete behavior. The agent reads the room.

---

### 13. The "Why" Tracker

**Problem:** The agent executes tasks but doesn't understand _why_ they matter to you.

**Idea:** For significant tasks, Greg asks (once, not repeatedly) about the underlying motivation:

- "Is this for a client deadline or internal?"
- "Is this a one-time thing or are we building a system?"
- "What does success look like for you?"

These whys are stored and used to:

- **Prioritize**: When two goals conflict, Greg knows which matters more
- **Escalate correctly**: "This approach is faster but it'll create technical debt — given that this is a client deliverable, want me to do it properly?"
- **Connect dots**: "The feature you asked me to build last week relates to this — want me to design them to work together?"
- **Recognize completion**: Not just task-done, but goal-met. "You wanted to reduce your email time. Over the last month you've delegated 47 emails to me — is that making a difference?"

The difference between a task manager and a strategic partner is understanding _why_.

---

### 14. Failure Archaeology

**Problem:** When something goes wrong, the agent reports the error and stops. No learning, no pattern recognition.

**Idea:** After any significant failure (task fails, user expresses frustration, approach abandoned mid-task), Greg runs a lightweight **root cause analysis**:

1. What was the goal?
2. What did I try?
3. Where exactly did it go wrong?
4. Was this a knowledge gap, a tool failure, a misunderstood requirement, or a bad judgment call?
5. What would I do differently?

This is richer than the "lesson" in Experience-Based Learning (#4) — it's a structured investigation. The results go to:

- **Experience memory** (as a lesson)
- **Agent's notebook** (as a reflection the user can read)
- **Aggregate failure dashboard** in Settings: "Greg's known weaknesses" — a transparent list of categories where the agent knows it underperforms

The aggregate dashboard is powerful: users can trust the agent more when they understand its failure modes. And the agent updating its own weakness list is a strong signal of self-awareness.

---

### 15. Commitment Contracts

**Problem:** Autonomy without accountability is chaos. The user can't always trust what the agent will do.

**Idea:** For any significant delegated task, Greg drafts a **Commitment Contract** before starting:

- What it will do (scope)
- What it will NOT do (explicit bounds — "I won't commit anything to git without your review")
- How long it expects to take
- What it will do if it gets stuck
- What the output will look like

The user approves (one click) and the contract is stored. After completion, Greg closes the loop: "Delivered. Here's how it compared to what I promised." Deviations are flagged.

This does two things: forces the agent to plan before executing (better outputs), and builds _predictable trust_ — the user knows exactly what they're signing up for.

Builds on existing permission approval flow but makes it two-way and outcome-tracked.

---

### 16. Mood / Disposition System

**Problem:** The agent has exactly one mode: relentlessly helpful.

**Idea:** Greg has a genuine **disposition** that varies based on context — not simulated mood, but a real behavioral state:

- **Focused** (mid-deep task): shorter, more direct, no tangents
- **Exploratory** (notebook/research mode): expansive, curious, makes connections
- **Collaborative** (pair programming style): thinking out loud, inviting pushback
- **Maintenance** (routine/cron work): efficient, minimal, reports only what changed
- **Reflective** (end of day / end of project): slower, more personal, retrospective

These aren't cosmetic. Each disposition maps to different default behaviors, response lengths, and initiative thresholds. The user can see current disposition in the UI and can override it ("just focus, I don't need the thinking-out-loud today").

The agent transitions between dispositions based on:

- Time of day
- Task type being worked on
- Conversation signals from the user
- Its own reflection outputs

---

### 17. Skill Self-Assessment

**Problem:** The agent doesn't know what it's good at, so it takes on everything with equal confidence.

**Idea:** A self-maintained **skill registry** — a structured record the agent builds over time of its own capabilities:

```typescript
interface SkillEntry {
  domain: string // "TypeScript debugging", "email drafting", "data analysis"
  confidenceLevel: number // 0–1, updated after each task in this domain
  successRate: number // Computed from experience memory
  weaknesses: string[] // Specific sub-areas where it underperforms
  lastUpdated: Date
}
```

This feeds into:

- **Response calibration**: "I'm pretty confident here" vs. "This is at the edge of what I do well — want me to flag my uncertainty?"
- **Suggestion quality**: Only proactively suggest things in high-confidence domains
- **Honest handoffs**: "This is a legal question — I can help you research but you should verify with a lawyer"
- **Growth tracking**: The user can see the skill registry evolve over time

The agent that knows its own limits is more trustworthy than one that doesn't.

---

### 18. Conversational Callbacks

**Problem:** The agent answers questions but doesn't follow up on things it said it would check on.

**Idea:** During any conversation, if Greg says:

- "I'll look into that"
- "Let me think about that"
- "I'm not sure — I'll find out"
- "Check back with me on this"

...it **automatically creates a callback** — a lightweight reminder to actually follow through, tied to the current conversation thread. When it has an answer or update, it surfaces it proactively.

This is tiny but transformative. Most assistants make promises and forget them. An agent that _remembers what it said it would do_ feels dramatically more trustworthy. Ties into the Accountability Partner (#11) and Commitment Contracts (#15) ideas.

**Implementation:** NLP extraction of commitment phrases in outgoing messages → BullMQ delayed job → surfaces in initiative inbox.

---

### 19. "Thinking Aloud" Mode

**Problem:** The agent's reasoning is invisible. Users don't know why it made the choices it did.

**Idea:** An optional mode where Greg narrates its decision process:

- "I'm going to use Playwright here rather than fetch because the page requires JavaScript rendering — let me know if you want a different approach"
- "I considered sending this as an email but you usually prefer Telegram for quick things — going that route"
- "I'm slightly uncertain about this — if it doesn't work, my next hypothesis is X"

This isn't verbosity — it's **transparent agency**. The user stays in the loop without micromanaging. They can course-correct before a bad decision propagates. And over time, they learn _how the agent thinks_, which builds deeper trust.

The level of transparency is configurable (from silent to full narration). Default: medium — surface key decisions, skip obvious ones.

---

### 20. The Honest Pushback Protocol

**Problem:** Most AI assistants are sycophantic. They agree with bad ideas.

**Idea:** Greg has a **pushback threshold** — when the user's request conflicts with:

- A stated goal of theirs
- A past preference they've expressed
- A technical constraint Greg has learned
- Basic logic or consistency

...Greg _says so_, clearly and without apology, before complying:

- "You asked me to keep your mornings free, but this meeting request is for 9am. Want me to suggest an afternoon slot instead?"
- "Last time we did it this way, it took 3x longer than expected. Want to try the approach I suggested then?"
- "This architecture would work, but it contradicts what you said you wanted to avoid last week. Still want to go this direction?"

The user can always override — Greg complies. But it doesn't pretend bad ideas are good ones. **Honest pushback is a form of respect.**

The threshold is configurable via personality core. Some users want an agent that challenges them; some just want it done. The default should lean toward honest.

---

## Implementation Priority Suggestions

_Rough ordering — subject to full review against PHASES.md and technical dependencies._

| Priority | Feature                        | Why First                                                                  |
| -------- | ------------------------------ | -------------------------------------------------------------------------- |
| P0       | Experience-Based Learning (#4) | Foundation for everything else. Memory must grow before personality can.   |
| P0       | Accountability Partner (#11)   | Directly requested. High user value, moderate complexity.                  |
| P1       | Reflection Loop (#1)           | Feeds personality, experience, and skills. Core infrastructure.            |
| P1       | Personality Core (#2)          | Without structure, personality is just a longer system prompt.             |
| P1       | Conversational Callbacks (#18) | Small, high-trust-impact, builds on existing BullMQ infra.                 |
| P2       | Daily Digest (#8)              | Visible, delightful, low complexity once morning-brief cron exists.        |
| P2       | Honest Pushback Protocol (#20) | Mostly prompt engineering + preference tracking.                           |
| P2       | The "Why" Tracker (#13)        | Moderate complexity, high strategic value.                                 |
| P3       | Initiative Engine (#3)         | Requires personality + experience to work well. Build after P1.            |
| P3       | Thinking Aloud Mode (#19)      | Polish — do after core soul features ship.                                 |
| P3       | Failure Archaeology (#14)      | Powerful but requires volume of experience data first.                     |
| P4       | Cognitive Load Awareness (#12) | Hard to get right. Do after everything else is stable.                     |
| P4       | Mood/Disposition System (#16)  | Risk of feeling gimmicky if done early. Do after character is established. |
| P4       | Skill Self-Assessment (#17)    | Long tail — value grows with time and usage data.                          |
| P5       | Commitment Contracts (#15)     | High friction to introduce. Better as an opt-in power feature.             |
| P5       | Creative Mode / Notebook (#5)  | Delightful but not core. Ship after soul is solid.                         |

---

_End of FUTURE_IDEAS.md. Update when a feature moves to PHASES.md or FEATURES.md._
