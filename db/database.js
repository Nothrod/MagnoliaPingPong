/**
 * ============================================================================
 * Magnolia Ping Pong - Configuration de la Base de Données
 * ============================================================================
 * 
 * Ce fichier gère :
 * - L'initialisation de la base de données SQLite
 * - La création des tables (users, players, matches)
 * - La création automatique de l'administrateur au premier démarrage
 * 
 * @author Magnolia Ping Pong
 * @version 1.0.0
 * ============================================================================
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
require('dotenv').config();

// ============================================================================
// Initialisation de la connexion à la base de données
// ============================================================================
const dbPath = process.env.DB_PATH || './database.db';
const db = new Database(dbPath);

// Activer les clés étrangères pour les contraintes
db.pragma('foreign_keys = ON');

// ============================================================================
// Création des tables
// ============================================================================
db.exec(`
  -- Table des utilisateurs (authentification)
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Table des joueurs (classement)
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

  -- Table des matchs (historique)
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

// ============================================================================
// Création automatique de l'administrateur
// ============================================================================
const initAdmin = () => {
  // Vérifier si l'admin existe déjà
  const existingAdmin = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
  
  if (!existingAdmin) {
    console.log('🔐 Création du compte administrateur...');
    
    // Récupérer les identifiants depuis le .env
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
      console.error('❌ Erreur: ADMIN_PASSWORD non défini dans le fichier .env');
      process.exit(1);
    }
    
    // Hasher le mot de passe avec bcrypt
    const saltRounds = 10;
    const hashedPassword = bcrypt.hashSync(adminPassword, saltRounds);
    
    // Insérer l'admin dans la base
    const insertAdmin = db.prepare(`
      INSERT INTO users (username, password, role) 
      VALUES (?, ?, ?)
    `);
    
    insertAdmin.run(adminUsername, hashedPassword, 'admin');
    console.log(`✅ Administrateur créé avec succès: ${adminUsername}`);
  } else {
    console.log('✅ Administrateur déjà existant');
  }
};

// Exécuter l'initialisation de l'admin
initAdmin();

// ============================================================================
// Export de la base de données
// ============================================================================
module.exports = db;