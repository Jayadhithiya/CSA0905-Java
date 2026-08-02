# Stacks — Smart Library Occupancy & Reservation Platform

A working full-stack application with a real SQLite database, a REST + real-time
(Socket.io) backend, and a browser dashboard. Built around the three modules you
specified:

1. **Occupancy Tracking** — every seat/room has a live status (`available`,
   `occupied`, `reserved`, `maintenance`). Status changes are pushed to every
   connected browser instantly over WebSockets, and every change is logged
   immutably for analytics.
2. **Reservation** — students book a seat or study room for a future time
   window. The backend rejects overlapping bookings, auto-activates a
   reservation's `reserved` status when its window starts, and auto-releases
   the seat if no one checks in.
3. **Usage Analytics** — peak-hour charts, 7-day occupancy trends, zone
   utilization, and busiest-seat rankings, computed directly from the
   occupancy log table.

## Tech stack

| Layer      | Choice                                   | Why                                              |
|------------|-------------------------------------------|---------------------------------------------------|
| Database   | SQLite (via Node's built-in `node:sqlite`) | Zero-config, file-based, trivially backed up; no native compile step to break on deploy; swap for Postgres later without changing the API layer if you outgrow it |
| Backend    | Node.js + Express                         | Simple, fast to extend with more sensor integrations |
| Real-time  | Socket.io                                 | Pushes occupancy changes to every open dashboard instantly (mirrors real sensor feeds) |
| Frontend   | Vanilla HTML/CSS/JS + Chart.js            | No build step — open it and it works |

## Project structure

```
smart-library/
├── server.js              # Express app, Socket.io, background maintenance job
├── db/
│   ├── schema.sql          # Table definitions
│   ├── database.js         # DB connection (auto-applies schema on boot)
│   ├── seed.js              # Creates demo zones/spaces/users (run once)
│   └── simulateHistory.js   # Backfills 7 days of demo activity for analytics
├── routes/
│   ├── occupancy.js         # Module 1: spaces, check-in/out, live summary
│   ├── reservations.js      # Module 2: booking, conflict checks, cancellation
│   ├── analytics.js         # Module 3: trends, peak hours, zone/space usage
│   └── users.js
└── public/                  # Dashboard (served as static files)
    ├── index.html
    ├── css/style.css
    └── js/app.js
```

## Running it locally

Requires **Node.js 22.5 or newer** (uses Node's built-in `node:sqlite` module,
so there's no native database driver to compile — `npm install` never touches
a C++ toolchain, and there's nothing to break on a locked-down deploy box).
Check your version with `node -v`; if you're on an older Node, install a
current one via [nvm](https://github.com/nvm-sh/nvm) (`nvm install 22`).

```bash
cd smart-library
npm install
npm run setup      # one-time: creates zones/seats/rooms/demo users + demo analytics history
npm start
```

Open **http://localhost:3000**. That's the whole setup — the database is a
single file at `db/library.db` (SQLite), created automatically on first run.

This package actually ships with `db/library.db` already seeded and
pre-populated with a week of demo activity, so you can run `npm install &&
npm start` and see a fully working dashboard immediately. `npm run setup` is
there for when you want to reset to a clean/empty state (see below).

To reset everything: stop the server and delete `db/library.db*`, then re-run
the two setup scripts above.

## How the three modules work

### 1. Occupancy Tracking
- `spaces` table holds every seat/room with a `status` column and a
  `sensor_id` (so you can map each row to a real IR/pressure sensor or a
  check-in kiosk later — the API doesn't care which).
- `POST /api/spaces/:id/checkin` and `/checkout` are what a real sensor or a
  QR-code kiosk at each desk would call. Every call writes an entry to the
  append-only `occupancy_logs` table — nothing is ever overwritten, so you
  always have a full history.
- Socket.io broadcasts `occupancy:update` to every connected browser the
  instant a status changes — this is what makes the dashboard "real-time"
  without polling.

### 2. Reservation
- `POST /api/reservations` checks for overlapping bookings on that space
  before confirming (`hasConflict` in `routes/reservations.js`).
- A background sweep (`runMaintenanceSweep`, every 30s in `server.js`):
  - flips a space to `reserved` the moment a confirmed booking's start time
    arrives,
  - marks a reservation `completed` if the user checked in, or `no_show` if
    they didn't, once the window ends, and
  - releases the space back to `available` automatically so seats never get
    stuck as "reserved" forever.

### 3. Usage Analytics
All analytics are computed straight from `occupancy_logs`, so they reflect
real activity, not a separate reporting pipeline that can drift out of sync:
- `GET /api/analytics/peak-hours` — check-ins bucketed by hour-of-day (0–23),
  the number you'd use for staffing/peak-hour planning.
- `GET /api/analytics/trends?days=7` — hourly check-in/out volume over time.
- `GET /api/analytics/zone-usage` — which floors/zones get used most.
- `GET /api/analytics/space-utilization` — busiest individual seats/rooms.
- `GET /api/analytics/kpis` — headline numbers for the dashboard header.

`db/simulateHistory.js` backfills a realistic week of activity (quiet at
night, busy late morning and afternoon) purely so these charts aren't empty
on a freshly installed system — delete that data any time by wiping
`occupancy_logs`; real check-ins will populate it going forward.

## Full REST API reference

| Method | Endpoint                              | Purpose |
|--------|----------------------------------------|---------|
| GET    | `/api/zones`                           | List floors/zones |
| GET    | `/api/spaces`                          | List seats/rooms (`?zone_id&type&status`) |
| GET    | `/api/spaces/:id`                      | Single space detail |
| GET    | `/api/occupancy/summary`               | Live counts by status |
| POST   | `/api/spaces/:id/checkin`              | Mark a space occupied |
| POST   | `/api/spaces/:id/checkout`             | Mark a space free |
| POST   | `/api/spaces/:id/maintenance`          | Toggle maintenance mode |
| GET    | `/api/reservations`                    | List bookings (`?user_id&space_id&status`) |
| POST   | `/api/reservations`                    | Create a booking |
| DELETE | `/api/reservations/:id`                | Cancel a booking |
| GET    | `/api/analytics/kpis`                  | Dashboard headline numbers |
| GET    | `/api/analytics/peak-hours`            | Check-ins by hour of day |
| GET    | `/api/analytics/trends`                | Hourly trend, last N days |
| GET    | `/api/analytics/zone-usage`            | Usage by zone |
| GET    | `/api/analytics/space-utilization`     | Busiest spaces |
| GET    | `/api/users`                           | List demo users |
| POST   | `/api/users`                           | Register a user |

## Deploying to a real library

This runs as a normal Node.js app, so it fits any standard host:

1. **Small deployment (single library, one server):**
   Run it on a campus server or a small VPS (e.g. a $5–10/mo box) with
   `pm2` or `systemd` to keep it alive, e.g.:
   ```bash
   npm install -g pm2
   pm2 start server.js --name stacks-library
   pm2 save && pm2 startup
   ```
   Put it behind Nginx/Caddy for HTTPS and a proper domain.

2. **Connecting real sensors:** point your seat sensors, RFID readers, or a
   kiosk app at `POST /api/spaces/:id/checkin` / `/checkout` with the
   `sensor_id` you registered in the `spaces` table. No frontend changes
   needed — the dashboard updates the instant the API is called.

3. **Scaling beyond one library / need concurrent writers from many
   buildings:** swap SQLite for Postgres. Because all database access goes
   through `db/database.js` and the route files, this means changing that
   one file to a Postgres client (e.g. `pg`) and adjusting the handful of
   SQLite-specific functions (`datetime('now')`, `strftime`) to their
   Postgres equivalents — the rest of the app (routes, frontend, real-time
   layer) does not need to change.

4. **Authentication:** the current `users` table and `/api/users` endpoint
   are intentionally minimal (a demo user picker) so you can plug in your
   institution's actual login (student ID card, SSO, etc.) — replace the
   user-selection dropdown in `public/js/app.js` with your auth flow and
   pass the resulting `user_id` through to the existing reservation
   endpoints unchanged.

## Notes on the "sensor" simulation

Since this environment doesn't have physical hardware attached, check-in/out
is triggered from the dashboard buttons (standing in for a kiosk, badge
reader, or pressure sensor). Everything downstream — status changes, logging,
real-time broadcast, analytics — behaves exactly as it would with real
sensors; only the trigger differs.
