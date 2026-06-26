function calculateElo(winnerElo, loserElo, winnerScore, loserScore, K = 32) {
  // Probabilité attendue du gagnant (formule Elo classique)
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  
  // Facteur de dominance : plus l'écart est grand, plus le bonus est important
  // Ex: 21-5 = 0.807 (domination), 21-19 = 0.525 (serré)
  const dominanceFactor = winnerScore / (winnerScore + loserScore);
  
  // Ajustement du K selon la dominance
  // K de base = 32, peut varier entre 20 et 44 selon l'écart
  const adjustedK = K * (0.6 + (dominanceFactor * 0.8));
  
  // Calcul du nouveau Elo
  const eloChange = Math.round(adjustedK * (1 - expectedWinner));
  const newWinnerElo = Math.round(winnerElo + eloChange);
  const newLoserElo = Math.round(loserElo - eloChange); // symétrique

  return {
    newWinnerElo,
    newLoserElo,
    eloChange,
    dominanceFactor: (dominanceFactor * 100).toFixed(1)
  };
}

// Valide le score selon les règles du ping-pong
function validateScore(winnerScore, loserScore) {
  // Le gagnant doit avoir au moins 21 points
  if (winnerScore < 21) return false;
  
  // Si le perdant a moins de 20, le gagnant doit avoir exactement 21
  if (loserScore < 20 && winnerScore !== 21) return false;
  
  // Si le perdant a 20 ou plus, l'écart doit être d'au moins 2
  if (loserScore >= 20 && (winnerScore - loserScore) < 2) return false;
  
  return true;
}

module.exports = { calculateElo, validateScore };