const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT id, name, email, role FROM users ORDER BY id').all());
});

router.post('/', (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  try {
    const result = db.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)')
      .run(name, email, role || 'student');
    res.status(201).json(db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    res.status(409).json({ error: 'A user with that email already exists' });
  }
});

module.exports = router;
