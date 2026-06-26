/**
 * ============================================================================
 * Magnolia Ping Pong - Page d'Administration Principale
 * ============================================================================
 * 
 * Ce fichier gère :
 * - La vérification de l'authentification admin
 * - L'ajout et suppression de joueurs
 * - L'enregistrement de matchs avec selects personnalisés
 * - L'affichage du classement avec statistiques
 * 
 * @author Magnolia Ping Pong
 * @version 3.0.0
 * ============================================================================
 */

// ============================================================================
// VÉRIFICATION DE L'AUTHENTIFICATION
// ============================================================================

async function checkAuth() {
    const response = await fetch('/api/check-auth');
    const data = await response.json();
    
    if (!data.isAdmin) {
        window.location.href = '/login';
    }
}

// ============================================================================
// VARIABLES GLOBALES
// ============================================================================

let allPlayers = [];

// ============================================================================
// GESTION DES SELECTS PERSONNALISÉS
// ============================================================================

/**
 * ============================================================================
 * GESTION DES SELECTS PERSONNALISÉS
 * ============================================================================
 */

/**
 * Initialise les selects personnalisés avec la liste des joueurs
 */
function initCustomSelects() {
    console.log('🔧 initCustomSelects appelé avec', allPlayers.length, 'joueurs');
    
    const winnerSelect = document.getElementById('winnerSelect');
    const loserSelect = document.getElementById('loserSelect');
    
    if (!winnerSelect || !loserSelect) {
        console.error('❌ Selects non trouvés dans le DOM');
        return;
    }
    
    // Nettoyer les anciens événements en clonant les éléments
    const newWinnerSelect = winnerSelect.cloneNode(true);
    winnerSelect.parentNode.replaceChild(newWinnerSelect, winnerSelect);
    
    const newLoserSelect = loserSelect.cloneNode(true);
    loserSelect.parentNode.replaceChild(newLoserSelect, loserSelect);
    
    // Re-configurer avec les nouveaux éléments
    setupCustomSelect(document.getElementById('winnerSelect'), 'winner');
    setupCustomSelect(document.getElementById('loserSelect'), 'loser');
}

/**
 * Configure un select personnalisé
 */
/**
 * Configure un select personnalisé avec logs de diagnostic
 * @param {HTMLElement} selectElement - L'élément .custom-select
 * @param {string} targetId - ID du champ caché (winner ou loser)
 */
function setupCustomSelect(selectElement, targetId) {
    if (!selectElement) {
        console.error('❌ Select element null pour', targetId);
        return;
    }
    
    const itemsContainer = selectElement.querySelector('.select-items');
    const selectedDisplay = selectElement.querySelector('.select-selected');
    
    if (!itemsContainer || !selectedDisplay) {
        console.error('❌ Éléments internes manquants pour', targetId);
        return;
    }
    
    // Générer la liste des joueurs
    if (allPlayers.length === 0) {
        itemsContainer.innerHTML = '<div class="select-item" style="color: #666; font-style: italic;">Aucun joueur disponible</div>';
        return;
    }
    
    itemsContainer.innerHTML = allPlayers.map(p => `
        <div class="select-item" data-value="${p.id}" data-name="${p.name.replace(/'/g, "\\'")}">
            <span class="select-item-name">${p.name}</span>
            <span class="select-item-elo">${p.elo}</span>
        </div>
    `).join('');
    
    console.log(`✅ ${allPlayers.length} joueurs chargés dans le select ${targetId}`);
    console.log('📦 Contenu HTML généré:', itemsContainer.innerHTML.substring(0, 200) + '...');
    console.log('📏 Hauteur initiale container:', itemsContainer.offsetHeight, 'px');
    
    // Clic sur la zone d'affichage → ouvrir/fermer
    selectedDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        
        console.log('');
        console.log('🖱️ ========== CLIC SUR LE SELECT ==========', targetId);
        console.log('📂 État avant toggle:', selectElement.classList.contains('open'));
        console.log('📏 Hauteur items avant:', itemsContainer.offsetHeight, 'px');
        
        // Fermer les autres selects
        document.querySelectorAll('.custom-select').forEach(s => {
            if (s !== selectElement) s.classList.remove('open');
        });
        
        selectElement.classList.toggle('open');
        
        console.log('📂 État après toggle:', selectElement.classList.contains('open'));
        console.log('📏 Hauteur items après:', itemsContainer.offsetHeight, 'px');
        console.log('🎨 Computed max-height:', getComputedStyle(itemsContainer).maxHeight);
        console.log('🎨 Computed opacity:', getComputedStyle(itemsContainer).opacity);
        console.log('🎨 Computed display:', getComputedStyle(itemsContainer).display);
        console.log('🎨 Computed visibility:', getComputedStyle(itemsContainer).visibility);
        console.log('🎨 Computed overflow:', getComputedStyle(itemsContainer).overflow);
        console.log('🎨 Z-index:', getComputedStyle(itemsContainer).zIndex);
        console.log('===========================================');
        console.log('');
    });
    
    // Clic sur une option
    itemsContainer.querySelectorAll('.select-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const value = item.dataset.value;
            const name = item.dataset.name;
            const elo = item.querySelector('.select-item-elo').textContent;
            
            console.log('✅ Joueur sélectionné:', name, '(ID:', value, ', ELO:', elo, ')');
            
            // Mettre à jour l'affichage
            selectedDisplay.innerHTML = `
                <span class="selected-name">${name}</span>
                <span class="selected-elo">${elo}</span>
            `;
            selectedDisplay.classList.remove('placeholder');
            
            // Mettre à jour le champ caché
            document.getElementById(targetId).value = value;
            
            // Marquer comme sélectionné
            itemsContainer.querySelectorAll('.select-item').forEach(i => {
                i.classList.remove('selected');
            });
            item.classList.add('selected');
            
            // Fermer le select
            selectElement.classList.remove('open');
            
            // Valider la sélection
            validatePlayerSelection();
        });
    });
}

