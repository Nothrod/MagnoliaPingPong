const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });

  try {
    const stmt = db.prepare('INSERT INTO players (name) VALUES (?)');
    const result = stmt.run(name);
    res.json({ id: result.lastInsertRowid, name, elo: 1000 });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Ce joueur existe déjà' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  const players = db.prepare('SELECT * FROM players ORDER BY name').all();
  res.json(players);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  try {
    const result = db.prepare('DELETE FROM players WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Joueur non trouvé' });
    }
    res.json({ message: 'Joueur supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

module.exports = router;