# Jesse HQ architecture and build checklist

Jesse HQ is a playable pixel-art headquarters that sits on top of the existing Drive-based operating
system (daily checkouts, the loops spine, the dated operating-system file and the rollups). It reads
those records live, shows them inside rooms, and hands off to the real tools (Gmail, Calendar, Drive,
Slack, GitHub, Vercel, Linear and the public football site). It is not a second brain and stores no
knowledge of its own.

This repository is public at the time of writing, so **nothing personal is committed**: no Drive IDs,
no names, no lane names, no document content. Everything personal is fetched at runtime, after Google
sign-in, and is never written to disk, logs or analytics. Tests use synthetic fixtures.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | Next.js 16 (App Router) on Vercel | Existing GitHub to Vercel flow, server routes for private data |
| World | Phaser 3.90 | Mature, stable 2D engine; v4 changed enough API that v3 is the lower-risk pick |
| UI | React 19 panels over the canvas | Readable, accessible panels; controller-navigable |
| Data | Google Drive, Calendar, Gmail REST APIs with the user's own OAuth token | Zero new services, Drive stays the source of truth |
| Session | Encrypted httpOnly cookie (AES-GCM, key from `AUTH_SECRET`) | No database, tokens never reach browser code |
| Art and sound | Drawn and synthesized in code at load time | Original assets, no licensing questions, one consistent scale |
| Tests | Vitest for parsers and input logic, Puppeteer + system Chrome for the end-to-end walk | |

No paid services, no AI API, no new database, no integration platforms.

## How data flows

```
Browser (Phaser world + React panels)
   │  fetch /api/hq/*  (cookie session, same origin)
   ▼
Next.js route handlers ── refresh access token if needed ──► Google OAuth
   │
   ├─ os-resolver: find the context folder by name, map numbered child folders by role,
   │               pick the CURRENT file per convention (see below)
   ├─ drive / calendar / gmail clients: minimal REST calls, short in-memory cache
   └─ shared parsers (pure functions): markdown → normalized JSON with source metadata
```

Every normalized object carries `source: { name, id, url, modifiedTime, date, freshness }` so each
panel can link back to the original file and say how fresh it is.

### File conventions honored (discovered from the existing system)

* **Dated-current files**: daily `YYYY-MM-DD.md`, loops `loops-YYYY-MM-DD.md`, `operating-system-YYYY-MM-DD.md`,
  `relationships-YYYY-MM-DD.md`, weekly rollups (dated names), monthly (`YYYY-MM.md`). The newest date is current.
  Resolved by listing and comparing dates, never by hard-coded ID or filename.
* **Undated-current files** (identity, health, lenses): the undated name is live; dated copies are archives.
* **`VOID-` prefix**: never read, whatever the date. Names containing `superseded` are skipped too.
* **The dead system folder** (`00 — System`) is never read.
* Source files are never modified. The only write the app can make is a Dream Journal note, into a folder
  the app itself creates (`drive.file` scope), after an explicit confirmation.

### Privacy rules carried over

* Raw text-message exports and DM pull emails are never displayed or searched: they hold other people's words.
  The Automation Lab only shows when the latest export happened.
* Health, identity and advocacy fields only appear inside the Personal Space, behind a deliberate reveal.
* Contract-lane rooms show only Jesse's own items, with no coaching or nudges.
* Phone mode follows the laptop rule by default: only the lounge, garden, personal space, football room and the
  lanes allowed on the phone are open. One setting turns everything back on.

### Loops semantics

Items carry a trailing tag such as `` `[owed · detail]` `` or `` `[waiting on Name]` ``. The first tag part is
classified into: **owed** (Jesse holds the next action), **waiting** (someone else's turn), **scheduled**,
**decide** (decision awaiting Jesse), **active**, **parked**, **idea**, **done**, **decided**, **standing**,
**watch**, **warm**, **info**, **open**. Waiting items are never shown as Jesse's backlog.

### Lane registry

Built at runtime from the newest OS file's `Lanes` section (falls back to the latest daily file's lane list,
then to loops sections). Each lane gets a display name and description from the businesses section, its loops
(by section), recent movement from the latest checkout, allocation and schedule lines, people from `waiting on`
tags, and links found in its own text. A room theme is scored from keywords, so new lanes get a fitting room
automatically. Nothing about specific lanes is hard-coded.

## The world

Ground floor: **Command Center** (spawn) with doors to the **Work District** (one building per lane plus the
**Hawks War Room**), **Communications Hub**, **Library** (Archivist) and **AI and Automation Lab**.
Upstairs: the **Dream Lounge** (with balcony garden) and the **Personal Space** (deliberate entry).

