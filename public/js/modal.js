/**
 * ============================================================================
 * Magnolia Ping Pong - Gestion du Modal de Confirmation
 * ============================================================================
 * 
 * Ce fichier gère :
 * - La création dynamique du modal de confirmation
 * - L'ouverture et la fermeture du modal
 * - La gestion des callbacks (confirmation/annulation)
 * 
 * Utilisation :
 * showConfirmModal({
 *   title: 'Titre',
 *   message: 'Message',
 *   warning: 'Avertissement',
 *   icon: '🗑️',
 *   onConfirm: () => { /* action *\/ }
 * });
 * 
 * @author Magnolia Ping Pong
 * @version 1.0.0
 * ============================================================================
 */

// ============================================================================
// CRÉATION DU MODAL (une seule fois au chargement)
// ============================================================================

/**
 * Crée la structure HTML du modal et l'ajoute au body
 * Appelée une seule fois au chargement de la page
 */
function createConfirmModal() {
  // Vérifier si le modal existe déjà
  if (document.getElementById('confirmModalOverlay')) {
    return;
  }
  
  // Créer l'overlay
  const overlay = document.createElement('div');
  overlay.id = 'confirmModalOverlay';
  overlay.className = 'confirm-modal-overlay';
  
  // Créer le modal
  const modal = document.createElement('div');
  modal.id = 'confirmModal';
  modal.className = 'confirm-modal';
  
  // Structure interne du modal
  modal.innerHTML = `
    <div class="confirm-modal-icon" id="confirmModalIcon"></div>
    <div class="confirm-modal-title" id="confirmModalTitle"></div>
    <div class="confirm-modal-message" id="confirmModalMessage"></div>
    <div class="confirm-modal-warning" id="confirmModalWarning"></div>
    <div class="confirm-modal-buttons">
      <button class="confirm-modal-btn confirm-modal-btn-cancel" id="confirmModalCancel">
        Annuler
      </button>
      <button class="confirm-modal-btn confirm-modal-btn-confirm" id="confirmModalConfirm">
        Confirmer
      </button>
    </div>
  `;
  
  // Ajouter au body
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  
  // Attacher les événements
  document.getElementById('confirmModalCancel').addEventListener('click', closeConfirmModal);
  document.getElementById('confirmModalOverlay').addEventListener('click', closeConfirmModal);
  
  // Fermer avec Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeConfirmModal();
    }
  });
}

// ============================================================================
// AFFICHAGE DU MODAL
// ============================================================================

/**
 * Affiche le modal de confirmation
 * @param {Object} options - Options du modal
 * @param {string} options.title - Titre du modal
 * @param {string} options.message - Message principal
 * @param {string} options.warning - Message d'avertissement (optionnel)
 * @param {string} options.icon - Icône emoji (défaut: ⚠️)
 * @param {string} options.confirmText - Texte du bouton confirmer (défaut: Confirmer)
 * @param {string} options.cancelText - Texte du bouton annuler (défaut: Annuler)
 * @param {Function} options.onConfirm - Callback si confirmé
 * @param {Function} options.onCancel - Callback si annulé (optionnel)
 */
function showConfirmModal(options) {
  // S'assurer que le modal existe
  createConfirmModal();
  
  // Récupérer les éléments
  const overlay = document.getElementById('confirmModalOverlay');
  const modal = document.getElementById('confirmModal');
  const icon = document.getElementById('confirmModalIcon');
  const title = document.getElementById('confirmModalTitle');
  const message = document.getElementById('confirmModalMessage');
  const warning = document.getElementById('confirmModalWarning');
  const btnConfirm = document.getElementById('confirmModalConfirm');
  const btnCancel = document.getElementById('confirmModalCancel');
  
  // Remplir le contenu
  icon.textContent = options.icon || '⚠️';
  title.textContent = options.title || 'Confirmation';
  message.textContent = options.message || '';
  warning.textContent = options.warning || '';
  warning.style.display = options.warning ? 'block' : 'none';
  
  btnConfirm.textContent = options.confirmText || 'Confirmer';
  btnCancel.textContent = options.cancelText || 'Annuler';
  
  // Nettoyer les anciens listeners
  const newBtnConfirm = btnConfirm.cloneNode(true);
  btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);
  
  const newBtnCancel = btnCancel.cloneNode(true);
  btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
  
  // Attacher les nouveaux listeners
  newBtnConfirm.addEventListener('click', () => {
    closeConfirmModal();
    if (options.onConfirm) {
      options.onConfirm();
    }
  });
  
  newBtnCancel.addEventListener('click', () => {
    closeConfirmModal();
    if (options.onCancel) {
      options.onCancel();
    }
  });
  
  // Afficher
  overlay.classList.add('active');
  modal.classList.add('active');
  
  // Focus sur le bouton annuler par défaut (plus sûr)
  newBtnCancel.focus();
}

// ============================================================================
// FERMETURE DU MODAL
// ============================================================================

/**
 * Ferme le modal de confirmation
 */
function closeConfirmModal() {
  const overlay = document.getElementById('confirmModalOverlay');
  const modal = document.getElementById('confirmModal');
  
  if (overlay) overlay.classList.remove('active');
  if (modal) modal.classList.remove('active');
}

// ============================================================================
// EXPOSITION GLOBALE
// ============================================================================

window.showConfirmModal = showConfirmModal;
window.closeConfirmModal = closeConfirmModal;

// ============================================================================
// INITIALISATION
// ============================================================================

// Créer le modal au chargement du DOM
document.addEventListener('DOMContentLoaded', createConfirmModal);