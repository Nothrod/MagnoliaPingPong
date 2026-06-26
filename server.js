/**
 * ============================================================================
 * Magnolia Ping Pong - Serveur Principal Express
 * ============================================================================
 * 
 * Ce fichier gère :
 * - La configuration du serveur Express
 * - Les sessions et l'authentification admin
 * - Les routes publiques (classement, matchs)
 * - Les routes protégées (administration)
 * - L'API REST complète pour joueurs et matchs
 * - L'algorithme ELO avancé avec domination et bonus underdog
 * 
 * @author Magnolia Ping Pong
 * @version 3.0.0
 * ============================================================================
 */

const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Import de la base de données (avec initialisation automatique)
const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// MIDDLEWARE GLOBAL
// ============================================================================

// Parser JSON et URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques du dossier public
app.use(express.static(path.join(__dirname, 'public')));

// Configuration des sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'elotracker-secret-key-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
}));

// Activer WAL mode pour meilleures performances SQLite
db.pragma('journal_mode = WAL');

// ============================================================================
// ALGORITHME ELO AVANCÉ
// ============================================================================

/**
 * Calcule la variation ELO pour un match
 * 
 * L'algorithme prend en compte :
 * 1. La différence d'ELO entre les joueurs (formule standard)
 * 2. Le facteur K dynamique (diminue avec l'expérience)
 * 3. Le facteur de domination (victoire écrasante = plus d'ELO)
 * 4. Le bonus underdog (un petit qui bat un gros gagne plus)
 * 
 * @param {Object} winner - Objet du joueur gagnant {elo, wins, losses}
 * @param {Object} loser - Objet du joueur perdant {elo, wins, losses}
 * @param {number} winnerScore - Score du gagnant
 * @param {number} loserScore - Score du perdant
 * @returns {Object} {eloChangeWinner, eloChangeLoser, details}
 */
