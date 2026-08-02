// Backfills the last 7 days of occupancy_logs with a realistic pattern
// (busier mid-day, quiet at night) purely so the Analytics module has
// something meaningful to chart on a freshly-installed system.
// Safe to re-run: skips if logs already exist.
const { db } = require('./database');

function weightForHour(hour) {
  // Rough bell-curve: quiet at night, peaks around 11am and 4pm (exam-season style)
  if (hour >= 1 && hour <= 7) return 0.02;
  if (hour >= 8 && hour <= 10) return 0.35;
  if (hour >= 11 && hour <= 13) return 0.85;
  if (hour >= 14 && hour <= 17) return 0.95;
  if (hour >= 18 && hour <= 20) return 0.6;
  return 0.15;
}

function toSqliteTs(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function run() {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM occupancy_logs').get().c;
  if (existing > 0) {
    console.log('Historical logs already present — skipping simulation.');
    return;
  }

  const spaces = db.prepare('SELECT id FROM spaces').all().map(s => s.id);
  if (spaces.length === 0) {
    console.log('No spaces found — run seed.js first.');
    return;
  }

  const insert = db.prepare(`INSERT INTO occupancy_logs (space_id, event_type, occurred_at) VALUES (?, ?, ?)`);
  function insertMany(events) {
    db.exec('BEGIN');
    try {
      for (const e of events) insert.run(e.space_id, e.event_type, e.occurred_at);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  const events = [];
  const now = new Date();

  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    for (let hour = 0; hour < 24; hour++) {
      const weight = weightForHour(hour);
      // Number of check-ins this hour, scaled by weight and a little randomness
      const activeSpaces = Math.round(spaces.length * weight * (0.7 + Math.random() * 0.3));
      const shuffled = [...spaces].sort(() => Math.random() - 0.5);
      for (let i = 0; i < activeSpaces; i++) {
        const spaceId = shuffled[i];
        const ts = new Date(now);
        ts.setDate(ts.getDate() - daysAgo);
        ts.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
        const checkInTime = toSqliteTs(ts);
        events.push({ space_id: spaceId, event_type: 'check_in', occurred_at: checkInTime });

        const checkOut = new Date(ts.getTime() + (20 + Math.random() * 100) * 60000);
        events.push({ space_id: spaceId, event_type: 'check_out', occurred_at: toSqliteTs(checkOut) });
      }
    }
  }

  insertMany(events);
  console.log(`Simulated ${events.length} historical occupancy events across the last 7 days.`);
}

run();
