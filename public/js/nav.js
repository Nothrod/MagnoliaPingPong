// ========================================
// NAVIGATION COMMUNE - CHARGEMENT DYNAMIQUE
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  loadNavigation();
});

/**
 * Charge la navigation depuis nav.html et l'injecte dans le DOM
 */
async function loadNavigation() {
  try {
    // Charger le fichier nav.html
    const response = await fetch('/components/nav.html');
    
    if (!response.ok) {
      throw new Error('Impossible de charger la navigation');
    }
    
    const navHTML = await response.text();
    
    // Injecter la navigation dans le placeholder
    const placeholder = document.getElementById('nav-placeholder');
    if (placeholder) {
      placeholder.innerHTML = navHTML;
      
      // Initialiser le menu burger après injection
      initBurgerMenu();
      
      // Marquer le lien actif selon la page courante
      markActiveLink();
    }
  } catch (error) {
    console.error('Erreur chargement navigation:', error);
  }
}

/**
 * Initialise le menu burger pour mobile
 */
function initBurgerMenu() {
  const burgerMenu = document.getElementById('burgerMenu');
  const navMenu = document.querySelector('.nav-menu');
  
  // Toggle du menu au clic sur le burger
  burgerMenu?.addEventListener('click', () => {
    burgerMenu.classList.toggle('active');
    navMenu.classList.toggle('active');
  });

  // Fermer le menu quand on clique sur un lien
  document.querySelectorAll('.nav-link, .btn-admin').forEach(link => {
    link.addEventListener('click', () => {
      burgerMenu?.classList.remove('active');
      navMenu?.classList.remove('active');
    });
  });

  // Fermer le menu quand on clique en dehors
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-menu') && !e.target.closest('.burger-menu')) {
      burgerMenu?.classList.remove('active');
      navMenu?.classList.remove('active');
    }
  });

  // Fermer le menu avec la touche Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      burgerMenu?.classList.remove('active');
      navMenu?.classList.remove('active');
    }
  });
}

/**
 * Marque le lien actif selon l'URL courante
 */
function markActiveLink() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    
    // Si le lien correspond à la page courante, ajouter la classe active
    if (currentPath === href || currentPath === href + '/') {
      link.classList.add('active');
    }
  });
}