/**
 * Réinitialise les selects personnalisés
 */
function resetCustomSelects() {
    const winnerSelect = document.getElementById('winnerSelect');
    const loserSelect = document.getElementById('loserSelect');
    
    [winnerSelect, loserSelect].forEach(select => {
        if (!select) return;
        
        const selectedDisplay = select.querySelector('.select-selected');
        selectedDisplay.innerHTML = 'Sélectionner un joueur';
        selectedDisplay.classList.add('placeholder');
        
        const targetId = select.dataset.target;
        document.getElementById(targetId).value = '';
        
        select.querySelectorAll('.select-item').forEach(item => {
            item.classList.remove('selected');
        });
    });
}

/**
 * Valide la sélection des joueurs en temps réel
 */
function validatePlayerSelection() {
    const winnerId = document.getElementById('winner').value;
    const loserId = document.getElementById('loser').value;
    const warningDiv = document.getElementById('selectionWarning');
    
    if (!warningDiv) return;
    
    if (winnerId && loserId && winnerId === loserId) {
        warningDiv.textContent = '⚠️ Vous ne pouvez pas sélectionner le même joueur comme gagnant et perdant !';
        warningDiv.style.display = 'block';
    } else {
        warningDiv.style.display = 'none';
    }
}

// Fermer les selects en cliquant en dehors
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select')) {
        document.querySelectorAll('.custom-select').forEach(s => {
            s.classList.remove('open');
        });
    }
});

// ============================================================================
// GESTION DES MATCHS
// ============================================================================

/**
 * Enregistre un nouveau match dans la base de données
 */
