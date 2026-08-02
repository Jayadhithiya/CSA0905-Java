const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// Occupancy trend over the last N days, bucketed by hour.
// Approximates hourly occupied-seat-count from check_in/check_out events.
router.get('/trends', (req, res) => {
  const days = parseInt(req.query.days || '7', 10);
  const rows = db.prepare(`
    SELECT
      strftime('%Y-%m-%d %H:00', occurred_at) AS hour_bucket,
      SUM(CASE WHEN event_type = 'check_in' THEN 1 ELSE 0 END) AS check_ins,
      SUM(CASE WHEN event_type = 'check_out' THEN 1 ELSE 0 END) AS check_outs,
      SUM(CASE WHEN event_type = 'reserved' THEN 1 ELSE 0 END) AS reservations
    FROM occupancy_logs
    WHERE occurred_at >= datetime('now', ?)
    GROUP BY hour_bucket
    ORDER BY hour_bucket ASC
  `).all(`-${days} days`);
  res.json(rows);
});

// Average occupancy by hour-of-day (0-23) -> identifies peak hours
router.get('/peak-hours', (req, res) => {
  const rows = db.prepare(`
    SELECT
      CAST(strftime('%H', occurred_at) AS INTEGER) AS hour_of_day,
      COUNT(*) AS check_in_count
    FROM occupancy_logs
    WHERE event_type = 'check_in'
    GROUP BY hour_of_day
    ORDER BY hour_of_day ASC
  `).all();
  // Fill missing hours with 0 so the chart always has 24 points
  const filled = Array.from({ length: 24 }, (_, h) => {
    const found = rows.find(r => r.hour_of_day === h);
    return { hour_of_day: h, check_in_count: found ? found.check_in_count : 0 };
  });
  res.json(filled);
});

// Usage breakdown by zone (total check-ins, current occupancy rate)
router.get('/zone-usage', (req, res) => {
  const rows = db.prepare(`
    SELECT
      z.id AS zone_id,
      z.name AS zone_name,
      COUNT(DISTINCT s.id) AS total_spaces,
      SUM(CASE WHEN s.status = 'occupied' THEN 1 ELSE 0 END) AS occupied_now,
      SUM(CASE WHEN s.status = 'reserved' THEN 1 ELSE 0 END) AS reserved_now,
      (SELECT COUNT(*) FROM occupancy_logs l
         JOIN spaces s2 ON s2.id = l.space_id
         WHERE s2.zone_id = z.id AND l.event_type = 'check_in') AS total_check_ins
    FROM zones z
    JOIN spaces s ON s.zone_id = z.id
    GROUP BY z.id
    ORDER BY z.id
  `).all();
  res.json(rows);
});

// Space-level utilization ranking (busiest / least used seats & rooms)
router.get('/space-utilization', (req, res) => {
  const limit = parseInt(req.query.limit || '10', 10);
  const rows = db.prepare(`
    SELECT s.code, s.type, COUNT(*) AS check_in_count
    FROM occupancy_logs l
    JOIN spaces s ON s.id = l.space_id
    WHERE l.event_type = 'check_in'
    GROUP BY s.id
    ORDER BY check_in_count DESC
    LIMIT ?
  `).all(limit);
  res.json(rows);
});

// High-level KPIs for a dashboard header
router.get('/kpis', (req, res) => {
  const totalSpaces = db.prepare('SELECT COUNT(*) AS c FROM spaces').get().c;
  const occupiedNow = db.prepare(`SELECT COUNT(*) AS c FROM spaces WHERE status = 'occupied'`).get().c;
  const reservedNow = db.prepare(`SELECT COUNT(*) AS c FROM spaces WHERE status = 'reserved'`).get().c;
  const todayCheckIns = db.prepare(`
    SELECT COUNT(*) AS c FROM occupancy_logs
    WHERE event_type = 'check_in' AND date(occurred_at) = date('now')
  `).get().c;
  const activeReservations = db.prepare(`
    SELECT COUNT(*) AS c FROM reservations WHERE status = 'confirmed' AND end_time >= datetime('now')
  `).get().c;
  const peakRow = db.prepare(`
    SELECT CAST(strftime('%H', occurred_at) AS INTEGER) AS hour_of_day, COUNT(*) AS c
    FROM occupancy_logs WHERE event_type = 'check_in'
    GROUP BY hour_of_day ORDER BY c DESC LIMIT 1
  `).get();

  res.json({
    totalSpaces,
    occupiedNow,
    reservedNow,
    availableNow: totalSpaces - occupiedNow - reservedNow,
    occupancyRate: totalSpaces ? +(((occupiedNow + reservedNow) / totalSpaces) * 100).toFixed(1) : 0,
    todayCheckIns,
    activeReservations,
    peakHour: peakRow ? peakRow.hour_of_day : null,
  });
});

// Heatmap: check-ins by day-of-week (1=Mon…7=Sun) × hour of day
router.get('/heatmap', (req, res) => {
  const rows = db.prepare(`
    SELECT
      CAST(strftime('%w', occurred_at) AS INTEGER) AS dow_sun,
      CAST(strftime('%H', occurred_at) AS INTEGER) AS hour,
      COUNT(*) AS count
    FROM occupancy_logs
    WHERE event_type = 'check_in'
    GROUP BY dow_sun, hour
    ORDER BY dow_sun, hour
  `).all();
  // Convert SQLite's 0=Sun…6=Sat to 1=Mon…7=Sun
  const mapped = rows.map(r => ({
    dow:   r.dow_sun === 0 ? 7 : r.dow_sun,
    hour:  r.hour,
    count: r.count,
  }));
  res.json(mapped);
});

module.exports = router;
