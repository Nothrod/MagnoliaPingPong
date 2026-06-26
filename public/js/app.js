/**
 * ============================================================================
 * Magnolia Ping Pong - Page d'Accueil (Classement Public)
 * ============================================================================
 * 
 * Ce fichier gère :
 * - L'affichage du classement public des joueurs
 * - Le calcul des statistiques (ratio victoires/défaites, ratio points)
 * - Le tri intelligent (joueurs actifs d'abord, puis nouveaux)
 * - L'affichage spécial du top 3 avec médailles
 * - Le rafraîchissement automatique toutes les 30 secondes
 * 
 * @author Magnolia Ping Pong
 * @version 3.0.0
 * ============================================================================
 */

// ============================================================================
// CHARGEMENT DU CLASSEMENT
// ============================================================================

/**
 * Charge le classement des joueurs depuis l'API
 * Trie intelligemment : joueurs actifs d'abord, puis nouveaux
 * Affiche le top 3 avec médailles
 */
async function loadLeaderboard() {
    try {
        const response = await fetch('/api/players');
        const players = await response.json();
        
        const tbody = document.querySelector('#leaderboard tbody');
        
        if (!tbody) {
            console.error('Tableau #leaderboard non trouvé');
            return;
        }
        
        // Si aucun joueur
        if (players.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px;">Aucun joueur enregistré</td></tr>';
            return;
        }
        
        // =========================================================================
        // TRI INTELLIGENT
        // =========================================================================
        // 1. Séparer les joueurs actifs (au moins 1 match) des nouveaux (0 match)
        // 2. Trier chaque groupe par Elo décroissant
        // 3. Concaténer : actifs d'abord, puis nouveaux
        
        const activePlayers = players.filter(p => (p.wins + p.losses) > 0)
            .sort((a, b) => b.elo - a.elo);
        
        const newPlayers = players.filter(p => (p.wins + p.losses) === 0)
            .sort((a, b) => b.elo - a.elo);
        
        const sortedPlayers = [...activePlayers, ...newPlayers];
        
        // =========================================================================
        // AFFICHAGE AVEC TOP 3 SPÉCIAL
        // =========================================================================
        tbody.innerHTML = sortedPlayers.map((p, i) => {
            const rank = i + 1;
            
            // Calcul du ratio victoires/défaites
            const totalGames = p.wins + p.losses;
            const ratio = totalGames > 0 ? ((p.wins / totalGames) * 100).toFixed(1) : '0.0';
            
            // Calcul du ratio points marqués/encaissés
            const totalPoints = p.points_won + p.points_lost;
            const pointsRatio = totalPoints > 0 
                ? ((p.points_won / totalPoints) * 100).toFixed(1) 
                : '0.0';
            
            // Couleur du ratio selon performance
            const ratioClass = ratio >= 50 ? 'ratio-good' : 'ratio-bad';
            
            // =========================================================================
            // TOP 3 : Médailles et classes spéciales
            // =========================================================================
            let rankDisplay = rank;
            let rowClass = '';
            let nameDisplay = p.name;
            
            if (rank === 1) {
                rankDisplay = '🥇';
                rowClass = 'rank-1';
                nameDisplay = `<strong class="gold-name">${p.name}</strong>`;
            } else if (rank === 2) {
                rankDisplay = '🥈';
                rowClass = 'rank-2';
                nameDisplay = `<strong class="silver-name">${p.name}</strong>`;
            } else if (rank === 3) {
                rankDisplay = '🥉';
                rowClass = 'rank-3';
                nameDisplay = `<strong class="bronze-name">${p.name}</strong>`;
            } else {
                nameDisplay = `<strong>${p.name}</strong>`;
            }
            
            // Indicateur pour les nouveaux joueurs (0 match)
            const newPlayerBadge = totalGames === 0 
                ? '<span class="new-badge">NEW</span>' 
                : '';
            
            return `
                <tr class="${rowClass}">
                    <td class="rank-cell">${rankDisplay}</td>
                    <td>${nameDisplay} ${newPlayerBadge}</td>
                    <td class="elo-cell">${p.elo}</td>
                    <td>${p.wins}</td>
                    <td>${p.losses}</td>
                    <td class="${ratioClass}">${totalGames > 0 ? ratio + '%' : '-'}</td>
                    <td>${totalPoints > 0 ? `${p.points_won}-${p.points_lost} (${pointsRatio}%)` : '-'}</td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Erreur lors du chargement du classement:', error);
        const tbody = document.querySelector('#leaderboard tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px; color: #ef4444;">Erreur de chargement</td></tr>';
        }
    }
}

// ============================================================================
// INITIALISATION
// ============================================================================

// Charger le classement au démarrage
loadLeaderboard();

// Rafraîchir automatiquement toutes les 30 secondes
setInterval(loadLeaderboard, 30000);