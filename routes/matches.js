const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { calculateElo, validateScore } = require('../utils/elo');

// Fonction pour recalculer tous les Elo depuis le début
function recalculateAllElo() {
  const transaction = db.transaction(() => {
    // Remettre tous les joueurs à 1000 Elo
    db.prepare('UPDATE players SET elo = 1000, wins = 0, losses = 0, points_won = 0, points_lost = 0').run();
    
    // Récupérer tous les matchs dans l'ordre chronologique
    const matches = db.prepare('SELECT * FROM matches ORDER BY played_at ASC, id ASC').all();
    
    // Recalculer chaque match
    for (const match of matches) {
      const winner = db.prepare('SELECT * FROM players WHERE id = ?').get(match.winner_id);
      const loser = db.prepare('SELECT * FROM players WHERE id = ?').get(match.loser_id);
      
      if (!winner || !loser) continue; // Skip si joueur supprimé
      
      const { newWinnerElo, newLoserElo, eloChange } = 
        calculateElo(winner.elo, loser.elo, match.winner_score, match.loser_score);
      
      // Mettre à jour les Elo
      db.prepare('UPDATE players SET elo = ?, wins = wins + 1, points_won = points_won + ?, points_lost = points_lost + ? WHERE id = ?')
        .run(newWinnerElo, match.winner_score, match.loser_score, match.winner_id);
      db.prepare('UPDATE players SET elo = ?, losses = losses + 1, points_won = points_won + ?, points_lost = points_lost + ? WHERE id = ?')
        .run(newLoserElo, match.loser_score, match.winner_score, match.loser_id);
      
      // Mettre à jour les métadonnées du match
      db.prepare('UPDATE matches SET winner_elo_before = ?, loser_elo_before = ?, elo_change = ? WHERE id = ?')
        .run(winner.elo, loser.elo, eloChange, match.id);
    }
  });
  
  transaction();
}

// Enregistrer un nouveau match
router.post('/', (req, res) => {
  const { winnerId, loserId, winnerScore, loserScore } = req.body;
  
  if (!winnerId || !loserId || winnerId === loserId) {
    return res.status(400).json({ error: 'IDs invalides' });
  }
  
  if (!winnerScore || !loserScore || winnerScore < 0 || loserScore < 0) {
    return res.status(400).json({ error: 'Scores invalides' });
  }
  
  if (!validateScore(winnerScore, loserScore)) {
    return res.status(400).json({ 
      error: 'Score invalide. Règles: minimum 21 points, écart de 2 si >= 20-20' 
    });
  }

  const winner = db.prepare('SELECT * FROM players WHERE id = ?').get(winnerId);
  const loser = db.prepare('SELECT * FROM players WHERE id = ?').get(loserId);

  if (!winner || !loser) {
    return res.status(404).json({ error: 'Joueur non trouvé' });
  }

  const { newWinnerElo, newLoserElo, eloChange, dominanceFactor } = 
    calculateElo(winner.elo, loser.elo, winnerScore, loserScore);

  const transaction = db.transaction(() => {
    db.prepare(`UPDATE players SET 
      elo = ?, wins = wins + 1, 
      points_won = points_won + ?, points_lost = points_lost + ?
      WHERE id = ?`)
      .run(newWinnerElo, winnerScore, loserScore, winnerId);
    
    db.prepare(`UPDATE players SET 
      elo = ?, losses = losses + 1,
      points_won = points_won + ?, points_lost = points_lost + ?
      WHERE id = ?`)
      .run(newLoserElo, loserScore, winnerScore, loserId);
    
    db.prepare(`INSERT INTO matches 
      (winner_id, loser_id, winner_score, loser_score, winner_elo_before, loser_elo_before, elo_change) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(winnerId, loserId, winnerScore, loserScore, winner.elo, loser.elo, eloChange);
  });

  transaction();

  res.json({
    message: 'Match enregistré',
    score: `${winnerScore} - ${loserScore}`,
    winner: { name: winner.name, oldElo: winner.elo, newElo: newWinnerElo },
    loser: { name: loser.name, oldElo: loser.elo, newElo: newLoserElo },
    eloChange,
    dominanceFactor: `${dominanceFactor}%`
  });
});

// Supprimer un match
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
  if (!match) {
    return res.status(404).json({ error: 'Match non trouvé' });
  }

  // Supprimer le match
  db.prepare('DELETE FROM matches WHERE id = ?').run(id);
  
  // Recalculer tous les Elo
  recalculateAllElo();

  res.json({ message: 'Match supprimé et Elo recalculés', match });
});

// Modifier un match
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { winnerId, loserId, winnerScore, loserScore } = req.body;
  
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
  if (!match) {
    return res.status(404).json({ error: 'Match non trouvé' });
  }

  if (!winnerId || !loserId || winnerId === loserId) {
    return res.status(400).json({ error: 'IDs invalides' });
  }
  
  if (!winnerScore || !loserScore || winnerScore < 0 || loserScore < 0) {
    return res.status(400).json({ error: 'Scores invalides' });
  }
  
  if (!validateScore(winnerScore, loserScore)) {
    return res.status(400).json({ 
      error: 'Score invalide. Règles: minimum 21 points, écart de 2 si >= 20-20' 
    });
  }

  const winner = db.prepare('SELECT * FROM players WHERE id = ?').get(winnerId);
  const loser = db.prepare('SELECT * FROM players WHERE id = ?').get(loserId);

  if (!winner || !loser) {
    return res.status(404).json({ error: 'Joueur non trouvé' });
  }

  // Mettre à jour le match avec les nouvelles données
  db.prepare(`UPDATE matches SET 
    winner_id = ?, loser_id = ?, 
    winner_score = ?, loser_score = ?
    WHERE id = ?`)
    .run(winnerId, loserId, winnerScore, loserScore, id);
  
  // Recalculer tous les Elo
  recalculateAllElo();

  // Récupérer les nouveaux Elo après recalcul
  const updatedWinner = db.prepare('SELECT * FROM players WHERE id = ?').get(winnerId);
  const updatedLoser = db.prepare('SELECT * FROM players WHERE id = ?').get(loserId);
  const updatedMatch = db.prepare('SELECT * FROM matches WHERE id = ?').get(id);

  res.json({
    message: 'Match modifié et Elo recalculés',
    score: `${winnerScore} - ${loserScore}`,
    winner: { name: winner.name, newElo: updatedWinner.elo },
    loser: { name: loser.name, newElo: updatedLoser.elo },
    eloChange: updatedMatch.elo_change
  });
});

// Lister les matchs
router.get('/', (req, res) => {
  const matches = db.prepare(`
    SELECT m.*, 
           w.name as winner_name, 
           l.name as loser_name
    FROM matches m
    JOIN players w ON m.winner_id = w.id
    JOIN players l ON m.loser_id = l.id
    ORDER BY m.played_at DESC
    LIMIT 50
  `).all();
  res.json(matches);
});

module.exports = router;