async function recordMatch() {
    const winnerId = parseInt(document.getElementById('winner').value);
    const loserId = parseInt(document.getElementById('loser').value);
    const winnerScore = parseInt(document.getElementById('winnerScore').value);
    const loserScore = parseInt(document.getElementById('loserScore').value);
    
    // Validation : Même joueur
    if (winnerId === loserId) {
        showConfirmModal({
            icon: '⚠️',
            title: 'Sélection invalide',
            message: 'Vous ne pouvez pas sélectionner le même joueur comme gagnant et perdant.',
            warning: 'Veuillez choisir deux joueurs différents.',
            confirmText: 'OK',
            cancelText: 'Annuler'
        });
        return;
    }
    
    // Validation : Scores valides
    if (isNaN(winnerScore) || isNaN(loserScore)) {
        showConfirmModal({
            icon: '❌',
            title: 'Scores invalides',
            message: 'Veuillez entrer les scores des deux joueurs.',
            warning: 'Les scores doivent être des nombres entiers.',
            confirmText: 'OK',
            cancelText: 'Annuler'
        });
        return;
    }
    
    if (winnerScore < 0 || loserScore < 0) {
        showConfirmModal({
            icon: '❌',
            title: 'Scores négatifs',
            message: 'Les scores ne peuvent pas être négatifs.',
            warning: 'Veuillez entrer des scores positifs.',
            confirmText: 'OK',
            cancelText: 'Annuler'
        });
        return;
    }
    
    if (winnerScore <= loserScore) {
        showConfirmModal({
            icon: '❌',
            title: 'Score incorrect',
            message: `Le score du gagnant (${winnerScore}) doit être supérieur à celui du perdant (${loserScore}).`,
            warning: 'Veuillez corriger les scores.',
            confirmText: 'OK',
            cancelText: 'Annuler'
        });
        return;
    }
    
    // Règle 1 : Le gagnant doit avoir au moins 21 points
    if (winnerScore < 21) {
        showConfirmModal({
            icon: '❌',
            title: 'Score insuffisant',
            message: `Le gagnant doit atteindre au moins 21 points (actuellement : ${winnerScore}).`,
            warning: 'Au ping-pong, un match se joue en 21 points.',
            confirmText: 'OK',
            cancelText: 'Annuler'
        });
        return;
    }
    
    // Règle 2 : Si 21 points, écart de 2 minimum
    if (winnerScore === 21 && loserScore > 19) {
        showConfirmModal({
            icon: '❌',
            title: 'Écart insuffisant',
            message: `Avec 21 points, le perdant doit avoir maximum 19 points (actuellement : ${loserScore}).`,
            warning: 'Il faut au moins 2 points d\'écart pour gagner.',
            confirmText: 'OK',
            cancelText: 'Annuler'
        });
        return;
    }
    
    // Règle 3 : Si plus de 21, exactement 2 points d'écart
    if (winnerScore > 21) {
        const scoreDiff = winnerScore - loserScore;
        
        if (scoreDiff !== 2) {
            showConfirmModal({
                icon: '❌',
                title: 'Écart incorrect',
                message: `Au-delà de 21 points, il faut exactement 2 points d'écart (actuellement : ${scoreDiff} points).`,
                warning: `Score valide : ${winnerScore}-${winnerScore - 2}`,
                confirmText: 'OK',
                cancelText: 'Annuler'
            });
            return;
        }
    }
    
    // Envoi au serveur
    try {
        const response = await fetch('/api/matches', {
            method: 'POST',
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
            const winnerName = allPlayers.find(p => p.id === winnerId)?.name || 'Gagnant';
            const loserName = allPlayers.find(p => p.id === loserId)?.name || 'Perdant';
            
            showConfirmModal({
                icon: '✅',
                title: 'Match enregistré !',
                message: `${winnerName} ${winnerScore}-${loserScore} ${loserName}`,
                warning: `Variation ELO : +${data.elo_change} pour ${winnerName}`,
                confirmText: 'Super !',
                cancelText: 'Fermer'
            });
            
            loadPlayers();
            
            // Réinitialiser les scores et selects
            document.getElementById('winnerScore').value = '';
            document.getElementById('loserScore').value = '';
            resetCustomSelects();
        } else {
            showConfirmModal({
                icon: '❌',
                title: 'Erreur',
                message: data.error || 'Une erreur est survenue.',
                warning: 'Veuillez réessayer.',
                confirmText: 'OK',
                cancelText: 'Annuler'
            });
        }
    } catch (error) {
        console.error('Erreur:', error);
        showConfirmModal({
            icon: '❌',
            title: 'Erreur de connexion',
            message: 'Impossible de contacter le serveur.',
            warning: 'Vérifiez votre connexion.',
            confirmText: 'OK',
            cancelText: 'Annuler'
        });
    }
}

// ============================================================================
// GESTION DES JOUEURS
// ============================================================================

async function loadPlayers() {
    try {
        const response = await fetch('/api/players');
        allPlayers = await response.json();
        
        displayPlayers(allPlayers);
        initCustomSelects();
    } catch (error) {
        console.error('Erreur lors du chargement des joueurs:', error);
    }
}

function displayPlayers(players) {
    const tbody = document.querySelector('#playersTable tbody');
    
    if (!tbody) return;
    
    if (players.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px;">Aucun joueur trouvé</td></tr>';
        return;
    }
    
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
        showMessage('message', '❌ Entre un nom !', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/players', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
        if (response.ok) {
            document.getElementById('playerName').value = '';
            showMessage('message', `✅ ${name} ajouté avec succès !`, 'success');
            loadPlayers();
        } else {
            const err = await response.json();
            showMessage('message', `❌ ${err.error}`, 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showMessage('message', '❌ Erreur de connexion', 'error');
    }
}

async function deletePlayer(id, name) {
    showConfirmModal({
        icon: '🗑️',
        title: 'Supprimer un joueur',
        message: `Êtes-vous sûr de vouloir supprimer "${name}" ?`,
        warning: 'Cette action est irréversible.',
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        onConfirm: async () => {
            try {
                const response = await fetch(`/api/players/${id}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    showMessage('message', `✅ ${name} supprimé`, 'success');
                    loadPlayers();
                } else {
                    const err = await response.json();
                    showMessage('message', `❌ ${err.error}`, 'error');
                }
            } catch (error) {
                console.error('Erreur:', error);
                showMessage('message', '❌ Erreur de connexion', 'error');
            }
        }
    });
}

// ============================================================================
// UTILITAIRES
// ============================================================================

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

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        console.error('Erreur:', error);
    }
}

// ============================================================================
// EXPOSITION GLOBALE
// ============================================================================

window.checkAuth = checkAuth;
window.recordMatch = recordMatch;
window.loadPlayers = loadPlayers;
window.displayPlayers = displayPlayers;
window.filterPlayers = filterPlayers;
window.addPlayer = addPlayer;
window.deletePlayer = deletePlayer;
window.showMessage = showMessage;
window.logout = logout;
window.initCustomSelects = initCustomSelects;
window.resetCustomSelects = resetCustomSelects;
window.validatePlayerSelection = validatePlayerSelection;

// ============================================================================
// INITIALISATION
// ============================================================================

checkAuth();

document.addEventListener('DOMContentLoaded', () => {
    const playerNameInput = document.getElementById('playerName');
    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addPlayer();
        });
    }
    
    loadPlayers();
});