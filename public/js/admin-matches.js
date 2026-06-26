/**
 * ============================================================================
 * Magnolia Ping Pong - Administration des Matchs (Historique)
 * ============================================================================
 * 
 * Ce fichier gère :
 * - La vérification de l'authentification admin
 * - L'affichage de l'historique complet des matchs
 * - La modification des matchs existants
 * - La suppression des matchs (avec recalcul des Elos)
 * - Le filtrage et la recherche
 * 
 * @author Magnolia Ping Pong
 * @version 2.0.0
 * ============================================================================
 */

// ============================================================================
// VARIABLES GLOBALES
// ============================================================================

let allMatches = [];
let allPlayers = [];

// ============================================================================
// VÉRIFICATION DE L'AUTHENTIFICATION
// ============================================================================

/**
 * Vérifie si l'utilisateur est connecté en tant qu'admin
 * Redirige vers /login si non authentifié
 */
async function checkAuth() {
    const response = await fetch('/api/check-auth');
    const data = await response.json();
    
    if (!data.isAdmin) {
        window.location.href = '/login';
    }
}

checkAuth();

// ============================================================================
// CHARGEMENT DES DONNÉES
// ============================================================================

/**
 * Charge tous les matchs depuis l'API admin
 */
async function loadMatches() {
    try {
        const response = await fetch('/api/matches');
        allMatches = await response.json();
        displayMatches(allMatches);
    } catch (error) {
        console.error('Erreur lors du chargement des matchs:', error);
    }
}

/**
 * Charge tous les joueurs pour les filtres et le modal
 */
async function loadPlayers() {
    try {
        const response = await fetch('/api/players');
        allPlayers = await response.json();
        
        // Remplir le filtre
        const filterSelect = document.getElementById('filterPlayer');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">Tous les joueurs</option>' +
                allPlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        }
        
        // Remplir les selects du modal
        const options = allPlayers.map(p => `<option value="${p.id}">${p.name} (${p.elo})</option>`).join('');
        const editWinner = document.getElementById('editWinner');
        const editLoser = document.getElementById('editLoser');
        
        if (editWinner) editWinner.innerHTML = options;
        if (editLoser) editLoser.innerHTML = options;
    } catch (error) {
        console.error('Erreur lors du chargement des joueurs:', error);
    }
}

// ============================================================================
// AFFICHAGE
// ============================================================================

/**
 * Affiche les matchs dans le tableau HTML
 * @param {Array} matches - Liste des matchs à afficher
 */
function displayMatches(matches) {
    const tbody = document.querySelector('#matchesTable tbody');
    
    if (!tbody) return;
    
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

// ============================================================================
// FILTRAGE
// ============================================================================

/**
 * Filtre les matchs selon la recherche et le joueur sélectionné
 */
function filterMatches() {
    const searchInput = document.getElementById('searchInput');
    const filterPlayer = document.getElementById('filterPlayer');
    
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const playerId = filterPlayer ? filterPlayer.value : '';
    
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

// ============================================================================
// MODAL DE MODIFICATION
// ============================================================================

/**
 * Ouvre le modal de modification avec les données du match
 * @param {number} matchId - ID du match à modifier
 */
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

/**
 * Ferme le modal de modification
 */
function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}

// ============================================================================
// MODIFICATION DE MATCH
// ============================================================================

/**
 * Modifie un match existant
 * Envoie les nouvelles données au serveur
 */
async function updateMatch() {
    const matchId = document.getElementById('editMatchId').value;
    const winnerId = parseInt(document.getElementById('editWinner').value);
    const loserId = parseInt(document.getElementById('editLoser').value);
    const winnerScore = parseInt(document.getElementById('editWinnerScore').value);
    const loserScore = parseInt(document.getElementById('editLoserScore').value);
    
    // Validation : même joueur
    if (winnerId === loserId) {
        showMessage('editMessage', '❌ Un joueur ne peut pas jouer contre lui-même !', 'error');
        return;
    }
    
    // Validation : scores valides
    if (isNaN(winnerScore) || isNaN(loserScore) || winnerScore < 0 || loserScore < 0) {
        showMessage('editMessage', '❌ Scores invalides', 'error');
        return;
    }
    
    // Validation : le gagnant doit avoir plus de points
    if (winnerScore <= loserScore) {
        showMessage('editMessage', '❌ Le score du gagnant doit être supérieur', 'error');
        return;
    }
    
    try {
        // Envoyer avec les bons noms de propriétés (snake_case)
        const response = await fetch(`/api/matches/${matchId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                winner_id: winnerId,
                loser_id: loserId,
                winner_score: winnerScore,
                loser_score: loserScore
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('editMessage', '✅ Match modifié avec succès !', 'success');
            setTimeout(() => {
                closeModal();
                loadMatches();
                loadPlayers();
            }, 1500);
        } else {
            showMessage('editMessage', `❌ ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Erreur lors de la modification:', error);
        showMessage('editMessage', '❌ Erreur de connexion au serveur', 'error');
    }
}

// ============================================================================
// SUPPRESSION DE MATCH
// ============================================================================

/**
 * Supprime un match et restaure les Elos des joueurs
 * @param {number} id - ID du match à supprimer
 * @param {string} description - Description du match (pour confirmation)
 */
/**
 * Supprime un match et restaure les Elos des joueurs
 * Affiche un modal de confirmation personnalisé
 * @param {number} id - ID du match à supprimer
 * @param {string} description - Description du match (pour confirmation)
 */
async function deleteMatch(id, description) {
    showConfirmModal({
        icon: '🗑️',
        title: 'Supprimer un match',
        message: `Êtes-vous sûr de vouloir supprimer le match "${description}" ?`,
        warning: 'Les Elo et statistiques des joueurs seront recalculés automatiquement.',
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        onConfirm: async () => {
            try {
                const response = await fetch(`/api/matches/${id}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    showMessage('message', '✅ Match supprimé et Elos restaurés', 'success');
                    loadMatches();
                    loadPlayers();
                } else {
                    const err = await response.json();
                    showMessage('message', `❌ ${err.error}`, 'error');
                }
            } catch (error) {
                console.error('Erreur lors de la suppression:', error);
                showMessage('message', '❌ Erreur de connexion au serveur', 'error');
            }
        }
    });
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Affiche un message temporaire
 * @param {string} elementId - ID de l'élément HTML pour le message
 * @param {string} text - Texte du message
 * @param {string} type - Type ('success' ou 'error')
 */
function showMessage(elementId, text, type) {
    const msg = document.getElementById(elementId);
    if (!msg) return;
    
    msg.textContent = text;
    msg.className = type;
    msg.style.display = 'block';
    
    setTimeout(() => {
        msg.style.display = 'none';
    }, 3000);
}

// ============================================================================
// DÉCONNEXION
// ============================================================================

/**
 * Déconnecte l'administrateur et redirige vers /login
 */
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
    }
}

// ============================================================================
// ÉVÉNEMENTS
// ============================================================================

// Fermer le modal en cliquant en dehors
window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target === modal) {
        closeModal();
    }
}

// ============================================================================
// INITIALISATION
// ============================================================================

// Charger les données au démarrage
loadMatches();
loadPlayers();