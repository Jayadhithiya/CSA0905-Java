-- =====================================================================
-- Smart Library Occupancy & Reservation Platform - Database Schema
-- SQLite
-- =====================================================================

PRAGMA foreign_keys = ON;

-- Physical zones in the library (Floors / Reading Halls / Labs etc.)
CREATE TABLE IF NOT EXISTS zones (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,          -- e.g. "Ground Floor Reading Hall"
    floor       TEXT,
    description TEXT
);

-- Bookable / trackable spaces: individual seats AND study rooms
CREATE TABLE IF NOT EXISTS spaces (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id       INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    code          TEXT NOT NULL UNIQUE,     -- e.g. "S-101", "ROOM-3"
    type          TEXT NOT NULL CHECK(type IN ('seat','study_room')),
    capacity      INTEGER NOT NULL DEFAULT 1,
    has_power     INTEGER NOT NULL DEFAULT 0,  -- boolean 0/1
    status        TEXT NOT NULL DEFAULT 'available'
                  CHECK(status IN ('available','occupied','reserved','maintenance')),
    sensor_id     TEXT,                       -- maps to a physical/simulated sensor
    last_updated  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users (students / staff)
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','staff','admin')),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reservations made in advance
CREATE TABLE IF NOT EXISTS reservations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    space_id      INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_time    DATETIME NOT NULL,
    end_time      DATETIME NOT NULL,
    status        TEXT NOT NULL DEFAULT 'confirmed'
                  CHECK(status IN ('confirmed','cancelled','completed','no_show')),
    checked_in    INTEGER NOT NULL DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Immutable event log: every check-in / check-out / sensor ping / reservation
-- event is appended here. This is the source of truth for analytics.
CREATE TABLE IF NOT EXISTS occupancy_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    space_id    INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    event_type  TEXT NOT NULL CHECK(event_type IN
                 ('check_in','check_out','reserved','reservation_cancelled','sensor_update','auto_release')),
    occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    meta        TEXT   -- JSON blob for extra context (user id, reservation id, etc.)
);

CREATE INDEX IF NOT EXISTS idx_logs_space_time ON occupancy_logs(space_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_logs_time ON occupancy_logs(occurred_at);
CREATE INDEX IF NOT EXISTS idx_reservations_space_time ON reservations(space_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_spaces_status ON spaces(status);
