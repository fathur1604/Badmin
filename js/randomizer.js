/* ============================================
   BadmintonKu — Randomizer
   Fair shuffle with pairing history avoidance
   ============================================ */

const Randomizer = (() => {
  let currentMode = 'double';
  let fairMode = true;
  let lastResult = null;

  // Fisher-Yates shuffle
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Make a pairing key (sorted IDs) so A-B == B-A
  function pairingKey(ids) {
    return [...ids].sort().join('|');
  }

  // Score a set of matches based on how recently the pairings occurred
  function scoreShuffle(matches, history, mode) {
    let score = 0;
    const recentKeys = {};

    // Weight recent pairings more heavily (index 0 = most recent)
    history.forEach((entry, i) => {
      const recency = Math.max(1, 10 - i); // 10 for most recent, down to 1
      if (entry.partners) {
        recentKeys[pairingKey(entry.partners)] = (recentKeys[pairingKey(entry.partners)] || 0) + recency;
      }
      if (entry.opponents) {
        recentKeys[pairingKey(entry.opponents)] = (recentKeys[pairingKey(entry.opponents)] || 0) + recency;
      }
    });

    matches.forEach(m => {
      if (mode === 'double') {
        // Penalize if teammates were recently paired together
        const partnerKey1 = pairingKey(m.team1);
        const partnerKey2 = pairingKey(m.team2);
        score += recentKeys[partnerKey1] || 0;
        score += recentKeys[partnerKey2] || 0;
      }
      // Penalize if opponents were recently matched against each other
      const allOpponentPairs = [];
      m.team1.forEach(t1 => {
        m.team2.forEach(t2 => {
          allOpponentPairs.push(pairingKey([t1, t2]));
        });
      });
      allOpponentPairs.forEach(key => {
        score += recentKeys[key] || 0;
      });
    });

    return score;
  }

  // Fair shuffle: try N random shuffles, pick the one with lowest overlap score
  function fairShuffle(players, mode) {
    const history = Storage.getPairingHistory();

    if (history.length === 0) {
      // No history, just do a normal shuffle
      return shuffle(players);
    }

    let bestShuffle = null;
    let bestScore = Infinity;
    const attempts = 20; // Try 20 random shuffles

    for (let attempt = 0; attempt < attempts; attempt++) {
      const candidate = shuffle(players);

      // Build match pairings from this shuffle
      const matches = [];
      if (mode === 'single') {
        matches.push({
          team1: [candidate[0].id],
          team2: [candidate[1].id]
        });
      } else {
        const matchCount = Math.floor(candidate.length / 4);
        for (let i = 0; i < matchCount; i++) {
          const base = i * 4;
          matches.push({
            team1: [candidate[base].id, candidate[base + 1].id],
            team2: [candidate[base + 2].id, candidate[base + 3].id]
          });
        }
      }

      const score = scoreShuffle(matches, history, mode);

      if (score < bestScore) {
        bestScore = score;
        bestShuffle = candidate;
      }

      if (score === 0) break; // Perfect — no overlap at all
    }

    return bestShuffle;
  }

  // Record pairings for future avoidance
  function recordPairings(team1Ids, team2Ids, mode) {
    if (mode === 'double') {
      // Record partner pairings
      Storage.addPairing({ partners: team1Ids, type: 'partner' });
      Storage.addPairing({ partners: team2Ids, type: 'partner' });
    }
    // Record opponent pairings
    team1Ids.forEach(t1 => {
      team2Ids.forEach(t2 => {
        Storage.addPairing({ opponents: [t1, t2], type: 'opponent' });
      });
    });
  }

  function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    clearResult();
    updateMinPlayers();
  }

  function toggleFairMode() {
    fairMode = !fairMode;
    const btn = document.getElementById('fair-toggle');
    if (btn) {
      btn.classList.toggle('active', fairMode);
      btn.innerHTML = fairMode ? '🔄 Fair Mode: ON' : '🔄 Fair Mode: OFF';
    }
    App.showToast(fairMode ? 'Fair Mode aktif — hindari pasangan berulang' : 'Fair Mode nonaktif — acak murni', 'info');
  }

  function updateMinPlayers() {
    const present = Storage.getPresentPlayers();
    const infoEl = document.getElementById('randomizer-info');
    const shuffleBtn = document.getElementById('shuffle-btn');

    const minRequired = currentMode === 'single' ? 2 : 4;
    const hasEnough = present.length >= minRequired;

    if (infoEl) {
      if (present.length === 0) {
        infoEl.innerHTML = `<span style="color: var(--accent-danger)">⚠️ Belum ada pemain yang hadir. Tambahkan di tab Beranda.</span>`;
      } else if (!hasEnough) {
        infoEl.innerHTML = `<span style="color: var(--accent-warning)">⚠️ Minimal ${minRequired} pemain hadir untuk mode ${currentMode === 'single' ? 'single' : 'double'}. Saat ini: ${present.length} pemain.</span>`;
      } else {
        const fairLabel = fairMode ? ' · <span style="color:var(--accent-secondary)">🔄 Fair</span>' : '';
        infoEl.innerHTML = `<span style="color: var(--accent-primary)">✅ ${present.length} pemain siap${fairLabel}. Tekan tombol acak!</span>`;
      }
    }

    if (shuffleBtn) {
      shuffleBtn.disabled = !hasEnough;
    }
  }

  function doShuffle() {
    const present = Storage.getPresentPlayers();
    const minRequired = currentMode === 'single' ? 2 : 4;

    if (present.length < minRequired) {
      App.showToast(`Minimal ${minRequired} pemain hadir!`, 'error');
      return;
    }

    // Use fair or normal shuffle
    const shuffled = fairMode ? fairShuffle(present, currentMode) : shuffle(present);
    const resultContainer = document.getElementById('randomizer-result');

    if (currentMode === 'single') {
      // Pick 2 random players
      const p1 = shuffled[0];
      const p2 = shuffled[1];
      lastResult = {
        type: 'single',
        team1: [p1.id],
        team2: [p2.id]
      };

      resultContainer.innerHTML = `
        <div class="vs-container shuffle-anim">
          <div class="team-card team-1">
            <div class="team-label">Pemain 1</div>
            <div class="team-players">
              <div class="player-avatar" style="width:56px;height:56px;font-size:1.5rem;margin:0 auto">${p1.avatar}</div>
              <div class="team-player-name">${escapeHtml(p1.name)}</div>
            </div>
          </div>
          <div class="vs-badge">VS</div>
          <div class="team-card team-2">
            <div class="team-label">Pemain 2</div>
            <div class="team-players">
              <div class="player-avatar" style="width:56px;height:56px;font-size:1.5rem;margin:0 auto;background:var(--accent-secondary)">${p2.avatar}</div>
              <div class="team-player-name">${escapeHtml(p2.name)}</div>
            </div>
          </div>
        </div>
        <div style="display:flex; gap:var(--space-sm); margin-top:var(--space-lg)">
          <button class="btn btn-secondary btn-block" onclick="Randomizer.doShuffle()">🔄 Acak Ulang</button>
          <button class="btn btn-primary btn-block" onclick="Randomizer.startMatch()">🏸 Mulai Main</button>
        </div>
      `;
    } else {
      // Double mode
      if (present.length >= 4) {
        const matchCount = Math.floor(shuffled.length / 4);
        const matches = [];

        for (let i = 0; i < matchCount; i++) {
          const base = i * 4;
          matches.push({
            team1: [shuffled[base], shuffled[base + 1]],
            team2: [shuffled[base + 2], shuffled[base + 3]]
          });
        }

        const remaining = shuffled.slice(matchCount * 4);

        lastResult = {
          type: 'double',
          matches: matches.map(m => ({
            team1: m.team1.map(p => p.id),
            team2: m.team2.map(p => p.id)
          }))
        };

        let html = '<div class="multi-match-list">';

        matches.forEach((match, idx) => {
          html += `
            <div class="multi-match-item">
              ${matchCount > 1 ? `<div class="section-title" style="margin-bottom:var(--space-sm)">Pertandingan ${idx + 1}</div>` : ''}
              <div class="vs-container">
                <div class="team-card team-1">
                  <div class="team-label">Tim A</div>
                  <div class="team-players">
                    <div class="player-avatar" style="width:44px;height:44px;font-size:1.125rem;margin:0 auto">${match.team1[0].avatar}</div>
                    <div class="team-player-name">${escapeHtml(match.team1[0].name)}</div>
                    <div class="player-avatar" style="width:44px;height:44px;font-size:1.125rem;margin:0 auto;margin-top:4px">${match.team1[1].avatar}</div>
                    <div class="team-player-name">${escapeHtml(match.team1[1].name)}</div>
                  </div>
                </div>
                <div class="vs-badge">VS</div>
                <div class="team-card team-2">
                  <div class="team-label">Tim B</div>
                  <div class="team-players">
                    <div class="player-avatar" style="width:44px;height:44px;font-size:1.125rem;margin:0 auto;background:var(--accent-secondary)">${match.team2[0].avatar}</div>
                    <div class="team-player-name">${escapeHtml(match.team2[0].name)}</div>
                    <div class="player-avatar" style="width:44px;height:44px;font-size:1.125rem;margin:0 auto;background:var(--accent-secondary);margin-top:4px">${match.team2[1].avatar}</div>
                    <div class="team-player-name">${escapeHtml(match.team2[1].name)}</div>
                  </div>
                </div>
              </div>
            </div>
          `;
        });

        if (remaining.length > 0) {
          html += `
            <div class="card card-sm" style="text-align:center;margin-top:var(--space-sm)">
              <div style="font-size:0.8125rem;color:var(--text-muted)">
                ⏳ Menunggu giliran: <strong style="color:var(--text-primary)">${remaining.map(p => escapeHtml(p.name)).join(', ')}</strong>
              </div>
            </div>
          `;
        }

        html += '</div>';
        html += `
          <div style="display:flex; gap:var(--space-sm); margin-top:var(--space-lg)">
            <button class="btn btn-secondary btn-block" onclick="Randomizer.doShuffle()">🔄 Acak Ulang</button>
            <button class="btn btn-primary btn-block" onclick="Randomizer.startMatch(0)">🏸 Mulai Main</button>
          </div>
        `;

        resultContainer.innerHTML = html;
      }
    }
  }

  function startMatch(matchIndex = 0) {
    if (!lastResult) return;

    let team1, team2, type;

    if (lastResult.type === 'single') {
      team1 = lastResult.team1;
      team2 = lastResult.team2;
      type = 'single';
    } else {
      const m = lastResult.matches[matchIndex];
      if (!m) return;
      team1 = m.team1;
      team2 = m.team2;
      type = 'double';
    }

    // Record pairings for fair mode
    if (fairMode) {
      recordPairings(team1, team2, type);
    }

    // Create a new match
    const match = Storage.addMatch({
      type,
      team1,
      team2,
      scores: [{ team1: 0, team2: 0 }]
    });

    // Switch to match tab
    App.navigate('match');
    Match.loadOngoingMatch();
    App.showToast('Pertandingan dimulai! 🏸', 'success');
  }

  function clearResult() {
    const container = document.getElementById('randomizer-result');
    if (container) container.innerHTML = '';
    lastResult = null;
  }

  function render() {
    updateMinPlayers();
    clearResult();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    setMode,
    toggleFairMode,
    doShuffle,
    startMatch,
    render,
    clearResult
  };
})();
