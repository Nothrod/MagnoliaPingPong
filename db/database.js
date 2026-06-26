const Database = require('better-sqlite3');
const db = new Database('pingpong.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    elo INTEGER DEFAULT 1000,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    points_won INTEGER DEFAULT 0,
    points_lost INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    winner_id INTEGER NOT NULL,
    loser_id INTEGER NOT NULL,
    winner_score INTEGER NOT NULL,
    loser_score INTEGER NOT NULL,
    winner_elo_before INTEGER NOT NULL,
    loser_elo_before INTEGER NOT NULL,
    elo_change INTEGER NOT NULL,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (winner_id) REFERENCES players(id),
    FOREIGN KEY (loser_id) REFERENCES players(id)
  );
`);

module.exports = db;