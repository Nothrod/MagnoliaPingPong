// Vérifier l'authentification au chargement
async function checkAuth() {
    const response = await fetch('/api/check-auth');
    const data = await response.json();
    
    if (!data.isAdmin) {
        window.location.href = '/login';
    }
}

checkAuth();

let allPlayers = [];

async function recordMatch() {
    const winnerId = parseInt(document.getElementById('winner').value);
    const loserId = parseInt(document.getElementById('loser').value);
    const winnerScore = parseInt(document.getElementById('winnerScore').value);
    const loserScore = parseInt(document.getElementById('loserScore').value);
    
    if (winnerId === loserId) {
        showMessage('matchMessage', '❌ Un joueur ne peut pas jouer contre lui-même !', 'error');
        return;
    }
    
    if (isNaN(winnerScore) || isNaN(loserScore) || winnerScore < 0 || loserScore < 0) {
        showMessage('matchMessage', '❌ Scores invalides', 'error');
        return;
    }
    
    const response = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerId, loserId, winnerScore, loserScore })
    });
    
    const data = await response.json();
    
    if (response.ok) {
        showMessage('matchMessage', 
            `✅ Match enregistré ! ${data.score} | ${data.winner.name} +${data.eloChange} Elo | Domination: ${data.dominanceFactor}`, 
            'success');
        loadPlayers();
    } else {
        showMessage('matchMessage', `❌ ${data.error}`, 'error');
    }
}

async function loadPlayers() {
    const response = await fetch('/api/players');
    allPlayers = await response.json();
    displayPlayers(allPlayers);
    
    // Remplir les selects de joueurs pour le formulaire de match
    const options = allPlayers.map(p => `<option value="${p.id}">${p.name} (${p.elo})</option>`).join('');
    document.getElementById('winner').innerHTML = options;
    document.getElementById('loser').innerHTML = options;
}
function displayPlayers(players) {
    const tbody = document.querySelector('#playersTable tbody');
    tbody.innerHTML = players.map(p => {
        const totalGames = p.wins + p.losses;
        const ratio = totalGames > 0 ? ((p.wins / totalGames) * 100).toFixed(1) : '0.0';
        const ratioClass = ratio >= 50 ? 'ratio-good' : 'ratio-bad';
        
        return `
            <tr>
                <td>${p.id}</td>
                <td><strong>${p.name}</strong></td>
                <td>${p.elo}</td>
                <td>${p.wins}</td>
                <td>${p.losses}</td>
                <td class="${ratioClass}">${ratio}%</td>
                <td>
                    <button class="btn-danger" onclick="deletePlayer(${p.id}, '${p.name}')">
                        Supprimer
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterPlayers() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allPlayers.filter(p => 
        p.name.toLowerCase().includes(search)
    );
    displayPlayers(filtered);
}

async function addPlayer() {
    const name = document.getElementById('playerName').value.trim();
    if (!name) {
        showMessage('Entre un nom !', 'error');
        return;
    }
    
    const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    
    if (response.ok) {
        document.getElementById('playerName').value = '';
        showMessage(`✅ ${name} ajouté avec succès !`, 'success');
        loadPlayers();
    } else {
        const err = await response.json();
        showMessage(`❌ ${err.error}`, 'error');
    }
}

async function deletePlayer(id, name) {
    if (!confirm(`Supprimer ${name} ? Cette action est irréversible.`)) {
        return;
    }
    
    const response = await fetch(`/api/players/${id}`, {
        method: 'DELETE'
    });
    
    if (response.ok) {
        showMessage(`✅ ${name} supprimé`, 'success');
        loadPlayers();
    } else {
        const err = await response.json();
        showMessage(`❌ ${err.error}`, 'error');
    }
}

function showMessage(text, type) {
    const msg = document.getElementById('message');
    msg.textContent = text;
    msg.className = type;
    setTimeout(() => {
        msg.style.display = 'none';
    }, 3000);
}

// Entrée pour ajouter
document.getElementById('playerName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addPlayer();
});

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
}

// Charger au démarrage
loadPlayers();