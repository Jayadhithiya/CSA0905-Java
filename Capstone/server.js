require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const { db, isNewDb } = require('./db/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.set('io', io);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const { router: occupancyRouter, summary } = require('./routes/occupancy');
const reservationsRouter = require('./routes/reservations');
const analyticsRouter = require('./routes/analytics');
const usersRouter = require('./routes/users');

app.use('/api', occupancyRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/users', usersRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ---------------------------------------------------------------------
// Background job: every 30s, auto-complete reservations whose window has
// passed, and auto-release any 'reserved' space whose reservation ended
// without a check-in (so seats don't get stuck as reserved forever).
// ---------------------------------------------------------------------
function runMaintenanceSweep() {
  const expired = db.prepare(`
    SELECT * FROM reservations WHERE status = 'confirmed' AND end_time < datetime('now')
  `).all();

  for (const r of expired) {
    const newStatus = r.checked_in ? 'completed' : 'no_show';
    db.prepare(`UPDATE reservations SET status = ? WHERE id = ?`).run(newStatus, r.id);

    const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(r.space_id);
    if (space && space.status === 'reserved') {
      db.prepare(`UPDATE spaces SET status = 'available', last_updated = CURRENT_TIMESTAMP WHERE id = ?`).run(space.id);
      db.prepare(`INSERT INTO occupancy_logs (space_id, event_type, meta) VALUES (?, 'auto_release', ?)`)
        .run(space.id, JSON.stringify({ reservation_id: r.id }));
    }
  }

  // Also flip 'available' spaces to 'reserved' if a confirmed reservation just became active
  const startingNow = db.prepare(`
    SELECT r.* FROM reservations r
    JOIN spaces s ON s.id = r.space_id
    WHERE r.status = 'confirmed' AND s.status = 'available'
      AND datetime('now') BETWEEN r.start_time AND r.end_time
  `).all();
  for (const r of startingNow) {
    db.prepare(`UPDATE spaces SET status = 'reserved', last_updated = CURRENT_TIMESTAMP WHERE id = ?`).run(r.space_id);
  }

  if (expired.length || startingNow.length) {
    io.emit('occupancy:update', { summary: summary() });
  }
}

setInterval(runMaintenanceSweep, 30 * 1000);

io.on('connection', (socket) => {
  socket.emit('occupancy:update', { summary: summary() });
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\nSmart Library platform running at http://localhost:${PORT}`);
  console.log(isNewDb ? 'Fresh database created.' : 'Using existing database.');
});
