// Seeds the database with realistic starting data.
// Safe to re-run: it only inserts if tables are empty.
const { db } = require('./database');

function seed() {
  const zoneCount = db.prepare('SELECT COUNT(*) AS c FROM zones').get().c;
  if (zoneCount > 0) {
    console.log('Database already seeded — skipping.');
    return;
  }

  const insertZone = db.prepare('INSERT INTO zones (name, floor, description) VALUES (?, ?, ?)');
  const zones = [
    ['Ground Floor Reading Hall', 'G', 'Open silent-study seating'],
    ['First Floor Group Study', '1', 'Collaborative tables and study rooms'],
    ['Second Floor Quiet Zone', '2', 'Individual carrels, silence enforced'],
  ];
  const zoneIds = zones.map(z => insertZone.run(...z).lastInsertRowid);

  const insertSpace = db.prepare(`
    INSERT INTO spaces (zone_id, code, type, capacity, has_power, status, sensor_id)
    VALUES (?, ?, ?, ?, ?, 'available', ?)
  `);

  // Ground floor: 20 individual seats
  for (let i = 1; i <= 20; i++) {
    insertSpace.run(zoneIds[0], `G-S${String(i).padStart(2, '0')}`, 'seat', 1, i % 3 === 0 ? 1 : 0, `SENSOR-G-${i}`);
  }
  // First floor: 10 seats + 4 study rooms (capacity 6)
  for (let i = 1; i <= 10; i++) {
    insertSpace.run(zoneIds[1], `F1-S${String(i).padStart(2, '0')}`, 'seat', 1, 1, `SENSOR-F1-${i}`);
  }
  for (let i = 1; i <= 4; i++) {
    insertSpace.run(zoneIds[1], `F1-ROOM${i}`, 'study_room', 6, 1, `SENSOR-F1-R${i}`);
  }
  // Second floor: 25 quiet seats
  for (let i = 1; i <= 25; i++) {
    insertSpace.run(zoneIds[2], `F2-S${String(i).padStart(2, '0')}`, 'seat', 1, i % 4 === 0 ? 1 : 0, `SENSOR-F2-${i}`);
  }

  const insertUser = db.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)');
  const demoUsers = [
    ['Ananya Rao', 'ananya.rao@example.edu', 'student'],
    ['Karthik Subramanian', 'karthik.s@example.edu', 'student'],
    ['Priya Menon', 'priya.menon@example.edu', 'student'],
    ['Library Admin', 'admin@example.edu', 'admin'],
  ];
  demoUsers.forEach(u => insertUser.run(...u));

  console.log(`Seeded ${zoneIds.length} zones and ${db.prepare('SELECT COUNT(*) AS c FROM spaces').get().c} spaces.`);
}

seed();
