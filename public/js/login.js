/**
 * ============================================================================
 * Magnolia Ping Pong - Gestion de la Connexion Admin
 * ============================================================================
 * 
 * Ce fichier gère :
 * - La soumission du formulaire de connexion
 * - L'envoi des identifiants au serveur
 * - L'affichage des messages d'erreur/succès
 * - La redirection après connexion réussie
 * 
 * @author Magnolia Ping Pong
 * @version 1.0.0
 * ============================================================================
 */

// ============================================================================
// Sélection des éléments DOM
// ============================================================================
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('password');
const messageDiv = document.getElementById('message');

// ============================================================================
// Gestion de la soumission du formulaire
// ============================================================================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Récupérer le mot de passe
  const password = passwordInput.value.trim();
  
  // Validation basique
  if (!password) {
    showMessage('Veuillez entrer un mot de passe', 'error');
    return;
  }
  
  // Désactiver le bouton pendant la requête
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Connexion...';
  
  try {
    // Envoyer la requête au serveur
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      // Connexion réussie
      showMessage('Connexion réussie ! Redirection...', 'success');
      
      // Rediriger vers le tableau de bord admin après 1 seconde
      setTimeout(() => {
        window.location.href = '/admin';
      }, 1000);
    } else {
      // Erreur d'authentification
      showMessage(data.message || 'Mot de passe incorrect', 'error');
      passwordInput.value = '';
      passwordInput.focus();
    }
  } catch (error) {
    console.error('Erreur de connexion:', error);
    showMessage('Erreur de connexion au serveur', 'error');
  } finally {
    // Réactiver le bouton
    submitBtn.disabled = false;
    submitBtn.textContent = 'Se connecter';
  }
});

// ============================================================================
// Fonction d'affichage des messages
// ============================================================================
/**
 * Affiche un message dans la zone de notification
 * @param {string} text - Texte du message
 * @param {string} type - Type du message ('success' ou 'error')
 */
function showMessage(text, type) {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = 'block';
  
  // Masquer le message après 5 secondes
  setTimeout(() => {
    messageDiv.style.display = 'none';
  }, 5000);
}

// ============================================================================
// Focus automatique sur le champ mot de passe au chargement
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  passwordInput.focus();
});