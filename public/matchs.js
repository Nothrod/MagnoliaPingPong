// ========================================
// VARIABLES GLOBALES
// ========================================
let matchesData = [];
let filteredData = [];

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
// MENU BURGER
// ========================================
function initBurgerMenu() {
  const burgerMenu = document.getElementById('burgerMenu');
  const navMenu = document.querySelector('.nav-menu');
  
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
// MODAL
// ========================================
function initModal() {
  const modal = document.getElementById('matchModal');
  const closeBtn = document.getElementById('closeModal');

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

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
// CHARGEMENT DES DONNÉES
// ========================================
function loadMatches() {
  const matchesList = document.getElementById('matchesList');
  
  // Afficher le loader
  matchesList.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Chargement des matchs...</p>
    </div>
  `;

  fetch('/api/matches.php')
    .then(res => {
      if (!res.ok) throw new Error('Erreur serveur');
      return res.json();
    })
    .then(data => {
      matchesData = data;
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
          <p>Vérifie que l'API /api/matches.php est accessible.</p>
        </div>
      `;
    });
}

// ========================================
// MISE À JOUR DES STATS
// ========================================
function updateStats(data) {
  const today = new Date().toISOString().slice(0, 10);
  
  // Total matchs
  document.getElementById('totalMatches').textContent = data.length;
  
  // Matchs aujourd'hui
  const todayCount = data.filter(m => m.date.startsWith(today)).length;
  document.getElementById('todayMatches').textContent = todayCount;
  
  // Top joueur (plus de victoires)
  const wins = {};
  data.forEach(m => {
    wins[m.winner] = (wins[m.winner] || 0) + 1;
  });
  const top = Object.entries(wins).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('topPlayer').textContent = top ? top[0] : '-';
  
  // Elo moyen
  if (data.length > 0) {
    const avgElo = Math.round(
      data.reduce((sum, m) => sum + m.elo1 + m.elo2, 0) / (data.length * 2)
    );
    document.getElementById('avgElo').textContent = avgElo;
  }
}

// ========================================
// FILTRES
// ========================================
function initFilters() {
  document.getElementById('searchPlayer').addEventListener('input', applyFilters);
  document.getElementById('filterDate').addEventListener('change', applyFilters);
  document.getElementById('sortBy').addEventListener('change', applyFilters);
}

function applyFilters() {
  const search = document.getElementById('searchPlayer').value.toLowerCase();
  const dateFilter = document.getElementById('filterDate').value;
  const sortBy = document.getElementById('sortBy').value;

  filteredData = matchesData.filter(m => {
    // Filtre par joueur
    const matchSearch = !search || 
      m.player1.toLowerCase().includes(search) || 
      m.player2.toLowerCase().includes(search);

    // Filtre par date
    let matchDate = true;
    const matchDateObj = new Date(m.date);
    const today = new Date();
    
    if (dateFilter === 'today') {
      matchDate = matchDateObj.toDateString() === today.toDateString();
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      matchDate = matchDateObj >= weekAgo;
    } else if (dateFilter === 'month') {
      matchDate = matchDateObj.getMonth() === today.getMonth() && 
                  matchDateObj.getFullYear() === today.getFullYear();
    }

    return matchSearch && matchDate;
  });

  // Tri
  if (sortBy === 'date-desc') {
    filteredData.sort((a, b) => new Date(b.date) - new Date(a.date));
  } else if (sortBy === 'date-asc') {
    filteredData.sort((a, b) => new Date(a.date) - new Date(b.date));
  } else if (sortBy === 'elo') {
    filteredData.sort((a, b) => Math.abs(b.eloChange1) - Math.abs(a.eloChange1));
  }

  renderMatches(filteredData);
}

// ========================================
// AFFICHAGE DES MATCHS
// ========================================
function renderMatches(matches) {
  const list = document.getElementById('matchesList');
  const empty = document.getElementById('emptyState');

  if (matches.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  
  list.innerHTML = matches.map(match => `
    <div class="match-card" data-id="${match.id}">
      <div class="match-date">
        <span class="date-icon">📅</span>
        ${formatDate(match.date)}
      </div>
      
      <div class="match-players">
        <div class="player ${match.winner === match.player1 ? 'winner' : 'loser'}">
          <div class="player-avatar">${match.player1[0]}</div>
          <div class="player-info">
            <div class="player-name">${match.player1}</div>
            <div class="player-elo">
              ${match.elo1} 
              <span class="elo-change ${match.eloChange1 > 0 ? 'positive' : 'negative'}">
                ${match.eloChange1 > 0 ? '▲' : '▼'} ${Math.abs(match.eloChange1)}
              </span>
            </div>
          </div>
          ${match.winner === match.player1 ? '<span class="badge badge-winner">🏆 Vainqueur</span>' : ''}
        </div>

        <div class="vs-section">
          <div class="vs">VS</div>
          <div class="score">${match.score1} - ${match.score2}</div>
        </div>

        <div class="player ${match.winner === match.player2 ? 'winner' : 'loser'}">
          <div class="player-avatar">${match.player2[0]}</div>
          <div class="player-info">
            <div class="player-name">${match.player2}</div>
            <div class="player-elo">
              ${match.elo2} 
              <span class="elo-change ${match.eloChange2 > 0 ? 'positive' : 'negative'}">
                ${match.eloChange2 > 0 ? '▲' : '▼'} ${Math.abs(match.eloChange2)}
              </span>
            </div>
          </div>
          ${match.winner === match.player2 ? '<span class="badge badge-winner">🏆 Vainqueur</span>' : ''}
        </div>
      </div>

      <button class="btn-details" onclick="openMatchDetails(${match.id})">
        Voir détails →
      </button>
    </div>
  `).join('');
}

// ========================================
// UTILITAIRES
// ========================================
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const timeStr = date.toLocaleTimeString('fr-FR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  if (date.toDateString() === today.toDateString()) {
    return `Aujourd'hui, ${timeStr}`;
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return `Hier, ${timeStr}`;
  }
  return date.toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}