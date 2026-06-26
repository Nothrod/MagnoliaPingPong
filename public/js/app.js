/**
 * ============================================================================
 * Magnolia Ping Pong - Page d'Accueil (Classement Public)
 * ============================================================================
 * 
 * Ce fichier gère :
 * - L'affichage du classement public des joueurs
 * - Le calcul des statistiques (ratio victoires/défaites, ratio points)
 * - Le rafraîchissement automatique toutes les 30 secondes
 * 
 * @author Magnolia Ping Pong
 * @version 2.0.0
 * ============================================================================
 */

// ============================================================================
// CHARGEMENT DU CLASSEMENT
// ============================================================================

/**
 * Charge le classement des joueurs depuis l'API
 * Trie par ELO décroissant (déjà fait côté serveur)
 * Affiche les statistiques pour chaque joueur
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
        
        // Générer les lignes du tableau
        tbody.innerHTML = players.map((p, i) => {
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
            
            return `
                <tr>
                    <td>${i + 1}</td>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.elo}</td>
                    <td>${p.wins}</td>
                    <td>${p.losses}</td>
                    <td class="${ratioClass}">${ratio}%</td>
                    <td>${p.points_won}-${p.points_lost} (${pointsRatio}%)</td>
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