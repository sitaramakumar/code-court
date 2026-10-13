# Game Design Record: Create a Multiplayer Game

**Source:** Handshake Learn mission "Create a Multiplayer Game" (overview read 2026-10-11)
**Tool:** ChatGPT Work mode (ChatGPT desktop app)
**Deadline:** **Oct 30, 2026, 11:59 PM PT = Sat 31 Oct, 12:29 PM IST** (top 3 win $1,000 each) · target: submit by Oct 29
**Status:** ⏳ Concept not chosen · project brief not captured yet

---

## 1. The mission

> Build a multiplayer game in ChatGPT that friends, family or classmates can join and play together from their own devices. ChatGPT interviews you through the key design decisions, then builds a game that keeps every player's screen in sync.

### What you'll learn (from the mission page)
1. Build a **real-time multiplayer app** that keeps every player's screen in sync.
2. **Write requirements and approve a plan** so an AI builds what you actually want.
3. **Debug AI-built software** by pinpointing what broke and describing it precisely.

### What you'll build: requirements
| # | Requirement | How it will be met |
|---|---|---|
| G1 | A **live** multiplayer game at a **public link** | _TBD_ |
| G2 | Rules a **new player can pick up without you explaining them** | Rules shown on the join screen (§4) |
| G3 | Friends join from **any phone or laptop** with a **room code** | Room-code lobby (§5) |
| G4 | **Nobody logs in or installs anything** | Browser only, nickname only |
| G5 | Every player's screen stays **in sync** | Sync list (§5.2) + multi-device tests (§7) |

### Official rules (read 2026-10-11: `[AI_Skills_Studio_Challenge]_Contest_Official_Rules.pdf`)
| Item | Rule |
|---|---|
| Contest | Handshake AI Skills Studio × OpenAI Multiplayer Game Challenge (sponsor: Stryder Corp. d/b/a Handshake) |
| Eligibility | Legal resident of an Appendix A country (**India is listed ✅**), 18+ / age of majority, active Handshake account (enter with its email), present in an eligible country when entering |
| **Deadline** | Entries from 9/22/2026 to **10/30/2026, 11:59 PM PT** = **Sat 31 Oct 2026, 12:29 PM IST**. **Target: submit by Oct 29** |
| Entry must include | **Project title · cover image · description · link/URL**, submitted in the "Create a Multiplayer Game" mission |
| Multiple entries | Allowed. Scripted or mass entries → disqualification |
| Prizes | **Top 3 each win $1,000 USD**; winner pays any taxes; may need to sign an acceptance, liability waiver or publicity release |
| Notification | Email to the Handshake account email, within 30 days of the deadline |
| Rights granted | Perpetual, worldwide, royalty-free licence for Handshake/OpenAI to use the submission and your name, likeness and statements for promotion. **No private or confidential content in the game** |
| Other | Challenge Code of Conduct; OpenAI Terms of Use apply; California law; Handshake's decisions are final |

### Judging criteria (25% each, scored 1–5; Round 1 all entries → Round 2 top 20 by a panel)
| Criterion | Score 5 means | Design implication |
|---|---|---|
| **Execution** | Exceeds requirements; fully functional, stable, demo-ready end to end | Pass all 10 multi-device checks (§7); no sync bugs |
| **Creativity** | Fresh concept, unexpected use case, or clever implementation | Avoid plain trivia or rock-paper-scissors; don't echo "Treasure Bluff" in name or mechanic |
| **Usefulness / Value** | Meaningfully serves its purpose or delights its audience | State a clear purpose and audience (e.g. dev team warm-up, classroom learning) |
| **Polish & Thoughtfulness** | Feels intentional and "real", with thoughtful details, edge cases and clear guidance | Rules on screen; handle leave, refresh, timeout and duplicate names (§5.3); a satisfying reveal |

### Examples from other learners
| Game | Idea | What it shows |
|---|---|---|
| **Treasure Bluff** | Each player secretly chooses **Collect** or **Steal**: "Choose once. No one sees your move until everyone has chosen." | Simultaneous hidden choices revealed together, a strong multiplayer pattern |
| **Panic Protocol: Cooperative Chaos** | Real-time cooperative crisis game | Co-op instead of competition |

