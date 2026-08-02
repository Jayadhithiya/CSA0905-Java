const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

function logEvent(space_id, event_type, meta = {}) {
  db.prepare(`INSERT INTO occupancy_logs (space_id, event_type, meta) VALUES (?, ?, ?)`)
    .run(space_id, event_type, JSON.stringify(meta));
}

function broadcast(req, event, payload) {
  const io = req.app.get('io');
  if (io) io.emit(event, payload);
}

function summary() {
  const rows = db.prepare(`SELECT status, COUNT(*) AS count FROM spaces GROUP BY status`).all();
  const total = db.prepare(`SELECT COUNT(*) AS c FROM spaces`).get().c;
  const byStatus = { available: 0, occupied: 0, reserved: 0, maintenance: 0 };
  rows.forEach(r => { byStatus[r.status] = r.count; });
  return { total, ...byStatus, occupancyRate: total ? +(((byStatus.occupied + byStatus.reserved) / total) * 100).toFixed(1) : 0 };
}

// -- Zones -------------------------------------------------------------
router.get('/zones', (req, res) => {
  res.json(db.prepare('SELECT * FROM zones ORDER BY id').all());
});

// -- Spaces / live occupancy --------------------------------------------
router.get('/spaces', (req, res) => {
  const { zone_id, type, status } = req.query;
  let q = `SELECT s.*, z.name AS zone_name FROM spaces s JOIN zones z ON z.id = s.zone_id WHERE 1=1`;
  const params = [];
  if (zone_id) { q += ' AND s.zone_id = ?'; params.push(zone_id); }
  if (type)    { q += ' AND s.type = ?';    params.push(type); }
  if (status)  { q += ' AND s.status = ?';  params.push(status); }
  q += ' ORDER BY s.code';
  res.json(db.prepare(q).all(...params));
});

router.get('/spaces/:id', (req, res) => {
  const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(req.params.id);
  if (!space) return res.status(404).json({ error: 'Space not found' });
  res.json(space);
});

router.get('/occupancy/summary', (req, res) => {
  res.json(summary());
});

// -- Live occupied list: each occupied space + who checked in ----------
router.get('/occupancy/live', (req, res) => {
  const rows = db.prepare(`
    SELECT
      s.id, s.code, s.type, s.capacity, s.has_power, s.last_updated,
      z.name AS zone_name,
      l.meta, l.occurred_at AS checked_in_at
    FROM spaces s
    JOIN zones z ON z.id = s.zone_id
    LEFT JOIN occupancy_logs l ON l.id = (
      SELECT id FROM occupancy_logs
      WHERE space_id = s.id AND event_type = 'check_in'
      ORDER BY occurred_at DESC LIMIT 1
    )
    WHERE s.status = 'occupied'
    ORDER BY l.occurred_at DESC
  `).all();

  const result = rows.map(r => {
    let user_name = 'Unknown';
    try { const m = JSON.parse(r.meta || '{}'); user_name = m.user_name || 'Unknown'; } catch {}
    return { ...r, user_name };
  });
  res.json(result);
});

// -- Check in ----------------------------------------------------------
router.post('/spaces/:id/checkin', (req, res) => {
  const { user_id, user_name } = req.body;
  const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(req.params.id);
  if (!space) return res.status(404).json({ error: 'Space not found' });
  if (space.status === 'maintenance') return res.status(409).json({ error: 'Space under maintenance' });
  if (space.status === 'occupied')    return res.status(409).json({ error: 'Space already occupied' });

  db.prepare(`UPDATE spaces SET status = 'occupied', last_updated = CURRENT_TIMESTAMP WHERE id = ?`).run(space.id);
  logEvent(space.id, 'check_in', { user_id: user_id || null, user_name: user_name || null });

  // If this check-in fulfills an active reservation, mark it checked_in
  db.prepare(`
    UPDATE reservations SET checked_in = 1
    WHERE space_id = ? AND status = 'confirmed'
      AND datetime('now') BETWEEN start_time AND end_time
  `).run(space.id);

  const updated = db.prepare('SELECT * FROM spaces WHERE id = ?').get(space.id);
  broadcast(req, 'occupancy:update', { space: updated, summary: summary() });
  res.json(updated);
});

// -- Check out ---------------------------------------------------------
router.post('/spaces/:id/checkout', (req, res) => {
  const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(req.params.id);
  if (!space) return res.status(404).json({ error: 'Space not found' });

  db.prepare(`UPDATE spaces SET status = 'available', last_updated = CURRENT_TIMESTAMP WHERE id = ?`).run(space.id);
  logEvent(space.id, 'check_out', {});

  const updated = db.prepare('SELECT * FROM spaces WHERE id = ?').get(space.id);
  broadcast(req, 'occupancy:update', { space: updated, summary: summary() });
  res.json(updated);
});

// -- Admin: toggle maintenance mode ------------------------------------
router.post('/spaces/:id/maintenance', (req, res) => {
  const { enabled } = req.body;
  const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(req.params.id);
  if (!space) return res.status(404).json({ error: 'Space not found' });
  const newStatus = enabled ? 'maintenance' : 'available';
  db.prepare(`UPDATE spaces SET status = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?`).run(newStatus, space.id);
  logEvent(space.id, 'sensor_update', { maintenance: !!enabled });
  const updated = db.prepare('SELECT * FROM spaces WHERE id = ?').get(space.id);
  broadcast(req, 'occupancy:update', { space: updated, summary: summary() });
  res.json(updated);
});

module.exports = { router, logEvent, broadcast, summary };
