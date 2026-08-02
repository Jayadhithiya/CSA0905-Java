const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { logEvent, broadcast, summary } = require('./occupancy');

function hasConflict(space_id, start_time, end_time, excludeId = null) {
  let q = `
    SELECT COUNT(*) AS c FROM reservations
    WHERE space_id = ? AND status = 'confirmed'
      AND NOT (end_time <= ? OR start_time >= ?)
  `;
  const params = [space_id, start_time, end_time];
  if (excludeId) { q += ' AND id != ?'; params.push(excludeId); }
  return db.prepare(q).get(...params).c > 0;
}

// List reservations (optionally filter by user or space)
router.get('/', (req, res) => {
  const { user_id, space_id, status } = req.query;
  let q = `
    SELECT r.*, s.code AS space_code, s.type AS space_type, u.name AS user_name
    FROM reservations r
    JOIN spaces s ON s.id = r.space_id
    JOIN users u ON u.id = r.user_id
    WHERE 1=1
  `;
  const params = [];
  if (user_id) { q += ' AND r.user_id = ?'; params.push(user_id); }
  if (space_id) { q += ' AND r.space_id = ?'; params.push(space_id); }
  if (status) { q += ' AND r.status = ?'; params.push(status); }
  q += ' ORDER BY r.start_time DESC';
  res.json(db.prepare(q).all(...params));
});

// Create a reservation
router.post('/', (req, res) => {
  const { space_id, user_id, start_time, end_time } = req.body;
  if (!space_id || !user_id || !start_time || !end_time) {
    return res.status(400).json({ error: 'space_id, user_id, start_time, end_time are required' });
  }
  if (new Date(start_time) >= new Date(end_time)) {
    return res.status(400).json({ error: 'start_time must be before end_time' });
  }
  const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(space_id);
  if (!space) return res.status(404).json({ error: 'Space not found' });
  if (space.status === 'maintenance') return res.status(409).json({ error: 'Space under maintenance' });

  if (hasConflict(space_id, start_time, end_time)) {
    return res.status(409).json({ error: 'Space already reserved for an overlapping time window' });
  }

  const result = db.prepare(`
    INSERT INTO reservations (space_id, user_id, start_time, end_time, status)
    VALUES (?, ?, ?, ?, 'confirmed')
  `).run(space_id, user_id, start_time, end_time);

  logEvent(space_id, 'reserved', { reservation_id: result.lastInsertRowid, user_id });

  // If the reservation is active right now, reflect it in space status
  const now = new Date().toISOString();
  if (start_time <= now && now <= end_time && space.status === 'available') {
    db.prepare(`UPDATE spaces SET status = 'reserved', last_updated = CURRENT_TIMESTAMP WHERE id = ?`).run(space_id);
  }

  const updatedSpace = db.prepare('SELECT * FROM spaces WHERE id = ?').get(space_id);
  broadcast(req, 'occupancy:update', { space: updatedSpace, summary: summary() });

  const reservation = db.prepare(`
    SELECT r.*, s.code AS space_code FROM reservations r JOIN spaces s ON s.id = r.space_id WHERE r.id = ?
  `).get(result.lastInsertRowid);
  broadcast(req, 'reservation:created', reservation);
  res.status(201).json(reservation);
});

// Cancel a reservation
router.delete('/:id', (req, res) => {
  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
  if (reservation.status !== 'confirmed') return res.status(409).json({ error: 'Reservation is not active' });

  db.prepare(`UPDATE reservations SET status = 'cancelled' WHERE id = ?`).run(reservation.id);
  logEvent(reservation.space_id, 'reservation_cancelled', { reservation_id: reservation.id });

  // Free up the space if it was only 'reserved' (not physically occupied)
  const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(reservation.space_id);
  if (space && space.status === 'reserved') {
    db.prepare(`UPDATE spaces SET status = 'available', last_updated = CURRENT_TIMESTAMP WHERE id = ?`).run(space.id);
  }
  const updatedSpace = db.prepare('SELECT * FROM spaces WHERE id = ?').get(reservation.space_id);
  broadcast(req, 'occupancy:update', { space: updatedSpace, summary: summary() });
  broadcast(req, 'reservation:cancelled', { id: reservation.id });
  res.json({ success: true });
});

module.exports = router;
