/* ============================================
   BadmintonKu — Match Scoring
   Scoreboard, set management, history
   ============================================ */

const Match = (() => {
  let currentMatchId = null;
  let currentSet = 0;

  function loadOngoingMatch() {
    const match = Storage.getOngoingMatch();
    if (match) {
      currentMatchId = match.id;
      currentSet = match.scores.length - 1;
      renderScoreboard(match);
    } else {
      currentMatchId = null;
      renderNoMatch();
    }
  }

  function renderNoMatch() {
    const container = document.getElementById('match-scoreboard-area');
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏸</div>
        <div class="empty-state-title">Belum ada pertandingan aktif</div>
        <div class="empty-state-desc">Gunakan Randomizer untuk mengacak tim dan mulai pertandingan baru.</div>
      </div>
    `;
  }

  function renderScoreboard(match) {
    const container = document.getElementById('match-scoreboard-area');
    const team1Names = Storage.getPlayerNames(match.team1);
    const team2Names = Storage.getPlayerNames(match.team2);
    const currentScores = match.scores[currentSet] || { team1: 0, team2: 0 };

    // Count sets won
    let setsWon1 = 0, setsWon2 = 0;
    match.scores.forEach((s, i) => {
      if (i < match.scores.length - 1 || isSetComplete(s)) {
        if (s.team1 > s.team2) setsWon1++;
        else if (s.team2 > s.team1) setsWon2++;
      }
    });

    container.innerHTML = `
      <div class="scoreboard">
        <!-- Set Tabs -->
        <div class="set-tabs">
          ${match.scores.map((s, i) => {
            const isComplete = i < match.scores.length - 1 || (isSetComplete(s) && i < 2);
            const isActive = i === currentSet;
            return `<button class="set-tab ${isActive ? 'active' : ''} ${isComplete ? 'completed' : ''}"
                            onclick="Match.switchSet(${i})">
                      Set ${i + 1}
                    </button>`;
          }).join('')}
        </div>

        <!-- Teams & Scores -->
        <div class="scoreboard-teams">
          <div class="scoreboard-team team-1">
            <div class="scoreboard-team-name">${escapeHtml(team1Names.join(' & '))}</div>
            <div class="scoreboard-score" id="score-team1">${currentScores.team1}</div>
          </div>

          <div class="scoreboard-divider">
            <div style="font-size:1.25rem;font-weight:800">:</div>
            <div>Set ${currentSet + 1}</div>
            <div class="badge badge-accent">${setsWon1} - ${setsWon2}</div>
          </div>

          <div class="scoreboard-team team-2">
            <div class="scoreboard-team-name">${escapeHtml(team2Names.join(' & '))}</div>
            <div class="scoreboard-score" id="score-team2">${currentScores.team2}</div>
          </div>
        </div>

        <!-- Score Controls -->
        <div class="scoreboard-controls">
          <div class="score-btn-group">
            <button class="score-btn minus" onclick="Match.updateScore('team1', -1)">−</button>
            <button class="score-btn plus" onclick="Match.updateScore('team1', 1)">+</button>
          </div>
          <div class="score-btn-group">
            <button class="score-btn minus" onclick="Match.updateScore('team2', -1)">−</button>
            <button class="score-btn plus" onclick="Match.updateScore('team2', 1)">+</button>
          </div>
        </div>
      </div>

      <!-- Match Actions -->
      <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-md)">
        <button class="btn btn-danger btn-block btn-sm" onclick="Match.cancelMatch()">❌ Batalkan</button>
        <button class="btn btn-primary btn-block btn-sm" onclick="Match.finishSet()">✅ Set Selesai</button>
      </div>
    `;
  }

  function updateScore(team, delta) {
    if (!currentMatchId) return;
    const matches = Storage.getMatches();
    const match = matches.find(m => m.id === currentMatchId);
    if (!match || match.status !== 'ongoing') return;

    const score = match.scores[currentSet];
    score[team] = Math.max(0, score[team] + delta);
    Storage.saveMatches(matches);

    // Animate score change
    const el = document.getElementById(`score-${team}`);
    if (el) {
      el.textContent = score[team];
      el.classList.add('score-animate');
      setTimeout(() => el.classList.remove('score-animate'), 300);
    }

    // Update set badge
    renderScoreboard(match);
  }

  function switchSet(index) {
    currentSet = index;
    const match = Storage.getMatches().find(m => m.id === currentMatchId);
    if (match) renderScoreboard(match);
  }

  function isSetComplete(score) {
    const s1 = score.team1;
    const s2 = score.team2;
    // Standard badminton: first to 21, win by 2, cap at 30
    if (s1 >= 21 || s2 >= 21) {
      if (Math.abs(s1 - s2) >= 2) return true;
      if (s1 >= 30 || s2 >= 30) return true;
    }
    return false;
  }

  function finishSet() {
    if (!currentMatchId) return;
    const matches = Storage.getMatches();
    const match = matches.find(m => m.id === currentMatchId);
    if (!match) return;

    const currentScore = match.scores[currentSet];

    // Check if scores are valid
    if (currentScore.team1 === 0 && currentScore.team2 === 0) {
      App.showToast('Skor masih 0-0', 'error');
      return;
    }

    if (currentScore.team1 === currentScore.team2) {
      App.showToast('Skor tidak boleh seri', 'error');
      return;
    }

    // Count sets won including this one
    let setsWon1 = 0, setsWon2 = 0;
    match.scores.forEach(s => {
      if (s.team1 > s.team2) setsWon1++;
      else if (s.team2 > s.team1) setsWon2++;
    });

    // Check if match is over (best of 3)
    if (setsWon1 >= 2 || setsWon2 >= 2) {
      // Match complete!
      const winner = setsWon1 >= 2 ? 'team1' : 'team2';
      Storage.completeMatch(currentMatchId, winner);

      const winnerNames = Storage.getPlayerNames(winner === 'team1' ? match.team1 : match.team2);
      showWinnerOverlay(winnerNames.join(' & '));

      setTimeout(() => {
        currentMatchId = null;
        loadOngoingMatch();
        renderHistory();
        App.updateHomeStats();
        Stats.render();
      }, 2500);
    } else {
      // Start next set
      match.scores.push({ team1: 0, team2: 0 });
      currentSet = match.scores.length - 1;
      Storage.saveMatches(matches);
      renderScoreboard(match);
      App.showToast(`Set ${currentSet + 1} dimulai!`, 'success');
    }
  }

  function cancelMatch() {
    if (!currentMatchId) return;

    App.showModal(
      'Batalkan Pertandingan',
      'Yakin ingin membatalkan pertandingan ini? Skor tidak akan disimpan.',
      [
        { text: 'Kembali', class: 'btn-secondary', action: () => App.hideModal() },
        {
          text: 'Batalkan',
          class: 'btn-danger',
          action: () => {
            Storage.deleteMatch(currentMatchId);
            currentMatchId = null;
            loadOngoingMatch();
            App.hideModal();
            App.showToast('Pertandingan dibatalkan', 'info');
          }
        }
      ]
    );
  }

  function showWinnerOverlay(winnerName) {
    const overlay = document.getElementById('winner-overlay');
    document.getElementById('winner-name-display').textContent = winnerName;
    overlay.classList.add('active');

    setTimeout(() => {
      overlay.classList.remove('active');
    }, 2500);
  }

  // ---- Match History ----
  function renderHistory() {
    const container = document.getElementById('match-history');
    const matches = Storage.getMatches().filter(m => m.status === 'completed');

    if (matches.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: var(--space-lg)">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">Belum ada riwayat</div>
          <div class="empty-state-desc">Selesaikan pertandingan untuk melihat riwayat di sini.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = matches.map(match => {
      const team1Names = Storage.getPlayerNames(match.team1);
      const team2Names = Storage.getPlayerNames(match.team2);
      const isTeam1Winner = match.winner === 'team1';
      const dateStr = formatDate(match.date);

      return `
        <div class="match-card">
          <div class="match-card-header">
            <span class="match-date">${dateStr}</span>
            <div style="display:flex;gap:var(--space-xs);align-items:center">
              <span class="badge ${match.type === 'single' ? 'badge-accent' : 'badge-purple'} match-type-badge">
                ${match.type === 'single' ? '1v1' : '2v2'}
              </span>
              <button class="btn btn-ghost" style="padding:4px 6px;font-size:0.75rem;color:var(--text-muted)"
                      onclick="Match.deleteFromHistory('${match.id}')">🗑️</button>
            </div>
          </div>
          <div class="match-teams-row">
            <div class="match-team ${isTeam1Winner ? 'winner' : 'loser'}">
              <div class="match-team-name">${isTeam1Winner ? '🏆 ' : ''}${escapeHtml(team1Names.join(' & '))}</div>
            </div>
            <div class="match-scores">
              ${match.scores.map(s => {
                const w1 = s.team1 > s.team2;
                return `<div class="match-set-score">
                  <span class="${w1 ? 'winner-score' : ''}">${s.team1}</span> - <span class="${!w1 ? 'winner-score' : ''}">${s.team2}</span>
                </div>`;
              }).join('')}
            </div>
            <div class="match-team ${!isTeam1Winner ? 'winner' : 'loser'}" style="text-align:right">
              <div class="match-team-name">${!isTeam1Winner ? '🏆 ' : ''}${escapeHtml(team2Names.join(' & '))}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function deleteFromHistory(id) {
    App.showModal(
      'Hapus Pertandingan',
      'Yakin ingin menghapus pertandingan ini dari riwayat? Statistik pemain akan diperbarui.',
      [
        { text: 'Batal', class: 'btn-secondary', action: () => App.hideModal() },
        {
          text: 'Hapus',
          class: 'btn-danger',
          action: () => {
            Storage.deleteMatch(id);
            renderHistory();
            App.updateHomeStats();
            Stats.render();
            App.hideModal();
            App.showToast('Pertandingan dihapus', 'info');
          }
        }
      ]
    );
  }

  function formatDate(isoString) {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;

    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }

  function render() {
    loadOngoingMatch();
    renderHistory();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    render,
    loadOngoingMatch,
    updateScore,
    switchSet,
    finishSet,
    cancelMatch,
    renderHistory,
    deleteFromHistory
  };
})();
