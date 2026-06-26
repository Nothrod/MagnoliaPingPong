let allMatches = [];
let allPlayers = [];

// Vérifier l'authentification
async function checkAuth() {
    const response = await fetch('/api/check-auth');
    const data = await response.json();
    
    if (!data.isAdmin) {
        window.location.href = '/login';
    }
}

checkAuth();

// Charger les matchs
async function loadMatches() {
    const response = await fetch('/api/matches');
    allMatches = await response.json();
    displayMatches(allMatches);
}

// Charger les joueurs pour les filtres et le modal
async function loadPlayers() {
    const response = await fetch('/api/players');
    allPlayers = await response.json();
    
    // Remplir le filtre
    const filterSelect = document.getElementById('filterPlayer');
    filterSelect.innerHTML = '<option value="">Tous les joueurs</option>' +
        allPlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    
    // Remplir les selects du modal
    const options = allPlayers.map(p => `<option value="${p.id}">${p.name} (${p.elo})</option>`).join('');
    document.getElementById('editWinner').innerHTML = options;
    document.getElementById('editLoser').innerHTML = options;
}

// Afficher les matchs
function displayMatches(matches) {
    const tbody = document.querySelector('#matchesTable tbody');
    
    if (matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px;">Aucun match trouvé</td></tr>';
        return;
    }
    
    tbody.innerHTML = matches.map(m => {
        const date = new Date(m.played_at).toLocaleString('fr-FR');
        return `
            <tr>
                <td>${m.id}</td>
                <td>${date}</td>
                <td class="winner-cell">${m.winner_name}</td>
                <td class="score-cell">${m.winner_score} - ${m.loser_score}</td>
                <td class="loser-cell">${m.loser_name}</td>
                <td class="elo-positive">+${m.elo_change}</td>
                <td>
                    <button class="btn-edit" onclick="openEditModal(${m.id})">✏️ Modifier</button>
                    <button class="btn-danger" onclick="deleteMatch(${m.id}, '${m.winner_name} vs ${m.loser_name}')">🗑️ Supprimer</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Filtrer les matchs
function filterMatches() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const playerId = document.getElementById('filterPlayer').value;
    
    let filtered = allMatches;
    
    if (search) {
        filtered = filtered.filter(m => 
            m.winner_name.toLowerCase().includes(search) ||
            m.loser_name.toLowerCase().includes(search)
        );
    }
    
    if (playerId) {
        filtered = filtered.filter(m => 
            m.winner_id == playerId || m.loser_id == playerId
        );
    }
    
    displayMatches(filtered);
}

// Ouvrir le modal de modification
function openEditModal(matchId) {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;
    
    document.getElementById('editMatchId').value = matchId;
    document.getElementById('editWinner').value = match.winner_id;
    document.getElementById('editLoser').value = match.loser_id;
    document.getElementById('editWinnerScore').value = match.winner_score;
    document.getElementById('editLoserScore').value = match.loser_score;
    
    document.getElementById('editMessage').style.display = 'none';
    document.getElementById('editModal').style.display = 'block';
}

// Fermer le modal
function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}

// Modifier un match
async function updateMatch() {
    const matchId = document.getElementById('editMatchId').value;
    const winnerId = parseInt(document.getElementById('editWinner').value);
    const loserId = parseInt(document.getElementById('editLoser').value);
    const winnerScore = parseInt(document.getElementById('editWinnerScore').value);
    const loserScore = parseInt(document.getElementById('editLoserScore').value);
    
    if (winnerId === loserId) {
        showMessage('editMessage', '❌ Un joueur ne peut pas jouer contre lui-même !', 'error');
        return;
    }
    
    if (isNaN(winnerScore) || isNaN(loserScore) || winnerScore < 0 || loserScore < 0) {
        showMessage('editMessage', '❌ Scores invalides', 'error');
        return;
    }
    
    const response = await fetch(`/api/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerId, loserId, winnerScore, loserScore })
    });
    
    const data = await response.json();
    
    if (response.ok) {
        showMessage('editMessage', 
            `✅ Match modifié ! ${data.score} | ${data.winner.name} +${data.eloChange} Elo`, 
            'success');
        setTimeout(() => {
            closeModal();
            loadMatches();
            loadPlayers();
        }, 1500);
    } else {
        showMessage('editMessage', `❌ ${data.error}`, 'error');
    }
}

// Supprimer un match
async function deleteMatch(id, description) {
    if (!confirm(`Supprimer le match "${description}" ?\n\nLes Elo des joueurs seront recalculés.`)) {
        return;
    }
    
    const response = await fetch(`/api/matches/${id}`, {
        method: 'DELETE'
    });
    
    if (response.ok) {
        loadMatches();
        loadPlayers();
    } else {
        const err = await response.json();
        alert(`❌ ${err.error}`);
    }
}

// Afficher un message
function showMessage(elementId, text, type) {
    const msg = document.getElementById(elementId);
    msg.textContent = text;
    msg.className = type;
    msg.style.display = 'block';
    setTimeout(() => {
        msg.style.display = 'none';
    }, 3000);
}

// Déconnexion
async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
}

// Fermer le modal en cliquant en dehors
window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Charger au démarrage
loadMatches();
loadPlayers();