function calculateEloChange(winner, loser, winnerScore, loserScore) {
  // -------------------------------------------------------------------------
  // 1. FACTEUR K DYNAMIQUE
  // -------------------------------------------------------------------------
  // Plus un joueur a d'expérience, plus son K diminue (stabilisation)
  // Formule : K = K_base / (1 + log10(1 + matchs_joués / 10))
  // - Nouveau joueur (0 match) : K ≈ 32
  // - Joueur moyen (20 matchs) : K ≈ 22
  // - Vétéran (100 matchs) : K ≈ 16
  
  const K_BASE = 32;
  const winnerMatches = winner.wins + winner.losses;
  const loserMatches = loser.wins + loser.losses;
  
  const Kw = K_BASE / (1 + Math.log10(1 + winnerMatches / 10));
  const Kl = K_BASE / (1 + Math.log10(1 + loserMatches / 10));
  
  // -------------------------------------------------------------------------
  // 2. PROBABILITÉ DE VICTOIRE ATTENDUE (formule ELO standard)
  // -------------------------------------------------------------------------
  // Si les deux joueurs ont le même ELO : expected = 0.5
  // Si winner a +200 ELO : expected ≈ 0.76
  // Si winner a +400 ELO : expected ≈ 0.91
  
  const expectedWinner = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400));
  const expectedLoser = 1 - expectedWinner;
  
  // -------------------------------------------------------------------------
  // 3. FACTEUR DE DOMINATION (basé sur le score)
  // -------------------------------------------------------------------------
  // Récompense les victoires écrasantes
  // - 11-10 (serré) : domination ≈ 1.0
  // - 11-5 (moyen) : domination ≈ 1.4
  // - 11-0 (écrasant) : domination ≈ 1.9
  
  const totalPoints = winnerScore + loserScore;
  const scoreDiff = winnerScore - loserScore;
  const dominationFactor = 1 + Math.log10(1 + (scoreDiff / totalPoints) * 5);
  
  // -------------------------------------------------------------------------
  // 4. BONUS UNDERDOG
  // -------------------------------------------------------------------------
  // Si le joueur avec le moins d'ELO gagne, bonus supplémentaire
  // Plus l'écart est grand, plus le bonus est important
  // Max bonus : +50% si écart > 400 ELO
  
  const eloDiff = Math.abs(winner.elo - loser.elo);
  let underdogBonusWinner = 1;
  let underdogBonusLoser = 1;
  
  if (winner.elo < loser.elo) {
    // Le gagnant est l'underdog → bonus pour lui
    underdogBonusWinner = 1 + Math.min(0.5, eloDiff / 800);
  } else if (loser.elo < winner.elo) {
    // Le perdant est l'underdog → il perd moins (protection)
    underdogBonusLoser = 1 - Math.min(0.3, eloDiff / 1300);
  }
  
  // -------------------------------------------------------------------------
  // 5. CALCUL FINAL
  // -------------------------------------------------------------------------
  
  let eloChangeWinner = Math.round(
    Kw * (1 - expectedWinner) * dominationFactor * underdogBonusWinner
  );
  
  let eloChangeLoser = -Math.round(
    Kl * expectedLoser * dominationFactor * underdogBonusLoser
  );
  
  // Protection : minimum +1 pour le gagnant, maximum -1 pour le perdant
  if (eloChangeWinner < 1) eloChangeWinner = 1;
  if (eloChangeLoser > -1) eloChangeLoser = -1;
  
  // -------------------------------------------------------------------------
  // 6. LOGS DÉTAILLÉS (pour debug)
  // -------------------------------------------------------------------------
  console.log('');
  console.log('🎯 Calcul ELO détaillé:');
  console.log(`   🏆 ${winner.name} (${winner.elo}) vs ${loser.name} (${loser.elo})`);
  console.log(`   📊 Score: ${winnerScore}-${loserScore}`);
  console.log(`   📈 K gagnant: ${Kw.toFixed(2)} (${winnerMatches} matchs)`);
  console.log(`   📉 K perdant: ${Kl.toFixed(2)} (${loserMatches} matchs)`);
  console.log(`   🎲 Expected winner: ${(expectedWinner * 100).toFixed(1)}%`);
  console.log(`   💪 Domination: ${dominationFactor.toFixed(2)}x`);
  console.log(`   🐶 Bonus underdog: W=${underdogBonusWinner.toFixed(2)} L=${underdogBonusLoser.toFixed(2)}`);
  console.log(`   ✅ Variation: ${winner.name} +${eloChangeWinner} | ${loser.name} ${eloChangeLoser}`);
  console.log('');
  
  return {
    eloChangeWinner,
    eloChangeLoser,
    details: {
      Kw: Kw.toFixed(2),
      Kl: Kl.toFixed(2),
      expectedWinner: (expectedWinner * 100).toFixed(1),
      dominationFactor: dominationFactor.toFixed(2),
      underdogBonusWinner: underdogBonusWinner.toFixed(2),
      underdogBonusLoser: underdogBonusLoser.toFixed(2)
    }
  };
}

/**
 * Restaure les Elos et statistiques lors de la suppression/modification d'un match
 * @param {Object} match - Le match à annuler
 */
function reverseMatch(match) {
  // Restaurer les Elos
  db.prepare('UPDATE players SET elo = elo - ? WHERE id = ?')
    .run(match.elo_change, match.winner_id);
  db.prepare('UPDATE players SET elo = elo + ? WHERE id = ?')
    .run(match.elo_change, match.loser_id);
  
  // Restaurer les statistiques du gagnant
  db.prepare(`
    UPDATE players 
    SET wins = wins - 1,
        points_won = points_won - ?,
        points_lost = points_lost - ?
    WHERE id = ?
  `).run(match.winner_score, match.loser_score, match.winner_id);
  
  // Restaurer les statistiques du perdant
  db.prepare(`
    UPDATE players 
    SET losses = losses - 1,
        points_won = points_won - ?,
        points_lost = points_lost - ?
    WHERE id = ?
  `).run(match.loser_score, match.winner_score, match.loser_id);
}

/**
 * Applique un match (mise à jour des Elos et statistiques)
 * @param {Object} match - Le match à appliquer avec winner et loser complets
 * @returns {Object} Résultat avec les variations ELO
 */
