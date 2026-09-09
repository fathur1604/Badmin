/* ============================================
   BadmintonKu — Player Management
   Add, remove, toggle presence
   ============================================ */

const Players = (() => {

  function render() {
    const container = document.getElementById('players-list');
    const countBadge = document.getElementById('present-count');
    const players = Storage.getPlayers();
    const presentCount = players.filter(p => p.isPresent).length;

    countBadge.textContent = `${presentCount} hadir`;

    if (players.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <div class="empty-state-title">Belum ada pemain</div>
          <div class="empty-state-desc">Tambahkan teman-teman kamu untuk mulai bermain!</div>
        </div>
      `;
      return;
    }

    container.innerHTML = players.map((player, i) => `
      <div class="player-chip ${player.isPresent ? 'present' : ''}"
           style="animation: staggerIn 0.3s ease ${i * 50}ms both"
           data-id="${player.id}">
        <div class="player-avatar">${player.avatar}</div>
        <div class="player-info">
          <div class="player-name">${escapeHtml(player.name)}</div>
          <div class="player-stat-mini">${player.stats.wins}W / ${player.stats.losses}L · ${player.stats.matches} match</div>
        </div>
        <div class="player-actions">
          <button class="presence-toggle ${player.isPresent ? 'checked' : ''}"
                  onclick="Players.togglePresence('${player.id}')"
                  title="${player.isPresent ? 'Tandai tidak hadir' : 'Tandai hadir'}">
            ✓
          </button>
          <button class="btn btn-ghost btn-icon"
                  onclick="Players.confirmDelete('${player.id}', '${escapeHtml(player.name)}')"
                  title="Hapus pemain"
                  style="font-size: 0.875rem; color: var(--text-muted);">
            🗑️
          </button>
        </div>
      </div>
    `).join('');
  }

  function addPlayer() {
    const input = document.getElementById('player-name-input');
    const name = input.value.trim();

    if (!name) {
      App.showToast('Masukkan nama pemain', 'error');
      input.focus();
      return;
    }

    if (name.length > 20) {
      App.showToast('Nama terlalu panjang (maks 20 karakter)', 'error');
      return;
    }

    // Check duplicate
    const existing = Storage.getPlayers().find(
      p => p.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      App.showToast('Nama pemain sudah ada', 'error');
      return;
    }

    Storage.addPlayer(name);
    input.value = '';
    input.focus();
    render();
    App.updateHomeStats();
    App.showToast(`${name} ditambahkan! 🏸`, 'success');
  }

  function togglePresence(id) {
    Storage.togglePresence(id);
    render();
    App.updateHomeStats();
  }

  function confirmDelete(id, name) {
    App.showModal(
      'Hapus Pemain',
      `Yakin ingin menghapus <strong>${name}</strong>? Statistik pemain ini akan hilang.`,
      [
        { text: 'Batal', class: 'btn-secondary', action: () => App.hideModal() },
        {
          text: 'Hapus',
          class: 'btn-danger',
          action: () => {
            Storage.removePlayer(id);
            render();
            App.updateHomeStats();
            App.hideModal();
            App.showToast(`${name} dihapus`, 'info');
          }
        }
      ]
    );
  }

  function toggleAllPresence(present) {
    const players = Storage.getPlayers();
    players.forEach(p => p.isPresent = present);
    Storage.savePlayers(players);
    render();
    App.updateHomeStats();
  }

  // Enter key handler
  function initInput() {
    const input = document.getElementById('player-name-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addPlayer();
        }
      });
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    render,
    addPlayer,
    togglePresence,
    confirmDelete,
    toggleAllPresence,
    initInput
  };
})();
