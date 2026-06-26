// ========================================
// SERVER.JS - API Express + SQLite
// ========================================

const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const session = require('express-session');

const app = express();
const PORT = 3000;

// ========================================
// MIDDLEWARE
// ========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques du dossier public
app.use(express.static(path.join(__dirname, 'public')));

// Sessions pour l'authentification admin
app.use(session({
  secret: 'elotracker-secret-key-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24h
}));

// ========================================
// BASE DE DONNÉES
// ========================================
const db = new Database(path.join(__dirname, 'database.db'));

// Activer WAL mode pour meilleures performances
db.pragma('journal_mode = WAL');

// Créer les tables si elles n'existent pas
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    elo INTEGER DEFAULT 1200,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    winner_id INTEGER NOT NULL,
    loser_id INTEGER NOT NULL,
    winner_score INTEGER NOT NULL,
    loser_score INTEGER NOT NULL,
    elo_change INTEGER NOT NULL,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (winner_id) REFERENCES players(id),
    FOREIGN KEY (loser_id) REFERENCES players(id)
  );

  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
`);

// Créer un admin par défaut si aucun n'existe
const adminCount = db.prepare('SELECT COUNT(*) as count FROM admin').get();
if (adminCount.count === 0) {
  db.prepare('INSERT INTO admin (username, password) VALUES (?, ?)').run('admin', 'admin');
  console.log('👤 Admin par défaut créé : admin / admin');
}

// ========================================
// MIDDLEWARE D'AUTHENTIFICATION
// ========================================
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(401).json({ error: 'Non authentifié' });
}

// ========================================
// ROUTES DES PAGES
// ========================================

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

// Page admin principale
app.get('/admin', (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Page admin des matchs (historique)
app.get('/admin/matches', (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin-matches.html'));
});

// ========================================
// API AUTHENTIFICATION
// ========================================

// Connexion admin
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  const admin = db.prepare('SELECT * FROM admin WHERE username = ? AND password = ?').get(username, password);
  
  if (admin) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Identifiants incorrects' });
  }
});

// Déconnexion
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Vérifier si connecté
app.get('/api/check-auth', (req, res) => {
  res.json({ isAdmin: !!req.session?.isAdmin });
});

// ========================================
// API JOUEURS
// ========================================

// Récupérer tous les joueurs (public)
app.get('/api/players', (req, res) => {
  const players = db.prepare('SELECT * FROM players ORDER BY elo DESC').all();
  res.json(players);
});

// Créer un joueur (admin)
app.post('/api/players', requireAdmin, (req, res) => {
  const { name } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Le nom est requis' });
  }
  
  try {
    const result = db.prepare('INSERT INTO players (name) VALUES (?)').run(name.trim());
    res.json({ id: result.lastInsertRowid, name: name.trim(), elo: 1200 });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Ce joueur existe déjà' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un joueur (admin)
app.delete('/api/players/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  // Vérifier si le joueur a des matchs
  const matchCount = db.prepare('SELECT COUNT(*) as count FROM matches WHERE winner_id = ? OR loser_id = ?').get(id, id);
  
  if (matchCount.count > 0) {
    return res.status(400).json({ error: 'Impossible de supprimer un joueur qui a des matchs' });
  }
  
  db.prepare('DELETE FROM players WHERE id = ?').run(id);
  res.json({ success: true });
});

// ========================================
// API MATCHS
// ========================================

/**
 * 🌐 Route PUBLIQUE pour la page /matchs (frontend)
 * Retourne les matchs avec tous les détails nécessaires
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
 * 🔐 Route ADMIN pour l'historique
 * Même structure que la publique, mais protégée
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
 * Créer un nouveau match (admin)
 * Calcule automatiquement la variation Elo
 */
app.post('/api/matches', requireAdmin, (req, res) => {
  const { winner_id, loser_id, winner_score, loser_score } = req.body;
  
  // Validation
  if (!winner_id || !loser_id || winner_score === undefined || loser_score === undefined) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }
  
  if (winner_id === loser_id) {
    return res.status(400).json({ error: 'Un joueur ne peut pas jouer contre lui-même' });
  }
  
  if (parseInt(winner_score) <= parseInt(loser_score)) {
    return res.status(400).json({ error: 'Le score du gagnant doit être supérieur à celui du perdant' });
  }
  
  // Récupérer les Elos actuels
  const winner = db.prepare('SELECT * FROM players WHERE id = ?').get(winner_id);
  const loser = db.prepare('SELECT * FROM players WHERE id = ?').get(loser_id);
  
  if (!winner || !loser) {
    return res.status(404).json({ error: 'Joueur non trouvé' });
  }
  
  // Calcul de la variation Elo (formule simplifiée)
  const K = 32; // Facteur K
  const expectedWinner = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400));
  const expectedLoser = 1 - expectedWinner;
  
  const eloChangeWinner = Math.round(K * (1 - expectedWinner));
  const eloChangeLoser = Math.round(K * (0 - expectedLoser));
  
  // Insérer le match
  const insertMatch = db.prepare(`
    INSERT INTO matches (winner_id, loser_id, winner_score, loser_score, elo_change)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const updateWinner = db.prepare('UPDATE players SET elo = elo + ? WHERE id = ?');
  const updateLoser = db.prepare('UPDATE players SET elo = elo + ? WHERE id = ?');
  
  // Transaction pour s'assurer que tout est fait en une fois
  const createMatch = db.transaction(() => {
    const result = insertMatch.run(winner_id, loser_id, winner_score, loser_score, eloChangeWinner);
    updateWinner.run(eloChangeWinner, winner_id);
    updateLoser.run(eloChangeLoser, loser_id);
    return result;
  });
  
  try {
    const result = createMatch();
    res.json({ 
      success: true, 
      id: result.lastInsertRowid,
      elo_change: eloChangeWinner 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Modifier un match (admin)
 */
app.put('/api/matches/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { winner_id, loser_id, winner_score, loser_score } = req.body;
  
  if (winner_id === loser_id) {
    return res.status(400).json({ error: 'Un joueur ne peut pas jouer contre lui-même' });
  }
  
  if (parseInt(winner_score) <= parseInt(loser_score)) {
    return res.status(400).json({ error: 'Le score du gagnant doit être supérieur' });
  }
  
  try {
    db.prepare(`
      UPDATE matches 
      SET winner_id = ?, loser_id = ?, winner_score = ?, loser_score = ?
      WHERE id = ?
    `).run(winner_id, loser_id, winner_score, loser_score, id);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Supprimer un match (admin)
 */
app.delete('/api/matches/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  try {
    // Récupérer le match pour restaurer les Elos
    const match = db.prepare(`
      SELECT * FROM matches WHERE id = ?
    `).get(id);
    
    if (!match) {
      return res.status(404).json({ error: 'Match non trouvé' });
    }
    
    const updateMatch = db.transaction(() => {
      // Restaurer les Elos
      db.prepare('UPDATE players SET elo = elo - ? WHERE id = ?').run(match.elo_change, match.winner_id);
      db.prepare('UPDATE players SET elo = elo + ? WHERE id = ?').run(match.elo_change, match.loser_id);
      
      // Supprimer le match
      db.prepare('DELETE FROM matches WHERE id = ?').run(id);
    });
    
    updateMatch();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================
// DÉMARRAGE DU SERVEUR
// ========================================
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📊 Pages disponibles :`);
  console.log(`   - http://localhost:${PORT}/`);
  console.log(`   - http://localhost:${PORT}/classement`);
  console.log(`   - http://localhost:${PORT}/matchs`);
  console.log(`   - http://localhost:${PORT}/admin`);
});