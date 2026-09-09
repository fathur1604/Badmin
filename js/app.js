/* ============================================
   BadmintonKu — Main App
   Navigation, routing, global UI
   ============================================ */

const App = (() => {
  let currentTab = 'home';

  function init() {
    // Setup navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        navigate(item.dataset.tab);
      });
    });

    // Setup input handlers
    Players.initInput();

    // Initial render
    navigate('home');
  }

  function navigate(tab) {
    currentTab = tab;

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tab);
    });

    // Update sections
    document.querySelectorAll('.page-section').forEach(section => {
      section.classList.toggle('active', section.id === `section-${tab}`);
    });

    // Render active tab
    switch (tab) {
      case 'home':
        updateHomeStats();
        Players.render();
        break;
      case 'randomizer':
        Randomizer.render();
        break;
      case 'match':
        Match.render();
        break;
      case 'stats':
        Stats.render();
        break;
      case 'kas':
        Kas.render();
        break;
    }
  }

  function updateHomeStats() {
    const players = Storage.getPlayers();
    const matches = Storage.getMatches().filter(m => m.status === 'completed');
    const present = players.filter(p => p.isPresent).length;

    // Today's matches
    const today = new Date().toDateString();
    const todayMatches = matches.filter(m =>
      new Date(m.date).toDateString() === today
    );

    const statTotal = document.getElementById('stat-total-players');
    const statPresent = document.getElementById('stat-present');
    const statMatches = document.getElementById('stat-today-matches');

    if (statTotal) statTotal.textContent = players.length;
    if (statPresent) statPresent.textContent = present;
    if (statMatches) statMatches.textContent = todayMatches.length;

    // Update header badge
    const headerBadge = document.getElementById('stat-present-header');
    if (headerBadge) headerBadge.textContent = present;
  }

  // ---- Toast ----
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️'
    };

    toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ---- Modal ----
  function showModal(title, content, actions = [], isRawContent = false) {
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalActions = document.getElementById('modal-actions');

    modalTitle.textContent = title;

    if (isRawContent) {
      modalBody.innerHTML = content;
    } else {
      modalBody.innerHTML = `<p style="color:var(--text-secondary);font-size:0.9375rem;line-height:1.6">${content}</p>`;
    }

    modalActions.innerHTML = '';
    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = `btn ${action.class || 'btn-secondary'}`;
      btn.textContent = action.text;
      btn.onclick = action.action;
      btn.style.flex = '1';
      modalActions.appendChild(btn);
    });

    overlay.classList.add('active');

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) hideModal();
    };
  }

  function hideModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
  }

  return {
    init,
    navigate,
    updateHomeStats,
    showToast,
    showModal,
    hideModal
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', App.init);
