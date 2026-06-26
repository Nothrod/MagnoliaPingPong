const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const players = db.prepare('SELECT * FROM players ORDER BY elo DESC').all();
  res.json(players);
});

module.exports = router;