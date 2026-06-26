// ========================================
// VARIABLES GLOBALES
// ========================================
let matchesData = [];      // Données brutes des matchs
let filteredData = [];     // Données filtrées pour l'affichage

// ========================================
// INITIALISATION
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  initBurgerMenu();
  initModal();
  initFilters();
  loadMatches();
});

// ========================================
// MENU BURGER (MOBILE)
// ========================================
function initBurgerMenu() {
  const burgerMenu = document.getElementById('burgerMenu');
  const navMenu = document.querySelector('.nav-menu');
  
  // Toggle du menu au clic
  burgerMenu?.addEventListener('click', () => {
    burgerMenu.classList.toggle('active');
    navMenu.classList.toggle('active');
  });

  // Fermer le menu quand on clique sur un lien
  document.querySelectorAll('.nav-link, .btn-admin').forEach(link => {
    link.addEventListener('click', () => {
      burgerMenu?.classList.remove('active');
      navMenu?.classList.remove('active');
    });
  });
}

// ========================================
// MODAL (POPUP DÉTAIL MATCH)
// ========================================
function initModal() {
  const modal = document.getElementById('matchModal');
  const closeBtn = document.getElementById('closeModal');

  // Fermer avec le bouton X
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Fermer en cliquant en dehors de la modal
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

function openMatchDetails(id) {
  const match = matchesData.find(m => m.id === id);
  if (!match) return;

  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
    <div class="detail-row">
      <span class="detail-label">Date :</span>
      <span class="detail-value">${formatDate(match.date)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Score final :</span>
      <span class="detail-value score-big">${match.score1} - ${match.score2}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Vainqueur :</span>
      <span class="detail-value winner-text">🏆 ${match.winner}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Variation Elo :</span>
      <span class="detail-value">
        ${match.player1} <span class="${match.eloChange1 > 0 ? 'positive' : 'negative'}">
          ${match.eloChange1 > 0 ? '+' : ''}${match.eloChange1}
        </span>
        |
        ${match.player2} <span class="${match.eloChange2 > 0 ? 'positive' : 'negative'}">
          ${match.eloChange2 > 0 ? '+' : ''}${match.eloChange2}
        </span>
      </span>
    </div>
  `;

  document.getElementById('matchModal').style.display = 'block';
}

// ========================================
// CHARGEMENT DES DONNÉES DEPUIS L'API
// ========================================
function loadMatches() {
  const matchesList = document.getElementById('matchesList');
  
  // Afficher le loader pendant le chargement
  matchesList.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Chargement des matchs...</p>
    </div>
  `;

  fetch('/api/public/matches')
    .then(res => {
      if (!res.ok) throw new Error('Erreur serveur');
      return res.json();
    })
    .then(data => {
      matchesData = data.map(mapApiDataToMatch);
      filteredData = [...matchesData];
      renderMatches(filteredData);
      updateStats(matchesData);
    })
    .catch(err => {
      console.error('Erreur:', err);
      matchesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Impossible de charger les matchs</h3>
          <p>Vérifie que l'API /api/public/matches est accessible.</p>
        </div>
      `;
    });
}

// ========================================
// MAPPING DES DONNÉES API → FORMAT LOCAL
// ========================================
function mapApiDataToMatch(apiMatch) {
  return {
    id: apiMatch.id,
    date: apiMatch.played_at,
    score1: apiMatch.winner_score,
    score2: apiMatch.loser_score,
    player1: apiMatch.winner_name,
    player2: apiMatch.loser_name,
    winner: apiMatch.winner_name,
    elo1: apiMatch.winner_elo || 1200,
    elo2: apiMatch.loser_elo || 1200,
    eloChange1: apiMatch.elo_change || 0,
    eloChange2: -(apiMatch.elo_change || 0)
  };
}

// ========================================
// MISE À JOUR DES STATISTIQUES
// ========================================
function updateStats(data) {
  const today = new Date().toISOString().slice(0, 10);
  
  // Total des matchs
  document.getElementById('totalMatches').textContent = data.length;
  
  // Nombre de matchs aujourd'hui
  const todayCount = data.filter(m => m.date && m.date.startsWith(today)).length;
  document.getElementById('todayMatches').textContent = todayCount;
  
  // Joueur avec le plus de victoires
  const wins = {};
  data.forEach(m => {
    wins[m.winner] = (wins[m.winner] || 0) + 1;
  });
  const top = Object.entries(wins).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('topPlayer').textContent = top ? top[0] : '-';
  
  // 🔥 PLUS GRANDE SÉRIE DE VICTOIRES
  const streak = calculateBestStreak(data);
  if (streak.player && streak.count > 0) {
    // Afficher le nom du joueur et le nombre de victoires
    document.getElementById('streakPlayer').textContent = streak.player;
    document.getElementById('streakCount').textContent = `${streak.count} 🏆`;
    document.getElementById('streakCard').title = `${streak.player} - ${streak.count} victoire(s) d'affilée`;
  } else {
    document.getElementById('streakPlayer').textContent = '-';
    document.getElementById('streakCount').textContent = '0';
  }
}

// ========================================
// CALCUL DE LA MEILLEURE SÉRIE DE VICTOIRES
// ========================================
/**
 * Calcule la plus grande série de victoires consécutives pour chaque joueur
 * @param {Array} data - Liste des matchs (triés par date décroissante)
 * @returns {Object} {player: string, count: number}
 */
function calculateBestStreak(data) {
  if (data.length === 0) {
    return { player: null, count: 0 };
  }
  
  // Trier les matchs par date croissante (du plus ancien au plus récent)
  const sortedMatches = [...data].sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );
  
  // Pour chaque joueur, suivre sa série actuelle et son meilleur streak
  const currentStreak = {};  // Série actuelle de chaque joueur
  const bestStreak = {};     // Meilleure série de chaque joueur
  
  sortedMatches.forEach(match => {
    const winner = match.winner;
    const loser = match.player1 === winner ? match.player2 : match.player1;
    
    // Initialiser si nécessaire
    if (currentStreak[winner] === undefined) currentStreak[winner] = 0;
    if (currentStreak[loser] === undefined) currentStreak[loser] = 0;
    if (bestStreak[winner] === undefined) bestStreak[winner] = 0;
    if (bestStreak[loser] === undefined) bestStreak[loser] = 0;
    
    // Le gagnant voit sa série augmenter
    currentStreak[winner] += 1;
    bestStreak[winner] = Math.max(bestStreak[winner], currentStreak[winner]);
    
    // Le perdant voit sa série réinitialisée
    currentStreak[loser] = 0;
  });
  
  // Trouver le joueur avec la meilleure série
  let bestPlayer = null;
  let bestCount = 0;
  
  Object.entries(bestStreak).forEach(([player, count]) => {
    if (count > bestCount) {
      bestCount = count;
      bestPlayer = player;
    }
  });
  
  return { player: bestPlayer, count: bestCount };
}

// ========================================
// AFFICHAGE DES MATCHS
// ========================================
function renderMatches(data) {
  const matchesList = document.getElementById('matchesList');
  const emptyState = document.getElementById('emptyState');
  
  if (data.length === 0) {
    matchesList.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }
  
  matchesList.style.display = 'block';
  emptyState.style.display = 'none';
  
  matchesList.innerHTML = data.map(match => `
    <div class="match-card" onclick="openMatchDetails(${match.id})">
      <div class="match-header">
        <span class="match-date">${formatDate(match.date)}</span>
        <span class="match-id">#${match.id}</span>
      </div>
      <div class="match-body">
        <div class="player player1 ${match.winner === match.player1 ? 'winner' : ''}">
          <span class="player-name">${match.player1}</span>
          <span class="player-score">${match.score1}</span>
          <span class="player-elo ${match.eloChange1 > 0 ? 'positive' : 'negative'}">
            ${match.eloChange1 > 0 ? '+' : ''}${match.eloChange1}
          </span>
        </div>
        <div class="vs">VS</div>
        <div class="player player2 ${match.winner === match.player2 ? 'winner' : ''}">
          <span class="player-name">${match.player2}</span>
          <span class="player-score">${match.score2}</span>
          <span class="player-elo ${match.eloChange2 > 0 ? 'positive' : 'negative'}">
            ${match.eloChange2 > 0 ? '+' : ''}${match.eloChange2}
          </span>
        </div>
      </div>
    </div>
  `).join('');
}

// ========================================
// FORMATAGE DES DATES
// ========================================
function formatDate(dateString) {
  if (!dateString) return 'Date inconnue';
  
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return "Aujourd'hui à " + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return "Hier à " + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } else if (days < 7) {
    return `Il y a ${days} jours`;
  } else {
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  }
}

// ========================================
// INITIALISATION DES FILTRES
// ========================================
function initFilters() {
  const searchInput = document.getElementById('searchPlayer');
  const filterDate = document.getElementById('filterDate');
  const sortBy = document.getElementById('sortBy');
  
  // Filtre par joueur
  searchInput?.addEventListener('input', applyFilters);
  
  // Filtre par période
  filterDate?.addEventListener('change', applyFilters);
  
  // Tri
  sortBy?.addEventListener('change', applyFilters);
}

function applyFilters() {
  const searchText = document.getElementById('searchPlayer').value.toLowerCase();
  const filterDate = document.getElementById('filterDate').value;
  const sortBy = document.getElementById('sortBy').value;
  
  let filtered = [...matchesData];
  
  // Filtre par joueur
  if (searchText) {
    filtered = filtered.filter(m => 
      m.player1.toLowerCase().includes(searchText) || 
      m.player2.toLowerCase().includes(searchText)
    );
  }
  
  // Filtre par période
  const now = new Date();
  if (filterDate === 'today') {
    const today = now.toISOString().slice(0, 10);
    filtered = filtered.filter(m => m.date && m.date.startsWith(today));
  } else if (filterDate === 'week') {
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(m => new Date(m.date) >= weekAgo);
  } else if (filterDate === 'month') {
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(m => new Date(m.date) >= monthAgo);
  }
  
  // Tri
  if (sortBy === 'date-desc') {
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  } else if (sortBy === 'date-asc') {
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
  } else if (sortBy === 'elo') {
    filtered.sort((a, b) => Math.abs(b.eloChange1) - Math.abs(a.eloChange1));
  }
  
  filteredData = filtered;
  renderMatches(filteredData);
}