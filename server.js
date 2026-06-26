const express = require('express');
const session = require('express-session');
const path = require('path');

const playersRouter = require('./routes/players');
const leaderboardRouter = require('./routes/leaderboard');
const matchesRouter = require('./routes/matches');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'pingpong-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // false car on est en local HTTP
}));

// Middleware pour vérifier si admin
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.status(403).json({ error: 'Accès refusé - Admin requis' });
  }
}

// Routes API publiques (lecture seule)
app.use('/api/leaderboard', leaderboardRouter);

// Routes API protégées (nécessitent admin)
app.use('/api/players', requireAdmin, playersRouter);
app.use('/api/matches', requireAdmin, matchesRouter);

// Login admin
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  
  // Mot de passe simple (à changer !)
  const ADMIN_PASSWORD = 'admin123';
  
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ success: true, message: 'Connexion réussie' });
  } else {
    res.status(401).json({ error: 'Mot de passe incorrect' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Vérifier si connecté
app.get('/api/check-auth', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// Pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin/matches', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-matches.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🏓 Serveur PingPong démarré sur http://localhost:${PORT}`);
  console.log(`🔐 Login: http://localhost:${PORT}/login`);
  console.log(`🔧 Admin: http://localhost:${PORT}/admin`);
});