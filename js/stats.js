/* ============================================
   BadmintonKu — Statistics & Leaderboard
   Podium, rankings, player details
   ============================================ */

const Stats = (() => {

  function render() {
    renderLeaderboard();
  }

  function renderLeaderboard() {
    const container = document.getElementById('stats-content');
    const leaderboard = Storage.getLeaderboard();

    if (leaderboard.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-title">Belum ada statistik</div>
          <div class="empty-state-desc">Selesaikan beberapa pertandingan untuk melihat leaderboard dan statistik pemain.</div>
        </div>
      `;
      return;
    }

    let html = '';

    // Podium for top 3
    if (leaderboard.length >= 3) {
      const top3 = leaderboard.slice(0, 3);
      // Rearrange for podium: [2nd, 1st, 3rd]
      const podiumOrder = [top3[1], top3[0], top3[2]];
      const medals = ['🥈', '🥇', '🥉'];
      const gradients = [
        'var(--gradient-silver)',
        'var(--gradient-gold)',
        'var(--gradient-bronze)'
      ];

      html += '<div class="podium">';
      podiumOrder.forEach((player, i) => {
        html += `
          <div class="podium-item" onclick="Stats.showPlayerDetail('${player.id}')" style="cursor:pointer">
            <div class="podium-avatar" style="background:${gradients[i]}; color:rgba(0,0,0,0.6)">
              ${player.avatar}
              <span class="podium-medal">${medals[i]}</span>
            </div>
            <div class="podium-name">${escapeHtml(player.name)}</div>
            <div class="podium-winrate">${player.winRate}%</div>
            <div class="podium-bar">${i === 1 ? '1' : i === 0 ? '2' : '3'}</div>
          </div>
        `;
      });
      html += '</div>';
    }

    // Full ranking list
    html += '<div class="section-title" style="margin-top:var(--space-md)">Ranking Lengkap</div>';
    html += '<div class="leaderboard-list">';

    leaderboard.forEach((player, i) => {
      html += `
        <div class="leaderboard-row" onclick="Stats.showPlayerDetail('${player.id}')" style="cursor:pointer">
          <div class="leaderboard-rank">${i + 1}</div>
          <div class="player-avatar" style="width:36px;height:36px;font-size:0.875rem">${player.avatar}</div>
          <div class="leaderboard-info">
            <div class="leaderboard-name">${escapeHtml(player.name)}</div>
            <div class="leaderboard-detail">${player.stats.wins}W ${player.stats.losses}L · ${player.stats.matches} match</div>
          </div>
          <div class="leaderboard-winrate">${player.winRate}%</div>
        </div>
      `;
    });

    html += '</div>';

    // Data actions
    html += `
      <div class="data-actions" style="margin-top: var(--space-xl)">
        <button class="btn btn-secondary btn-sm" onclick="Storage.exportData()">📥 Export Data</button>
        <button class="btn btn-secondary btn-sm" onclick="Stats.importDataPrompt()">📤 Import Data</button>
      </div>
      <input type="file" id="import-file-input" accept=".json" style="display:none" onchange="Stats.handleImport(event)">
    `;

    container.innerHTML = html;
  }

  function showPlayerDetail(playerId) {
    const stats = Storage.getPlayerStats(playerId);
    if (!stats) return;

    const streakText = stats.streak.count > 0
      ? `${stats.streak.type === 'W' ? '🔥' : '❄️'} ${stats.streak.count}${stats.streak.type}`
      : '-';

    const content = `
      <div style="text-align:center;margin-bottom:var(--space-lg)">
        <div class="player-avatar" style="width:64px;height:64px;font-size:1.75rem;margin:0 auto">${stats.avatar}</div>
        <h2 style="margin-top:var(--space-sm)">${escapeHtml(stats.name)}</h2>
      </div>

      <div class="stat-grid">
        <div class="stat-box">
          <div class="stat-value">${stats.totalMatches}</div>
          <div class="stat-label">Total Main</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${stats.winRate}%</div>
          <div class="stat-label">Win Rate</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:var(--accent-primary)">${stats.stats.wins}</div>
          <div class="stat-label">Menang</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:var(--accent-danger)">${stats.stats.losses}</div>
          <div class="stat-label">Kalah</div>
        </div>
      </div>

      <div style="margin-top:var(--space-lg)">
        <div class="leaderboard-row" style="cursor:default">
          <div style="flex:1">
            <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600">STREAK</div>
            <div style="font-weight:700">${streakText}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600">PARTNER TERBAIK</div>
            <div style="font-weight:700">${stats.bestPartner || '-'}</div>
          </div>
        </div>
      </div>
    `;

    App.showModal(`Detail Pemain`, content, [
      { text: 'Tutup', class: 'btn-secondary btn-block', action: () => App.hideModal() }
    ], true);
  }

  function importDataPrompt() {
    document.getElementById('import-file-input').click();
  }

  async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      await Storage.importData(file);
      render();
      Players.render();
      Match.render();
      App.updateHomeStats();
      App.showToast('Data berhasil diimport!', 'success');
    } catch (err) {
      App.showToast(err.message, 'error');
    }

    event.target.value = '';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    render,
    showPlayerDetail,
    importDataPrompt,
    handleImport
  };
})();
