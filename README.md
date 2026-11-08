# Jesse HQ

A small pixel-art headquarters you walk around with an Xbox controller, keyboard, mouse or touch. Each room is a
window onto real records: the daily checkout, the loops spine, the operating-system file, calendar and inbox,
read live from Google. Nothing is sample data; when a source isn't connected, the room says so.

- **Command Center**: briefing, checkout, loops, deadlines, decisions, OS file
- **Work District**: one building per active lane, generated from the current OS file
- **Hawks War Room**: hawkswarroom.com, game sheets, picks leaderboard
- **Communications Hub**: inbox previews, follow-ups, compose (opens Gmail; never sends)
- **Library**: archive and search, with the Archivist
- **AI & Automation Lab**: what your workflows wrote to Drive
- **Dream Lounge and garden**: Dream Board, Surprise Me (simple rules, not AI), Dream Journal
- **Personal Space**: private notes, entered on purpose, every section covered until revealed

The coworkers are fictional characters. Their answers are your own records, arranged by simple rules.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # parser and voice-routing tests
npm run e2e        # headless Chrome walk with a simulated controller (needs a running server)
```

`e2e/README.md` also covers the signed-in walk, which runs every panel and coworker topic with Google mocked.
After setup, `docs/TEST-CHECKLIST.md` is a 15-minute hands-on check.

Google sign-in setup (about 10 minutes, free): [docs/SETUP-GOOGLE.md](docs/SETUP-GOOGLE.md).
How it's built and the privacy rules it follows: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Controls, dictation and voice commands: [docs/VOICE.md](docs/VOICE.md).

The original static HQ still lives at `/classic`.
