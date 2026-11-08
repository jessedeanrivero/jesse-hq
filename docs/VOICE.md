# Controls, dictation and voice

## Controller (Xbox layout, browser standard mapping)

| Button | In the world | In a panel |
| --- | --- | --- |
| Left stick / D-pad | Walk | Move between buttons |
| A | Use, talk | Select |
| B | | Back / close (in a text box: leave the box first) |
| X | Secondary action shown in the prompt | Secondary action |
| Y | Search | Search |
| LB / RB | Previous / next room | Previous / next tab |
| RT (hold) | Run | |
| LT (hold) | Voice command, if turned on | Voice command, if turned on |
| View | Map | Map |
| Menu | Menu | Menu |
| Right stick | | Scroll |

Press any button once after connecting so the browser exposes the controller. A 🎮 chip appears in the top bar.

## Keyboard and mouse

WASD or arrows to walk, E / Space / Enter to use, Esc to close, F secondary, `/` or Ctrl/Cmd+K search,
`[` and `]` rooms or tabs, Shift to run, M map, Tab menu, hold V for a voice command. Click to walk somewhere
or to use a thing.

## Dictation (Superwhisper or macOS Dictation)

Every text box is an ordinary text field, so your dictation tool types into it like a keyboard:

1. Focus the box: press A on it with the controller, or click it. With a keyboard, boxes like Search and the
   Dream Journal are focused as soon as they open.
2. Use your Superwhisper hotkey, or the macOS Dictation shortcut you set in System Settings → Keyboard.
3. The world doesn't move while a box has focus. B or Esc leaves the box.

The app does not control Superwhisper and doesn't claim to. If you want a controller button for dictation, a tool
such as Steam's controller configuration can map a button to your dictation shortcut. That's outside this app and
hasn't been tested here.

## Voice commands (optional, off by default)

Settings → Voice → "Hold V or LT to speak a command". It uses the browser's built-in speech recognition; in
Chrome that audio is processed by Google's speech service. Commands come from a fixed list and always show what
was heard and wait for you to confirm:

- Open Hawks War Room / Go to the Command Center / Go to the Library
- Show my open loops / Open today's checkout / Open the calendar / Open my inbox
- Talk to the Archivist (or any coworker by name or role)
- Search for anything
- Compose an email to a name
- Surprise me / Open the map / Open settings

Anything else gets the list above instead of a guess.

## Local model (optional, off by default)

Settings → Voice → Local model lets coworkers pass your question and the records already on screen to Ollama
running on your own computer. Answers are labeled "Local model on this computer · not checked against your records".
Ollama must allow the site's origin (set `OLLAMA_ORIGINS`). No paid AI service is used anywhere.
