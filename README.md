# Serpentine Lane — Community Garden Platform

A single Node service: an Express API plus the static frontend it serves.
No build step, no database server — data lives in a JSON file on disk.

## What's inside

```
backend/
  server.js          Express app — API routes + serves the frontend
  data/
    store.js          Tiny file-backed JSON store (read/transact helpers)
    db.json            Created automatically on first run, seeded with
                        24 plots and 3 events. Delete it to reset.
  routes/
    plots.js           GET /api/plots, GET /api/plots/:id,
                        POST /api/plots/:id/reserve, POST /api/plots/:id/release
    events.js          GET /api/events, POST /api/events/:id/rsvp
    community.js       POST /api/volunteer, POST /api/subscribe
  public/
    index.html          Home — hub linking out to the other four pages
    plots.html          The live plot map + reserve form
    events.html         Events board + RSVP forms
    volunteer.html      Volunteer signup
    join.html           Newsletter signup
    styles.css          Shared design system (colors, type, layout)
    app.js              Shared script — fetches from the API and wires
                        up whichever elements exist on the current page
```

## Pages & how they link together

It's a small multi-page site rather than one long scroll:

- Every page shares the same header nav and footer nav (`Plots · Events ·
  Volunteer · Join`), with the current page marked `aria-current="page"`.
- Home (`/`) is a hub: a hero pointing at Plots and Events, plus a link
  list to all four pages.
- Each inner page ends with a short contextual link to whichever page
  makes sense next — Plots points to Events ("once you've got a bed…"),
  Events points back to Plots and to Volunteer, Volunteer points to
  Join, Join points back to Plots and Events.
- `server.js` maps clean URLs (`/plots`, `/events`, `/volunteer`,
  `/join`) to their `.html` files, so links never expose the file
  extension.
- `app.js` is loaded on every page but checks for each element before
  wiring it up (e.g. the reserve form only exists on `/plots`), so one
  script file works across all five pages without errors on pages that
  don't have that piece.

## Run it locally

Requires Node 18+.

```bash
cd backend
npm install
npm start
```

Open http://localhost:3000. The plot map, events, and forms all hit the
real API — there's nothing to mock.

For auto-restart on file changes during development:

```bash
npm run dev
```

## Data model

`db.json` holds four collections: `plots`, `events`, `volunteers`,
`subscribers`. Every write goes through `transact()` in `data/store.js`,
which queues writes so two people reserving plots at the same instant
can't corrupt the file or double-book a bed.

This is intentionally simple — fine for one garden's worth of traffic.
If you outgrow a single JSON file (multiple garden sites, hundreds of
concurrent users), swap `data/store.js` for a real database; the routes
only call `read()` and `transact()`, so that's the one file to change.

## Customizing the seed data

Edit `seed()` in `backend/data/store.js` — plot count, sizes, prices,
and the starter events — then delete `backend/data/db.json` so it
reseeds on next start.

## Deploying

This is one Node process serving both the API and the static frontend,
so it deploys anywhere that runs a Node app:

**Render / Railway / Fly.io**
1. Push this repo to GitHub.
2. Create a new web service, point it at the repo, set the root
   directory to `backend`.
3. Build command: `npm install`. Start command: `npm start`.
4. They set `PORT` automatically — `server.js` already reads
   `process.env.PORT`.

**A plain VPS**
```bash
git clone <your-repo>
cd community-garden-platform/backend
npm install
npm start   # or run it under pm2 / systemd for a persistent process
```

**One thing to know about the JSON store**: on platforms with an
ephemeral filesystem (some free tiers redeploy to a clean disk),
`db.json` won't persist between deploys. Mount a persistent disk/volume
at `backend/data/` if your host offers one, or migrate to a real
database for production use.

## Design notes

Palette pulled from the reference board: First Frost `#DFE0DC`,
Spring `#D1D8BD`, Khaki Linen `#C7C2AB`, Ivy `#777E5C`, Serpentine
`#2B3106` — used respectively as surface, hover surface, plot-available
color, plot-reserved/accent color, and near-black text/primary button.
Typefaces are Fraunces (display) and Karla (body/UI), loaded from
Google Fonts in `index.html`.
