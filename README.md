# Michala's Home Supplies Tracker

A mobile-friendly, shared inventory tracker built for a home care team to log daily
supply counts and generate a restock report, with no login required to use it.

Live demo: https://agbaike.github.io/michala-supplies-tracker/

![Inventory view](screenshots/Screenshot%202026-07-09%20172655.png)

![Today's Report view](screenshots/Screenshot%202026-07-09%20172739.png)

## Features

- Tap-to-update stock counts for each item, with support for items sold in
  cartons, packs, or single units (e.g. Fresubin: cartons of packs of bottles)
- Automatic status per item: OK, Running Low, or Out of Stock
- A "Today's Report" tab that groups items by urgency and suggests how much
  to buy, in the actual unit the item is purchased in (e.g. "Buy 3 cartons")
- A "Copy list" button to paste the shopping list straight into WhatsApp
- Shared, real-time-ish data: everyone using the link sees the same numbers
- No backend server required, data is stored in a free Firebase Realtime
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
│   └── firebase.config.js            # Your real config, committed (see "A note on data security" below)
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

## Deploying an update

Browsers (especially on phones) can keep an old cached copy of styles.css
and app.js even after you've pushed a fix. To make sure everyone actually
gets the new version, bump the ?v=2 query string on both <link>/<script>
tags in index.html every time you deploy a change, e.g. ?v=3, ?v=4, and
so on.

## A note on data security

This is a client-only static site with no backend server, so the Firebase
database URL is necessarily visible to anyone who views the page's source,
since that's just how static sites work. `config/firebase.config.js` is
committed to this repo (this project has no build step or deploy pipeline,
so GitHub Pages serves whatever is in the repo directly — a gitignored file
would simply 404 on the live site and silently break saving). Since the URL
is already visible in the page source to anyone with the link, committing it
does not meaningfully add exposure, but it is not a substitute for real
access control.

By default the Firebase Realtime Database rules in this project are set to
open read/write, which is a reasonable starting point for a small, trusted
team. If this ever needs to be locked down further, Firebase supports
authentication and per-user security rules, and that would be the next step to take.

## License

MIT: see [LICENSE](LICENSE). Feel free to fork and adapt this for your own
team's supply tracking.