Coworkers (fictional): Chief of Staff, Archivist, Communications Coordinator, Project Coordinator, Scout,
Inventor, plus the Lab's robot. Each has a job, data sources, topics and action menus. Replies come from the
records through deterministic rules; nothing pretends to be AI reasoning. A replaceable `NpcBrain` interface
allows an optional local model later (Ollama adapter included, off by default).

## Input

One input router reads keyboard, mouse, touch and the browser Gamepad API and decides who gets each press:
the world, the open panel, or a focused text field. (Phaser's gamepad plugin was evaluated; a single router
avoids the same button press landing in both the canvas and a React panel.)

| Xbox | Keyboard | World | Panels |
| --- | --- | --- | --- |
| Left stick / D-pad | WASD / arrows | Walk | Move focus |
| A | E / Space / Enter | Interact, talk | Activate, edit text |
| B | Esc / Backspace | Cancel | Back / close |
| X | F | Secondary action of nearby object | Secondary action |
| Y | / | Search | Search |
| LB / RB | [ / ] | Previous / next room | Previous / next tab |
| View | M | Map (fast travel) | Map |
| Menu | Tab | Main menu | Main menu |
| Right stick | Page Up / Down | | Scroll |
| RT (hold) | Shift | Run | |
| LT (hold) | V (hold) | Voice command (opt-in) | Voice command |

Dead zones are radial with rescale, menus repeat after 350 ms then every 90 ms, controllers can disconnect and
reconnect at any time, and controller navigation pauses while a text field has focus so dictation and typing
never move the character.

## Voice

* Any text field the controller selects receives real DOM focus, so Superwhisper or macOS Dictation types into it.
* Optional browser speech recognition (off by default; Chrome sends audio to Google for recognition) for a short
  list of commands, routed deterministically, always shown for confirmation before acting.

## Decisions taken while building unattended

1. Phaser 3.90 over Phaser 4 (stability).
2. Single Gamepad API router over Phaser's gamepad plugin (no double-fired presses).
3. Hand-rolled OAuth with an encrypted cookie instead of an auth library or database.
4. Repository treated as public: no personal data, IDs or lane names in code.
5. Old static app preserved at `/classic`; its two API routes ported unchanged; the old cache-first service workers
   replaced with cleanup workers so stale caches cannot hide the new app.
6. Commits are authored under Jesse's GitHub identity so Vercel keeps building them if the repo goes private.
7. Phone mode defaults to the laptop rule.
8. Nothing merged to `main`; work ships on the `hq-rpg` branch for a preview first.
9. The Dream Journal is the only writer: one new file per confirmed save, in a folder the app creates (drive.file),
   never in the operating-system folders.
10. Coworker answers are deterministic and labeled with their sources; an optional local Ollama model is off by
    default and labeled as not checked against records.
11. Voice commands are opt-in and always confirm before acting; dictation relies on the OS (Superwhisper or
    macOS Dictation) typing into real text fields.

## Implementation checklist

- [x] Phase 1: inspect repo, checkout skills, Drive conventions, lanes (inventory kept out of this public repo)
- [x] Architecture and checklist committed
- [x] Next.js + Phaser scaffold, classic app preserved, legacy API routes ported
- [x] Shared parsers: markdown normalize, frontmatter, sections, loops tags, daily file, OS file, lane registry, ideas
- [x] Google sign-in (PKCE, allowlist, encrypted cookie, refresh) and setup/missing-permission states
- [x] Drive resolver + endpoints: overview, checkout, loops, OS, lanes, calendar, gmail, search, archive, doc, ideas,
      automations, personal, journal (confirm-gated), war room (public site data)
- [x] World: original pixel art, rooms, collisions, transitions, interactables, NPCs, lighting, sound with mute/volume
- [x] Input router: gamepad (dead zones, repeat, reconnect, indicator), keyboard, mouse, touch controls, text mode
- [x] Panels: briefing, checkout, loops, calendar, deadlines, decisions, lanes, comms, compose, search, map, menu,
      settings, NPC dialogue, archive, automations, war room, dream board, surprise me, journal, personal
- [x] Voice: dictation-ready focus, opt-in speech commands with confirmation
- [x] Mobile: responsive canvas, touch joystick and buttons, phone mode
- [x] Tests: unit, real-data parser check (local only, never committed), headless browser walk with simulated gamepad,
      offline / denied-permission run, phone viewport
- [x] Setup steps documented (docs/SETUP-GOOGLE.md)
- [ ] Branch pushed, preview verified
