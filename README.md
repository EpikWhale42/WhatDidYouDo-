# What Did You Do?

There are a thousand apps that let you take notes. Notion. Obsidian. Apple Notes. Bear. The list goes on. They're all beautifully designed, incredibly powerful, and most people barely use them.

Not because people are lazy. But because these apps wait for you. They sit there, open, empty, expecting you to walk in and do the work of remembering. And most of the time, you don't. You're busy. You're in flow. You forget. And by the end of the day, you genuinely cannot remember what you did at 10am.

This app is built around one simple belief: **the tool should come to you, not the other way around.**

---

<img width="577" height="369" alt="image" src="https://github.com/user-attachments/assets/5318cd28-c70a-4018-acba-d3b2359c9a48" />


## The idea

Every hour, a small window appears on your screen — right on top of whatever you're doing — and asks one question:

*What did you do in the last hour?*

You answer. It saves. It disappears.

That's it.

But over time, something more interesting happens. The app has an AI agent running alongside it, reading your answers, building a picture of what you're working on. So the next time it asks, it doesn't just ask the generic question. It asks:

*"You mentioned you were debugging the auth issue earlier — did you get that sorted?"*

It remembers. You don't have to.

---

## Why we built this

We got tired of end-of-day amnesia. Of writing "worked on various things" in standup. Of performance reviews where you struggle to reconstruct six months of work. Of having no record of what you actually spent your time on.

Every other productivity app puts the burden on you to be disciplined. Open the app. Log your work. Maintain your system. We think that's the wrong model. The app should be the disciplined one.

So we flipped it.

---

## How it works

- Lives in your menu bar. No dock icon, no window to manage, no app to open.
- Pops up every hour and asks what you did.
- AI reads your previous answers and generates a smarter question each time.
- Your responses are saved to a plain markdown file in `~/Documents/WhatDidYouDo-Logs/` — one file per day, yours forever, no cloud, no account.
- The AI keeps its own separate log — tracking your tasks, their status, what to follow up on.
- Tell it *"don't interrupt me for 2 hours"* and it actually listens. The tray icon switches to ⏸ and the popups stop until you're ready.
- Press `Cmd+Shift+N` from anywhere to log a note on your own terms.

---

## What it is not

It is not a task manager. It does not tell you what to do.

It is not a time tracker. It does not run in the background recording your screen or keystrokes.

It is not Notion. It does not have databases, templates, or a 45-minute onboarding.

It is simply a system that asks you what you did, remembers the answer, and builds an honest record of your days — without you having to think about it.

---

## Setup

1. Download the latest `.dmg` from [Releases](../../releases)
2. Drag **What Did You Do** into `/Applications`
3. Right-click → Open the first time (app is unsigned — we're working on that)
4. Click the tray icon and open **Settings**
5. Add your [OpenRouter](https://openrouter.ai) API key
6. That's it. The first question will appear shortly.

---

## The logs

Everything you tell the app is saved locally as plain markdown. No account. No sync. No server.

```
~/Documents/WhatDidYouDo-Logs/
  2026-04-29.md        ← your words, exactly as you typed them
  agent-2026-04-29.md  ← the AI's structured notes on your day
  settings.json        ← your preferences
```

The markdown files are yours. Open them in any editor, search them with Spotlight, back them up however you want. We have no access to them.

---

## This is v1

It works. It saves your work. It asks smarter questions over time. But there's a lot more we want to build — natural language retrieval ("what did I do last Tuesday?"), end-of-day summaries, a task tree for tracking parallel workstreams, team logs.

If you use this and have thoughts, open an issue. Or just tell us what you did today.

---

*Built with Electron + TypeScript. AI via [OpenRouter](https://openrouter.ai).*
