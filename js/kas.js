/* ============================================
   BadmintonKu — Kas / Iuran
   Track court rental fees per session
   ============================================ */

const Kas = (() => {

  function render() {
    renderSummary();
    renderSessions();
  }

  function renderSummary() {
    const container = document.getElementById('kas-summary');
    const summary = Storage.getKasSummary();

    if (summary.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Calculate totals
    const totalUnpaid = summary.reduce((sum, s) => sum + Math.max(0, -s.balance), 0);

    let html = `
      <div class="card card-sm mb-lg" style="border-color: ${totalUnpaid > 0 ? 'var(--accent-warning)' : 'var(--accent-primary)'}">
        <div class="flex-between">
          <div>
            <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;text-transform:uppercase">Total Belum Lunas</div>
            <div style="font-size:1.5rem;font-weight:900;color:${totalUnpaid > 0 ? 'var(--accent-warning)' : 'var(--accent-primary)'}">
              Rp ${formatNumber(totalUnpaid)}
            </div>
          </div>
          <div style="font-size:2rem">${totalUnpaid > 0 ? '⚠️' : '✅'}</div>
        </div>
      </div>
    `;

    // Per-player breakdown
    if (summary.some(s => s.balance < 0)) {
      html += '<div class="section-title">Belum Lunas</div>';
      html += '<div class="leaderboard-list mb-lg">';
      summary.filter(s => s.balance < 0).forEach(s => {
        html += `
          <div class="leaderboard-row">
            <div class="player-avatar" style="width:36px;height:36px;font-size:0.875rem">${s.avatar}</div>
            <div class="leaderboard-info">
              <div class="leaderboard-name">${escapeHtml(s.name)}</div>
              <div class="leaderboard-detail">Bayar: Rp ${formatNumber(s.totalPaid)} / Rp ${formatNumber(s.totalOwed)}</div>
            </div>
            <div style="font-weight:800;color:var(--accent-danger);font-size:0.875rem">
              -Rp ${formatNumber(Math.abs(s.balance))}
            </div>
          </div>
        `;
      });
      html += '</div>';
    }

    container.innerHTML = html;
  }

  function renderSessions() {
    const container = document.getElementById('kas-sessions');
    const sessions = Storage.getKasSessions();

    if (sessions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💰</div>
          <div class="empty-state-title">Belum ada catatan iuran</div>
          <div class="empty-state-desc">Buat sesi baru untuk mulai mencatat iuran sewa lapangan.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = sessions.map(session => {
      const paidCount = session.participants.filter(p => p.paid).length;
      const totalCount = session.participants.length;
      const allPaid = paidCount === totalCount;
      const dateStr = formatDate(session.date);

      return `
        <div class="match-card" onclick="Kas.showSessionDetail('${session.id}')">
          <div class="match-card-header">
            <span class="match-date">${dateStr}</span>
            <div style="display:flex;gap:var(--space-xs);align-items:center">
              <span class="badge ${allPaid ? 'badge-accent' : 'badge-warning'}">
                ${allPaid ? '✅ Lunas' : `${paidCount}/${totalCount} bayar`}
              </span>
              <button class="btn btn-ghost" style="padding:4px 6px;font-size:0.75rem;color:var(--text-muted)"
                      onclick="event.stopPropagation(); Kas.deleteSession('${session.id}')">🗑️</button>
            </div>
          </div>
          <div style="margin-top:var(--space-sm)">
            <div style="font-weight:700;font-size:0.9375rem">${session.note || 'Sesi Badminton'}</div>
            <div style="font-size:0.8125rem;color:var(--text-muted);margin-top:2px">
              Rp ${formatNumber(session.costPerPerson)}/orang · ${totalCount} orang · Total Rp ${formatNumber(session.totalCost)}
            </div>
          </div>
          <!-- Payment chips -->
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:var(--space-sm)">
            ${session.participants.map(p => {
              const player = Storage.getPlayerById(p.playerId);
              const name = player ? player.name : '?';
              return `<span class="badge ${p.paid ? 'badge-accent' : 'badge-warning'}" style="font-size:0.6875rem">
                ${p.paid ? '✅' : '⏳'} ${escapeHtml(name)}
              </span>`;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  function showNewSessionModal() {
    const presentPlayers = Storage.getPresentPlayers();
    const allPlayers = Storage.getPlayers();
    const playersToShow = presentPlayers.length > 0 ? presentPlayers : allPlayers;

    if (playersToShow.length === 0) {
      App.showToast('Tambahkan pemain dulu di Beranda', 'error');
      return;
    }

    const content = `
      <div style="display:flex;flex-direction:column;gap:var(--space-md)">
        <div>
          <label style="font-size:0.8125rem;color:var(--text-secondary);font-weight:600;display:block;margin-bottom:4px">Catatan (opsional)</label>
          <input type="text" class="input" id="kas-note" placeholder="Misal: Sesi Sabtu GOR Sudirman" maxlength="40" autocomplete="off">
        </div>
        <div>
          <label style="font-size:0.8125rem;color:var(--text-secondary);font-weight:600;display:block;margin-bottom:4px">Total Biaya Sewa (Rp)</label>
          <input type="number" class="input" id="kas-total-cost" placeholder="150000" min="0" step="5000">
        </div>
        <div>
          <div class="flex-between" style="margin-bottom:var(--space-sm)">
            <label style="font-size:0.8125rem;color:var(--text-secondary);font-weight:600">Peserta</label>
            <span id="kas-participant-count" class="badge badge-accent">${playersToShow.length} dipilih</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto">
            ${playersToShow.map(p => `
              <label class="player-chip present" style="cursor:pointer;padding:var(--space-sm) var(--space-md)">
                <input type="checkbox" class="kas-player-cb" value="${p.id}" checked style="display:none">
                <div class="player-avatar" style="width:32px;height:32px;font-size:0.8125rem">${p.avatar}</div>
                <div class="player-name" style="font-size:0.8125rem">${escapeHtml(p.name)}</div>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="card card-sm" style="text-align:center">
          <div style="font-size:0.75rem;color:var(--text-muted)">Biaya per orang</div>
          <div id="kas-per-person" style="font-size:1.25rem;font-weight:800;color:var(--accent-primary)">Rp 0</div>
        </div>
      </div>
    `;

    App.showModal('💰 Buat Sesi Iuran Baru', content, [
      { text: 'Batal', class: 'btn-secondary', action: () => App.hideModal() },
      { text: '💰 Simpan', class: 'btn-primary', action: () => saveNewSession() }
    ], true);

    // Auto-calculate cost per person
    setTimeout(() => {
      const totalInput = document.getElementById('kas-total-cost');
      const checkboxes = document.querySelectorAll('.kas-player-cb');
      const perPersonEl = document.getElementById('kas-per-person');
      const countEl = document.getElementById('kas-participant-count');

      function updateCalc() {
        const total = parseInt(totalInput.value) || 0;
        const checked = document.querySelectorAll('.kas-player-cb:checked').length;
        countEl.textContent = `${checked} dipilih`;
        const perPerson = checked > 0 ? Math.ceil(total / checked) : 0;
        perPersonEl.textContent = `Rp ${formatNumber(perPerson)}`;
      }

      totalInput.addEventListener('input', updateCalc);
      checkboxes.forEach(cb => {
        cb.addEventListener('change', (e) => {
          const chip = e.target.closest('.player-chip');
          chip.classList.toggle('present', e.target.checked);
          updateCalc();
        });
      });
    }, 100);
  }

  function saveNewSession() {
    const totalCost = parseInt(document.getElementById('kas-total-cost').value) || 0;
    const note = document.getElementById('kas-note').value.trim();
    const checkedIds = Array.from(document.querySelectorAll('.kas-player-cb:checked'))
      .map(cb => cb.value);

    if (totalCost <= 0) {
      App.showToast('Masukkan total biaya sewa', 'error');
      return;
    }

    if (checkedIds.length === 0) {
      App.showToast('Pilih minimal 1 peserta', 'error');
      return;
    }

    const costPerPerson = Math.ceil(totalCost / checkedIds.length);
    const participants = checkedIds.map(id => ({ playerId: id, paid: false }));

    Storage.addKasSession({
      totalCost,
      costPerPerson,
      note,
      participants
    });

    App.hideModal();
    render();
    App.showToast('Sesi iuran dibuat! 💰', 'success');
  }

  function showSessionDetail(sessionId) {
    const sessions = Storage.getKasSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const dateStr = new Date(session.date).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const content = `
      <div style="text-align:center;margin-bottom:var(--space-lg)">
        <div style="font-size:0.8125rem;color:var(--text-muted)">${dateStr}</div>
        <div style="font-size:1.125rem;font-weight:700;margin-top:4px">${escapeHtml(session.note || 'Sesi Badminton')}</div>
        <div style="font-size:0.875rem;color:var(--text-secondary);margin-top:4px">
          Rp ${formatNumber(session.costPerPerson)}/orang · Total Rp ${formatNumber(session.totalCost)}
        </div>
      </div>

      <div class="section-title" style="font-size:0.75rem">Tap untuk toggle pembayaran</div>
      <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
        ${session.participants.map(p => {
          const player = Storage.getPlayerById(p.playerId);
          const name = player ? player.name : '?';
          const avatar = player ? player.avatar : '?';
          return `
            <div class="player-chip ${p.paid ? 'present' : ''}"
                 onclick="Kas.togglePayment('${sessionId}', '${p.playerId}')"
                 style="cursor:pointer">
              <div class="player-avatar" style="width:36px;height:36px;font-size:0.875rem">${avatar}</div>
              <div class="player-info">
                <div class="player-name" style="font-size:0.875rem">${escapeHtml(name)}</div>
                <div class="player-stat-mini">Rp ${formatNumber(session.costPerPerson)}</div>
              </div>
              <div style="font-size:1.25rem">${p.paid ? '✅' : '⏳'}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    App.showModal('💰 Detail Sesi', content, [
      { text: 'Tutup', class: 'btn-secondary btn-block', action: () => App.hideModal() }
    ], true);
  }

  function togglePayment(sessionId, playerId) {
    Storage.toggleKasPayment(sessionId, playerId);
    // Re-render the modal by re-opening the detail
    showSessionDetail(sessionId);
    render(); // Also update the background list
  }

  function deleteSession(id) {
    App.showModal(
      'Hapus Sesi Iuran',
      'Yakin ingin menghapus sesi iuran ini?',
      [
        { text: 'Batal', class: 'btn-secondary', action: () => App.hideModal() },
        {
          text: 'Hapus',
          class: 'btn-danger',
          action: () => {
            Storage.deleteKasSession(id);
            render();
            App.hideModal();
            App.showToast('Sesi iuran dihapus', 'info');
          }
        }
      ]
    );
  }

  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function formatDate(isoString) {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now - d;
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffHours < 1) return 'Baru saja';
    if (diffHours < 24) return `${diffHours} jam lalu`;

    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    render,
    showNewSessionModal,
    showSessionDetail,
    togglePayment,
    deleteSession
  };
})();