---

## 2. AI instructor brainstorm (step 1.1)

**Session notes (2026-10-12):**
- Q: *What types of games do you usually like?* → **Trivia, bluffing, fast-paced reaction games.**
- Direction: combine all three:
  - **trivia:** short question rounds (code snippet or general fact);
  - **bluffing:** secret 1–3 point confidence bet, hidden until the reveal;
  - **reaction:** speed bonus for the fastest correct answers, 15–20 s timer.
- Design note for the build: **timestamp answers on the server**, not each device, so the speed bonus is fair on slow phones or connections (an edge case for "Polish & Thoughtfulness").

- Instructor explained **"how Code Court works"** using the 40-second pitch (example round: `print(0.1 + 0.2 == 0.3)` → truth `False`; phases Question 5 s → Bluff 20 s → Vote 15 s → Reveal 10 s → Scores 5 s; a "General" mode for non-coders).
- Instructor showed **the build loop** ("most of the build happens here"):
  `First build → Play-test it → Spot what's off → Say what happened → ChatGPT fixes it → (repeat)` → **Ship it** *when gameplay meets expectations*.
  - Play-test = the multi-device checks (§7); "Say what happened" = the bug template (§8: where, steps, expected, actual).
  - Lesson from the data-viz mission: a fix can introduce new bugs (v3's duplicate fields), so **re-run a full game after every fix**.

**Session summary from the instructor (final plan):**
| # | Step | Meaning |
|---|---|---|
| 1 | **Set up with a master prompt** | One complete prompt up front setting out **roles** (host/players), **room codes**, **state** (phases, scores, timers) and **rules** |
| 2 | **Test & debug loop** | Play-test **across two windows**, describe exact behaviour, let ChatGPT patch |
| 3 | **Ready for "Code Code"** (= **Code Court**) | Build it with snippets, fake answers, voting and speed bonuses |

**Open questions raised with the instructor** (answers: TBD):
1. Does the public link stay live after submission (judges may open it after Oct 30)?
2. How is sync done (shared server / real-time connection), and are there limits on players or rooms?
3. Free-text fake answers: length limit or basic filter, since the game is public?
4. If I improve the game after submitting, does the link update or must I resubmit?

---

## 3. Concept options (step 1.2)

| Option | How it plays | Why it works | Risks |
|---|---|---|---|
| **A. Spot the Bug / Code Court** ⭐ *(working title; avoid "Bluff" so it isn't read as a "Treasure Bluff" variant)* | Each round shows a short code snippet **written by me** (no client or work content) or a plain-English "claim" for non-coders. Every player secretly votes **Bug** or **No bug** and bets 1–3 points. Votes revealed together; correct bets win their points | Uses your software-engineering background; hidden-then-reveal is easy to sync; works with mixed audiences if the snippets stay simple | Needs a small question bank; keep snippets short and readable on a phone |
| B. Fact or Fiction | Each round shows a statement; everyone secretly votes true/false; reveal + points | Very simple, works for anyone | Less original |
| C. Lowest Unique Number | Everyone secretly picks 1–10; the lowest number nobody else picked wins the round | Rules in one line, very replayable, no content needed | Simple, so it needs a fun reveal to stand out |
| D. Co-op Countdown | The team must reach an exact target total by each adding a secret number (1–5) without going over | Co-op like Panic Protocol; tense reveal | Needs good feedback each round |

### Chosen concept (2026-10-12)
| Field | Answer |
|---|---|
| **Chosen** | **Code Court**: "Real code, fake answers. Can you spot the truth and fool your teammates?" (Balderdash for developers) |
| **Round flow (~60 s)** | ① Snippet + question ("What does this print?" / "What's the bug?" / "What does this regex match?") → ② **Bluff 20 s:** each player secretly writes a fake but believable answer → ③ **Vote 15 s:** fakes shuffled with the real answer, everyone votes → ④ **Reveal:** who wrote which fake, who was fooled, the true answer + a one-line explanation |
| **Scoring** | +3 for picking the truth · +1 for each player fooled by your fake · +1 speed bonus to the fastest correct voter |
| **Why this one** | Matches my preferences (trivia + bluffing + speed); Creativity: Balderdash for code is a fresh use case; Usefulness: team warm-up, bootcamps, interview prep, learning from each explanation; Execution: clear write → vote → reveal phases that are easy to sync; Polish: rich edge cases to handle well |
| **Why not the others** | Sev-1 Incident Room (co-op) is original but harder to build and balance before Oct 29; Merge Conflict is simpler but less social; plain trivia/true-false is too common for Creativity |
| **Content rule** | All snippets written by me; **no client or work code** (contest grants a perpetual licence to Handshake/OpenAI) |
| **Edge cases to design for** | Duplicate fake answers; a fake identical to the truth; a player who doesn't submit before the timer; voting for your own fake (block it); server-side timestamps for the speed bonus |

---

## 3b. Approved rules (ChatGPT Work spec, approved 2026-10-12)
- 2–8 players, room code, no login; host picks **Developer** or **General** mode.
- **One round per player** (minimum 3, maximum 8); the Judge rotates (a 2-player game has 3 rounds).
- Each question = truth + **2 pre-written decoys** (always ≥3 choices). The Judge sees the truth and **predicts which wrong answer (fakes or decoys) fools the most players** (+2; ties count).
- Others write a fake of ≤60 chars; one too close to the truth is rejected ("Too close to the truth, try another"); a missed deadline = skipped.
- Duplicate fakes are merged, and each author gets +1 per player fooled. You can't vote for or object to your own fake.
- Vote phase: vote + optional **Objection** (once per game, not the Judge): +2 if the target is fake, −1 if it's the truth.
- Scoring: +3 truth · +1 per player fooled · +1 first correct vote (server time) · Judge +2 prediction. A missed vote scores 0. Tie-break: most truth picks, then a shared win.
- **Added at approval:** timers fake 25 s / vote 15 s / reveal 10 s, advancing early when everyone has submitted; the reveal shows the truth + a one-line explanation, who wrote each fake and who was fooled, then the scoreboard; ≥15 questions per mode, no repeats, Developer answers **verified by running the snippets**, all questions fresh; 3-line rules on the join screen; refresh/reconnect with the same name + room code restores the seat and score.

## 4. Rules (as a new player sees them, 3–5 lines)
```
_TBD_
```
**Test:** read to someone who's never seen it. Could they play without questions? ☐

---

## 5. Game flow and sync

### 5.1 Flow
| Phase | What happens | Who can act |
|---|---|---|
| Lobby | Host creates a room → room code shown → players join with code + nickname | Host starts when ready (min players: _TBD_) |
| Round start | Question or prompt shown; timer starts (_TBD_ seconds) | All players |
| Choose | Each player makes a **secret** choice; others see only "✓ chosen" | All players |
| Reveal | When everyone has chosen (or the timer ends), all choices revealed together | — |
| Score | Points updated; scoreboard shown | — |
| Next / end | After _TBD_ rounds → winner screen → **Play again** | Host |

### 5.2 What must stay in sync on every screen
- [ ] Player list (joins and leaves)
- [ ] Current phase (lobby / choosing / reveal / scores / end)
- [ ] Timer (same countdown for everyone)
- [ ] Who has chosen (without revealing *what*)
- [ ] Revealed choices (only after everyone has chosen)
- [ ] Scores and winner
- [ ] Late join or refresh: the player comes back to the current state

### 5.3 Edge cases to decide
| Case | Decision |
|---|---|
| A player leaves mid-round | _TBD_ |
| A player doesn't choose before the timer ends | _TBD_ |
| The host leaves | _TBD_ |
| Two players use the same nickname | _TBD_ |
| A player refreshes the page | _TBD_ |

---

## 6. Plan review (step 2.2): ChatGPT's plan vs. my requirements
| ChatGPT's plan item | Matches my rules/sync list? | Change requested |
|---|---|---|
| _TBD_ | ☐ | |

---

## 7. Multi-device test log (step 2.4) and play-test (3.1)

| # | Test | Devices | Expected | Result |
|---|---|---|---|---|
| 1 | Join with room code, no login | Laptop + phone | Both appear in the lobby on both screens | ☐ |
| 2 | Host starts the game | Both | Both switch to round 1 at the same time | ☐ |
| 3 | Timer | Both | Same countdown (±1 s) | ☐ |
| 4 | Secret choice | Both | Others see "✓ chosen", not the choice | ☐ |
| 5 | Reveal | Both | Revealed together only after all have chosen / timer ends | ☐ |
| 6 | Scores | Both | Identical scores on every screen | ☐ |
| 7 | Refresh mid-round | Phone | Returns to the current round and score | ☐ |
| 8 | Late join | 3rd browser | Sees the current state (or a waiting screen) | ☐ |
| 9 | Play again | Both | New game with the same players | ☐ |
| 10 | Wrong room code | Any | Clear error message | ☐ |

### 7b. Two-window test script for Code Court (local build, http://localhost:4173)
Setup: normal Chrome = **Ravi** (Developer → Create a room) · Incognito = **Asha** (join with the code) · optional phone `http://192.168.1.44:4173` = **Kiran**. 2 players → 3 rounds.

| # | Round | Action | Expected | Result |
|---|---|---|---|---|
| T1 | 1 | Non-Judge types the **true answer** as a fake | "Too close to the truth, try another." | ☐ |
| T2 | 1 | Submit a believable fake (`None` / `undefined` / `TypeError`) | Judge sees "✓ submitted", not the text | ☐ |
| T3 | 1 | Vote phase | Own fake not selectable | ☐ |
| T4 | 1 | Reveal | Truth + explanation, authors, scores identical in both windows | ☐ |
| T5 | 2 | Fake >60 chars (`This answer is deliberately written to be longer than sixty characters total`) | Blocked or cut at 60 | ☐ |
| T6 | 2 | Fake `42`; vote + **Objection** on a decoy | +2 if fake / −1 if truth | ☐ |
| T7 | 2 | Try a second Objection | Disabled | ☐ |
| T8 | 2 | **F5** in Incognito during the vote | Same round, seat and score restored | ☐ |
| T9 | 3 | No fake; let 25 s expire | Game moves on, no fake shown | ☐ |
| T10 | 3 | No vote; let 15 s expire | 0 points, no crash | ☐ |
| T11 | End | Final reveal | Winner screen in both windows, matching scores | ☐ |
| T12 | All | Hand-check totals (+3 truth, +1 per fooled, +1 fastest, Judge +2, Objection +2/−1) | Matches the screen | ☐ |

**4-player setup (preferred; phone blocked by Windows Firewall locally, test the phone after publishing):** Ravi = Chrome Profile 1 normal (host) · Asha = Profile 1 Incognito · Kiran = Profile 2 normal · Meera = Profile 2 Incognito → 4 rounds. One window per profile+type; unique names (reconnect uses name + room code).

| # | Action (4 players) | Expected | Result |
|---|---|---|---|
| T13 | Two players vote for the same player's fake | That author gets +2 | ☐ |
| T14 | Two players type the identical fake (`None`) | Shown once; both authors credited | ☐ |
| T15 | Judge predicts among several fakes | +2 only if it matches the most-voted wrong answer (ties count) | ☐ |
| T16 | All 4 windows during each phase | Same phase, timer and scores everywhere | ☐ |

### 7c. Exact 4-player script (P1–P3 = non-Judges in order Ravi → asha → Kiran → meera, skipping the Judge)
| Round | Judge predicts | P1 | P2 | P3 | Expected points (Judge / P1 / P2 / P3) |
|---|---|---|---|---|---|
| 1 | `TypeError` | true answer (→ rejected), then `None`; votes `TypeError` 2nd | `None` (duplicate); votes `TypeError` 3rd | `TypeError`; votes truth 1st | +2 / 0 / 0 / +6 |
| 2 | `42` | >60-char text (→ blocked), then `42`; votes truth 1st + Objection on `SyntaxError` | `undefined`; votes truth 2nd | `SyntaxError`; votes `42` | +2 / +7 / +3 / 0 |
| 3 | `undefined` | no fake (timeout), no vote | `undefined`; F5, then votes truth | `None`; votes `undefined`. Round-2 objector tries again → disabled | +2 / 0 / +5 / 0 |
| 4 | `0` | `0`; votes truth 1st | `null`; votes truth 2nd | `NaN`; votes `0` + Objection on the TRUTH (an unused objector) | +2 / +5 / +3 / −1 |
Backup fake if one is rejected as too close: `SyntaxError` / `undefined` / `NaN`.
**Run with Pace = Host-controlled** (after the B2 fix). Round 3 "timeout" checks become: P1 types nothing and doesn't vote → **Ravi clicks Next** to skip each phase (expect: the game moves on, no fake from P1, P1 scores 0). Extra checks: a phase advances by itself once all players have submitted; only Ravi sees Next / Next question; others see "Waiting for the host…".

**Scores per round:** _TBD_

**Play-test notes (real people):** _TBD_

---

## 8. Bug log (step 2.5): describe it precisely

**Template to send ChatGPT:**
```
Bug: [one line]
Where: [screen / phase], [device]
Steps: 1) … 2) … 3) …
Expected: …
Actual: …
Happens: [always / sometimes]
```

| # | Bug | Reported to ChatGPT | Fixed in version | Re-tested |
|---|---|---|---|---|
| B1 | Lobby (room 443394, 4 players): no window shows which seat is "you"; every window sees the same list, so a player can't tell their own name. Fix: "(you)" marker / highlight on every screen | ✅ sent together with B2 | v2 | ☑ "Ravi (you)" shown (2026-10-12) |
| B2 | Timers too fast to play 4 windows (fake 25 s / vote 15 s); first-time and phone players would feel it too. Fix (final, per user): **Countdown optional + configurable**: an on/off switch, **OFF by default** (host-controlled: phases advance when everyone has submitted or when the host clicks **Next**; reveal/scoreboard until **Next question**; others see "Waiting for the host…"); when ON, the host sets seconds per phase (presets Quick 25/15/10, Standard 45/30/15, Relaxed 90/60/20; custom 10–180 s), still advancing early once everyone has submitted. Setting shown in the lobby; speed bonus kept (server time). **Sent in one prompt together with B1** | ✅ sent | v2 | ☑ "No countdown · Host advances" + Next question (2026-10-12) |
| B3 | No way to exit a room except closing the tab; reopening may auto-rejoin (reconnect memory). Fix: "Leave room" for players on every screen (removed from the list for everyone; past points kept); host gets "End game" (everyone back to home) + "Leave" (host passes to the next player); no auto-rejoin after leaving. Workaround for testing: close all windows / new Incognito / clear site data / ask ChatGPT to restart the server | ✅ final prompt | v3 | ☑ End game + Leave visible; code verified |
| B4 | Final screen shows "Final tie-break: most truths picked" with no tie (13 vs 8) | ✅ final prompt | v3 | ☑ hidden with a clear winner; shown on a genuine tie |
| B5 | "Copy room code" after the case is closed is confusing → "Play again with the same players" | ✅ final prompt | v3 | ☑ replay worked |
| B6 | Reveal wording "Fooled: Nobody fooled" → "Fooled: nobody" | ✅ final prompt | v3 | ☑ code verified |
| F1 | **Feature: suggested fakes + reasoning** (user request). A per-question pool of 4–6 wrong answers with one-line reasons; a private "Need an idea?" button shows 2 random suggestions (different per player, hidden from others; editable); the reveal shows "Why it's wrong:" under wrong answers; suggestions verified wrong by running the snippets. Examples: `3` (for…of vs for…in), `3 xxy` (Set dedupe), `7 7` (`??` vs `\|\|`), `5 5` (spread = new object) | ✅ final prompt, item 5 | v3 | ☑ confirmed by user + 30 questions validated (0 problems) |
| B7 | **Regression from the restyle:** the right-hand "THE SCOREBOARD · LIVE" panel is empty on the final screen (heading only; previously listed players). The main-card final scoreboard is still correct. **Unconfirmed:** seen only after refreshing an old finished game (no new game played after the restyle) → re-check in a fresh game before reporting | ✅ **Not a bug**: a fresh 4-player game after the restyle shows the live scoreboard correctly (asha 6, Kiran 6, Ravi 5, meera 5) | — | ☑ (2026-10-12) |

---

## 8b. Build brief (captured 2026-10-12, `multiplierGame-codecourt.pdf`)

**Project requirements:** ① at least 2 players join from separate devices ② real rules a player could follow without you explaining them ③ live at a URL other people can reach. Options: A (build on your own) / **B (step-by-step guide)**. Needs **ChatGPT Work** (free in the desktop app).

**⚠️ Creativity risk:** the mission's own example is **"Hallucination Station"** ("a game of confident nonsense": invent believable fake answers, then identify the real one). That is the same Balderdash loop as Code Court. **Code Court needs its own mechanic**:
- **A. Courtroom roles** (recommended): a rotating Judge, plus one "Object!" call-out per player per game;
- **B. Executable truth:** a once-per-game "run the code" hint, paid for in points;
- **C.** switch to Sev-1 Incident Room.
Decision (2026-10-12): **A. Courtroom roles**: a rotating **Judge** each round (sees the real answer, writes no fake) + one **"Objection!"** per player per game (call out a suspected fake: bonus if right, penalty if wrong).

**Option B steps and prompts:**
1. **Starter prompt** (Work mode):
   ```
   Design and build a real-time party game for 2-8 players joining by room code from their own device. Before building, talk me through:
   - The overall game concept. Ask me if I have any initial ideas for favorite game types and work from there.
   - Rules and scoring. How the gameplay happens, how it's scored, and when it's over.

   Summarize the rules before building anything, so I can approve.
   ```
2. **Steer:** one decision at a time; read the spec closely; approve only when it matches.
3. **First version:**
   ```
   Go ahead and build the game we designed. Get the core loop working first so that I can test it locally, then we'll polish.

   Get the game running at a local address and give me the URL I can paste into my browser to test.
   ```
4. **Open and test:** a normal window (host) + an Incognito window (player).
5. **Debug:** `When I did [what you did, and in which window], I expected [what should have happened], but instead [what happened]. Can you fix that? Keep the change small.`
6. **Personalize:**
   ```
   Restyle the game and keep the game logic exactly as it is.
   Mood: [e.g. late-night game show]
   Colors: [two or three, plus one accent for buttons]
   Layout: [e.g. one big question with the answers stacked below]
   Apply it to every screen and keep the text easy to read on a phone.
   ```
7. **Make it live:** preferred `publish this using @Sites`; fallback Netlify: paste the brief's Netlify prompt (Netlify Function `netlify/functions/game.ts` + Netlify Blobs with strong consistency; frontend calls `/.netlify/functions/game`; test a full 3-round 2-player game; package `netlify-ready-game.zip` without node_modules; no GitHub, terminal, env vars or API keys) → upload at app.netlify.com/drop → free account → wait for green → **Make public** → test in a private window.

## 9. Mission text capture status
- ✅ Overview page (2026-10-11): `multiplier game.pdf`
- ✅ **Build** page / project brief (2026-10-12): `multiplierGame-codecourt.pdf` (minor gaps at page breaks: the Option A publish intro, the end of "Open and test"; the content is covered by Option B)
- ✅ Official rules (2026-10-11)
- ⏳ Submission form

---

## 10. Outcome
| Field | Answer |
|---|---|
| Public game link | _TBD_ |
| Submitted on | _TBD_ |
| Reflection (2–3 lines, also for interviews) | _what I built, the hardest sync bug and how I described it, what I'd improve_ |
