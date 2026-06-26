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

  // ✅ CORRECTION: Utiliser la bonne route API (Node.js, pas PHP)
  fetch('/api/public/matches')
    .then(res => {
      if (!res.ok) throw new Error('Erreur serveur');
      return res.json();
    })
    .then(data => {
      // ✅ CORRECTION: Mapper les données de l'API vers le format attendu
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
/**
 * Transforme les données de l'API Node.js vers le format attendu par le code
 * API: { id, played_at, winner_score, loser_score, winner_name, loser_name, winner_elo, loser_elo, elo_change }
 * Local: { id, date, score1, score2, player1, player2, winner, elo1, elo2, eloChange1, eloChange2 }
 */
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
  const todayCount = data.filter(m => m.date.startsWith(today)).length;
  document.getElementById('todayMatches').textContent = todayCount;
  
  // Joueur avec le plus de victoires
  const wins = {};
  data.forEach(m => {
    wins[m.winner] = (wins[m.winner] || 0) + 1;
  });
  const top = Object.entries(wins).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('topPlayer').textContent = top ? top[0] : '-';
  
  // Elo moyen de tous les joueurs
  if (data.length > 0) {
    const avgElo = Math.round(
      data.reduce((sum