function applyMatch(match) {
  const eloResult = calculateEloChange(
    match.winner, 
    match.loser, 
    match.winner_score, 
    match.loser_score
  );
  
  // Mise à jour du gagnant
  db.prepare(`
    UPDATE players 
    SET elo = elo + ?, 
        wins = wins + 1, 
        points_won = points_won + ?,
        points_lost = points_lost + ?
    WHERE id = ?
  `).run(
    eloResult.eloChangeWinner, 
    match.winner_score, 
    match.loser_score, 
    match.winner.id
  );
  
  // Mise à jour du perdant
  db.prepare(`
    UPDATE players 
    SET elo = elo + ?, 
        losses = losses + 1,
        points_won = points_won + ?,
        points_lost = points_lost + ?
    WHERE id = ?
  `).run(
    eloResult.eloChangeLoser, 
    match.loser_score, 
    match.winner_score, 
    match.loser.id
  );
  
  return eloResult;
}

// ============================================================================
// MIDDLEWARE D'AUTHENTIFICATION
// ============================================================================

/**
 * Middleware pour protéger les routes admin
 * Vérifie si l'utilisateur est connecté en tant qu'administrateur
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(401).json({ error: 'Non authentifié' });
}

// ============================================================================
// ROUTES DES PAGES (Frontend)
// ============================================================================

// Page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Page classement
app.get('/classement', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'classement.html'));
});

// Page matchs (frontend public)
app.get('/matchs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'matchs.html'));
});

// Page login admin
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Page admin principale (protégée)
app.get('/admin', (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Page admin des matchs (historique, protégée)
app.get('/admin/matches', (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin-matches.html'));
});

// ============================================================================
// API AUTHENTIFICATION
// ============================================================================

/**
 * POST /api/login
 * Connexion administrateur avec mot de passe uniquement
 */
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  
  // Validation basique
  if (!password) {
    return res.status(400).json({ error: 'Le mot de passe est requis' });
  }
  
  // Récupérer l'admin depuis la base
  const admin = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
  
  if (!admin) {
    return res.status(500).json({ error: 'Aucun administrateur configuré' });
  }
  
  // Vérifier le mot de passe avec bcrypt
  const isValid = bcrypt.compareSync(password, admin.password);
  
  if (isValid) {
    req.session.isAdmin = true;
    req.session.username = admin.username;
    res.json({ success: true, message: 'Connexion réussie' });
  } else {
    res.status(401).json({ error: 'Mot de passe incorrect' });
  }
});

/**
 * POST /api/logout
 * Déconnexion de l'administrateur
 */
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la déconnexion' });
    }
    res.json({ success: true, message: 'Déconnexion réussie' });
  });
});

/**
 * GET /api/check-auth
 * Vérifier si l'utilisateur est connecté
 */
app.get('/api/check-auth', (req, res) => {
  res.json({ 
    isAdmin: !!req.session?.isAdmin,
    username: req.session?.username || null
  });
});

// ============================================================================
// API JOUEURS
// ============================================================================

/**
 * GET /api/players
 * Récupérer tous les joueurs (public)
 * Triés par ELO décroissant
 */
app.get('/api/players', (req, res) => {
  const players = db.prepare(`
    SELECT 
      id, 
      name, 
      elo, 
      wins, 
      losses, 
      points_won, 
      points_lost,
      created_at
    FROM players 
    ORDER BY elo DESC
  `).all();
  
  res.json(players);
});

/**
 * POST /api/players
 * Créer un nouveau joueur (admin uniquement)
 */
