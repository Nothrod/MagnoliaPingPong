async function loadLeaderboard() {
    const response = await fetch('/api/leaderboard');
    const players = await response.json();
    
    const tbody = document.querySelector('#leaderboard tbody');
    tbody.innerHTML = players.map((p, i) => {
        const totalGames = p.wins + p.losses;
        const ratio = totalGames > 0 ? ((p.wins / totalGames) * 100).toFixed(1) : '0.0';
        const pointsRatio = (p.points_won + p.points_lost) > 0 
            ? ((p.points_won / (p.points_won + p.points_lost)) * 100).toFixed(1) 
            : '0.0';
        
        return `
            <tr>
                <td>${i + 1}</td>
                <td><strong>${p.name}</strong></td>
                <td>${p.elo}</td>
                <td>${p.wins}</td>
                <td>${p.losses}</td>
                <td>${ratio}%</td>
                <td>${p.points_won}-${p.points_lost} (${pointsRatio}%)</td>
            </tr>
        `;
    }).join('');
}

// Charger au démarrage
loadLeaderboard();

// Rafraîchir toutes les 30 secondes
setInterval(loadLeaderboard, 30000);