# Michala's Home Supplies Tracker

A mobile-friendly, shared inventory tracker built for a home care team to log daily
supply counts and generate a restock report, with no login required to use it.

Live demo: _add your GitHub Pages link here once deployed_

## Features

- Tap-to-update stock counts for each item, with support for items sold in
  cartons, packs, or single units (e.g. Fresubin: cartons of packs of bottles)
- Automatic status per item: OK, Running Low, or Out of Stock
- A "Today's Report" tab that groups items by urgency and suggests how much
  to buy, in the actual unit the item is purchased in (e.g. "Buy 3 cartons")
- A "Copy list" button to paste the shopping list straight into WhatsApp
- Shared, real-time-ish data: everyone using the link sees the same numbers
- No backend server required — data is stored in a free Firebase Realtime
  Database and read/written directly from the browser

## Project structure

```
├── index.html                        # Page structure only
├── css/
│   └── styles.css                    # All styling
├── js/
│   └── app.js                        # All application logic
├── config/
│   ├── firebase.config.example.js    # Template — copy this file
│   └── firebase.config.js            # Your real config (gitignored, not in source control)
├── .gitignore
├── LICENSE
└── README.md
```

## Setup

1. Clone this repository.
2. Copy the example config and fill in your own database URL:
   ```
   cp config/firebase.config.example.js config/firebase.config.js
   ```
3. Create a free [Firebase](https://console.firebase.google.com) project,
   enable **Realtime Database**, and paste its URL into
   `config/firebase.config.js`.
4. Open `index.html` with a local server (e.g. VS Code's Live Server
   extension). Opening the file directly (`file://`) will not work, since
   the browser blocks outside network requests from local files.
5. Deploy the whole folder to any static host (GitHub Pages, Azure Static
   Web Apps, Netlify, etc.) to get a permanent link to share.

## A note on data security

This is a client-only static site with no backend server, so the Firebase
database URL is necessarily visible to anyone who views the page's source,
regardless of `.gitignore` — that's just how static sites work. The
`.gitignore` entry keeps the real URL out of the git history and off public
repository browsing, which is good practice, but it is not a substitute for
real access control.

By default the Firebase Realtime Database rules in this project are set to
open read/write, which is a reasonable starting point for a small, trusted
team. If this ever needs to be locked down further, Firebase supports
authentication and per-user security rules — that would be the next step.

## License

MIT — see [LICENSE](LICENSE). Feel free to fork and adapt this for your own
team's supply tracking.