app.post('/api/players', requireAdmin, (req, res) => {
  const { name } = req.body;
  
  // Validation
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Le nom est requis' });
  }
  
  try {
    const result = db.prepare('INSERT INTO players (name) VALUES (?)').run(name.trim());
    res.json({ 
      success: true,
      id: result.lastInsertRowid, 
      name: name.trim(), 
      elo: 1000 
    });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Ce joueur existe déjà' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/players/:id
 * Supprimer un joueur (admin uniquement)
 * Impossible si le joueur a des matchs
 */
app.delete('/api/players/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  // Vérifier si le joueur a des matchs
  const matchCount = db.prepare(`
    SELECT COUNT(*) as count 
    FROM matches 
    WHERE winner_id = ? OR loser_id = ?
  `).get(id, id);
  
  if (matchCount.count > 0) {
    return res.status(400).json({ 
      error: 'Impossible de supprimer un joueur qui a des matchs' 
    });
  }
  
  db.prepare('DELETE FROM players WHERE id = ?').run(id);
  res.json({ success: true });
});

// ============================================================================
// API MATCHS
// ============================================================================

/**
 * GET /api/public/matches
 * Route PUBLIQUE pour la page /matchs
 * Retourne les 100 derniers matchs avec détails complets
 */
app.get('/api/public/matches', (req, res) => {
  const matches = db.prepare(`
    SELECT 
      m.id,
      m.played_at,
      m.winner_score,
      m.loser_score,
      m.elo_change,
      w.id as winner_id,
      w.name as winner_name,
      w.elo as winner_elo,
      l.id as loser_id,
      l.name as loser_name,
      l.elo as loser_elo
    FROM matches m
    JOIN players w ON m.winner_id = w.id
    JOIN players l ON m.loser_id = l.id
    ORDER BY m.played_at DESC
    LIMIT 100
  `).all();
  
  res.json(matches);
});

/**
 * GET /api/matches
 * Route ADMIN pour l'historique complet
 * Même structure que la publique, mais sans limite
 */
app.get('/api/matches', requireAdmin, (req, res) => {
  const matches = db.prepare(`
    SELECT 
      m.id,
      m.played_at,
      m.winner_score,
      m.loser_score,
      m.elo_change,
      w.id as winner_id,
      w.name as winner_name,
      w.elo as winner_elo,
      l.id as loser_id,
      l.name as loser_name,
      l.elo as loser_elo
    FROM matches m
    JOIN players w ON m.winner_id = w.id
    JOIN players l ON m.loser_id = l.id
    ORDER BY m.played_at DESC
  `).all();
  
  res.json(matches);
});

/**
 * POST /api/matches
 * Créer un nouveau match (admin uniquement)
 * Utilise l'algorithme ELO avancé avec :
 * - Facteur K dynamique (expérience)
 * - Facteur de domination (score)
 * - Bonus underdog (écart de classement)
 */
app.post('/api/matches', requireAdmin, (req, res) => {
  const { winner_id, loser_id, winner_score, loser_score } = req.body;
  
  // Validation des champs
  if (!winner_id || !loser_id || winner_score === undefined || loser_score === undefined) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }
  
  if (winner_id === loser_id) {
    return res.status(400).json({ error: 'Un joueur ne peut pas jouer contre lui-même' });
  }
  
  if (parseInt(winner_score) <= parseInt(loser_score)) {
    return res.status(400).json({ 
      error: 'Le score du gagnant doit être supérieur à celui du perdant' 
    });
  }
  
  // Récupérer les joueurs complets (avec stats pour le calcul de K)
  const winner = db.prepare('SELECT * FROM players WHERE id = ?').get(winner_id);
  const loser = db.prepare('SELECT * FROM players WHERE id = ?').get(loser_id);
  
  if (!winner || !loser) {
    return res.status(404).json({ error: 'Joueur non trouvé' });
  }
  
  // Préparation de la requête d'insertion
  const insertMatch = db.prepare(`
    INSERT INTO matches (
      winner_id, 
      loser_id, 
      winner_score, 
      loser_score,
      winner_elo_before,
      loser_elo_before,
      elo_change
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  // Transaction pour garantir l'intégrité
  const createMatch = db.transaction(() => {
    // Calculer les variations ELO
    const eloResult = calculateEloChange(winner, loser, winner_score, loser_score);
    
    // Insérer le match
    const result = insertMatch.run(
      winner_id, 
      loser_id, 
      winner_score, 
      loser_score,
      winner.elo,
      loser.elo,
      eloResult.eloChangeWinner
    );
    
    // Appliquer les modifications aux joueurs
    applyMatch({
      winner: winner,
      loser: loser,
      winner_score: winner_score,
      loser_score: loser_score
    });
    
    return { result, eloResult };
  });
  
  try {
    const { result, eloResult } = createMatch();
    res.json({ 
      success: true, 
      id: result.lastInsertRowid,
      elo_change: eloResult.eloChangeWinner,
      details: eloResult.details
    });
  } catch (err) {
    console.error('❌ Erreur lors de la création du match:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/matches/:id
 * Modifier un match existant (admin uniquement)
 * 
 * Stratégie :
 * 1. Récupérer l'ancien match
 * 2. Annuler ses effets (restaurer Elos et stats)
 * 3. Appliquer le nouveau match avec les nouvelles valeurs
 * 
 * Cela garantit que l'historique reste cohérent
 */
app.put('/api/matches/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { winner_id, loser_id, winner_score, loser_score } = req.body;
  
  // Validation
  if (winner_id === loser_id) {
    return res.status(400).json({ error: 'Un joueur ne peut pas jouer contre lui-même' });
  }
  
  if (parseInt(winner_score) <= parseInt(loser_score)) {
    return res.status(400).json({ error: 'Le score du gagnant doit être supérieur' });
  }
  
  try {
    // Récupérer l'ancien match
    const oldMatch = db.prepare(`
      SELECT * FROM matches WHERE id = ?
    `).get(id);
    
    if (!oldMatch) {
      return res.status(404).json({ error: 'Match non trouvé' });
    }
    
    // Récupérer les joueurs pour le calcul
    const newWinner = db.prepare('SELECT * FROM players WHERE id = ?').get(winner_id);
    const newLoser = db.prepare('SELECT * FROM players WHERE id = ?').get(loser_id);
    
    if (!newWinner || !newLoser) {
      return res.status(404).json({ error: 'Joueur non trouvé' });
    }
    
    // Transaction : annuler l'ancien match, puis appliquer le nouveau
    const updateMatch = db.transaction(() => {
      // 1. Annuler l'ancien match
      console.log(`\n🔄 Annulation du match #${id}...`);
      reverseMatch(oldMatch);
      
      // 2. Récupérer les Elos ACTUELS (après annulation)
      const currentWinner = db.prepare('SELECT * FROM players WHERE id = ?').get(winner_id);
      const currentLoser = db.prepare('SELECT * FROM players WHERE id = ?').get(loser_id);
      
      // 3. Calculer les nouvelles variations
      const eloResult = calculateEloChange(
        currentWinner, 
        currentLoser, 
        winner_score, 
        loser_score
      );
      
      // 4. Mettre à jour le match dans la table
      db.prepare(`
        UPDATE matches 
        SET winner_id = ?, 
            loser_id = ?, 
            winner_score = ?, 
            loser_score = ?,
            winner_elo_before = ?,
            loser_elo_before = ?,
            elo_change = ?
        WHERE id = ?
      `).run(
        winner_id, 
        loser_id, 
        winner_score, 
        loser_score,
        currentWinner.elo,
        currentLoser.elo,
        eloResult.eloChangeWinner,
        id
      );
      
      // 5. Appliquer les nouvelles variations aux joueurs
      applyMatch({
        winner: currentWinner,
        loser: currentLoser,
        winner_score: winner_score,
        loser_score: loser_score
      });
      
      return eloResult;
    });
    
    const eloResult = updateMatch();
    
    res.json({ 
      success: true,
      elo_change: eloResult.eloChangeWinner,
      details: eloResult.details
    });
  } catch (err) {
    console.error('❌ Erreur lors de la modification du match:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/matches/:id
 * Supprimer un match (admin uniquement)
 * Restaure automatiquement les Elos et statistiques des joueurs
 */
app.delete('/api/matches/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  try {
    // Récupérer le match complet
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
    
    if (!match) {
      return res.status(404).json({ error: 'Match non trouvé' });
    }
    
    // Récupérer les stats AVANT suppression
    const winnerBefore = db.prepare('SELECT * FROM players WHERE id = ?').get(match.winner_id);
    const loserBefore = db.prepare('SELECT * FROM players WHERE id = ?').get(match.loser_id);
    
    console.log('\n' + '='.repeat(60));
    console.log(`🗑️ SUPPRESSION DU MATCH #${id}`);
    console.log('='.repeat(60));
    console.log(`📊 Match: ${winnerBefore.name} ${match.winner_score}-${match.loser_score} ${loserBefore.name}`);
    console.log(`📊 Elo change: ${match.elo_change}`);
    console.log('');
    console.log('📈 AVANT suppression:');
    console.log(`   ${winnerBefore.name}:`);
    console.log(`     Elo: ${winnerBefore.elo}`);
    console.log(`     V/D: ${winnerBefore.wins}/${winnerBefore.losses}`);
    console.log(`     Points: ${winnerBefore.points_won} marqués / ${winnerBefore.points_lost} encaissés`);
    console.log(`   ${loserBefore.name}:`);
    console.log(`     Elo: ${loserBefore.elo}`);
    console.log(`     V/D: ${loserBefore.wins}/${loserBefore.losses}`);
    console.log(`     Points: ${loserBefore.points_won} marqués / ${loserBefore.points_lost} encaissés`);
    
    // Transaction pour tout annuler proprement
    const deleteMatch = db.transaction(() => {
      // 1. Restaurer les Elos
      db.prepare('UPDATE players SET elo = elo - ? WHERE id = ?')
        .run(match.elo_change, match.winner_id);
      db.prepare('UPDATE players SET elo = elo + ? WHERE id = ?')
        .run(match.elo_change, match.loser_id);
      
      // 2. Restaurer les stats du GAGNANT
      db.prepare(`
        UPDATE players 
        SET wins = wins - 1,
            points_won = points_won - ?,
            points_lost = points_lost - ?
        WHERE id = ?
      `).run(match.winner_score, match.loser_score, match.winner_id);
      
      // 3. Restaurer les stats du PERDANT
      db.prepare(`
        UPDATE players 
        SET losses = losses - 1,
            points_won = points_won - ?,
            points_lost = points_lost - ?
        WHERE id = ?
      `).run(match.loser_score, match.winner_score, match.loser_id);
      
      // 4. Supprimer le match
      db.prepare('DELETE FROM matches WHERE id = ?').run(id);
    });
    
    deleteMatch();
    
    // Récupérer les stats APRÈS suppression
    const winnerAfter = db.prepare('SELECT * FROM players WHERE id = ?').get(match.winner_id);
    const loserAfter = db.prepare('SELECT * FROM players WHERE id = ?').get(match.loser_id);
    
    console.log('');
    console.log('📉 APRÈS suppression:');
    console.log(`   ${winnerAfter.name}:`);
    console.log(`     Elo: ${winnerAfter.elo}`);
    console.log(`     V/D: ${winnerAfter.wins}/${winnerAfter.losses}`);
    console.log(`     Points: ${winnerAfter.points_won} marqués / ${winnerAfter.points_lost} encaissés`);
    console.log(`   ${loserAfter.name}:`);
    console.log(`     Elo: ${loserAfter.elo}`);
    console.log(`     V/D: ${loserAfter.wins}/${loserAfter.losses}`);
    console.log(`     Points: ${loserAfter.points_won} marqués / ${loserAfter.points_lost} encaissés`);
    console.log('='.repeat(60) + '\n');
    
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erreur lors de la suppression du match:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DÉMARRAGE DU SERVEUR
// ============================================================================
app.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(60));
  console.log('🚀 Magnolia Ping Pong - Serveur démarré');
  console.log('='.repeat(60));
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log('');
  console.log('📊 Pages disponibles:');
  console.log(`   - Accueil:     http://localhost:${PORT}/`);
  console.log(`   - Classement:  http://localhost:${PORT}/classement`);
  console.log(`   - Matchs:      http://localhost:${PORT}/matchs`);
  console.log(`   - Admin:       http://localhost:${PORT}/admin`);
  console.log(`   - Login:       http://localhost:${PORT}/login`);
  console.log('');
  console.log('🔐 Authentification:');
  console.log(`   - Admin:       ${process.env.ADMIN_USERNAME || 'admin'}`);
  console.log('');
  console.log('🎯 Algorithme ELO:');
  console.log('   - Facteur K dynamique (expérience)');
  console.log('   - Facteur de domination (score)');
  console.log('   - Bonus underdog (écart de classement)');
  console.log('');
  console.log('='.repeat(60));
  console.log('');
});