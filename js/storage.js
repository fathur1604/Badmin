/* ============================================
   BadmintonKu — Storage Layer
   localStorage wrapper with export/import
   ============================================ */

const Storage = (() => {
  const KEYS = {
    PLAYERS: 'badmintonku_players',
    MATCHES: 'badmintonku_matches',
    KAS: 'badmintonku_kas',
    PAIRING_HISTORY: 'badmintonku_pairings',
    VERSION: 'badmintonku_version'
  };

  const CURRENT_VERSION = 1;

  // ---- UUID Generator ----
  function generateId() {
    return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
      Math.floor(Math.random() * 16).toString(16)
    );
  }

  // ---- Generic get/set ----
  function get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error(`Storage.get error for key ${key}:`, e);
      return null;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Storage.set error for key ${key}:`, e);
    }
  }

  // ---- Players ----
  function getPlayers() {
    return get(KEYS.PLAYERS) || [];
  }

  function savePlayers(players) {
    set(KEYS.PLAYERS, players);
  }

  function addPlayer(name) {
    const players = getPlayers();
    const initials = name.trim().charAt(0).toUpperCase();
    const player = {
      id: generateId(),
      name: name.trim(),
      avatar: initials,
      isPresent: true,
      createdAt: new Date().toISOString(),
      stats: { wins: 0, losses: 0, matches: 0 }
    };
    players.push(player);
    savePlayers(players);
    return player;
  }

  function removePlayer(id) {
    const players = getPlayers().filter(p => p.id !== id);
    savePlayers(players);
    return players;
  }

  function togglePresence(id) {
    const players = getPlayers();
    const player = players.find(p => p.id === id);
    if (player) {
      player.isPresent = !player.isPresent;
      savePlayers(players);
    }
    return players;
  }

  function getPresentPlayers() {
    return getPlayers().filter(p => p.isPresent);
  }

  function getPlayerById(id) {
    return getPlayers().find(p => p.id === id) || null;
  }

  function getPlayerNames(ids) {
    const players = getPlayers();
    return ids.map(id => {
      const p = players.find(pl => pl.id === id);
      return p ? p.name : 'Unknown';
    });
  }

  // ---- Matches ----
  function getMatches() {
    return get(KEYS.MATCHES) || [];
  }

  function saveMatches(matches) {
    set(KEYS.MATCHES, matches);
  }

  function addMatch(matchData) {
    const matches = getMatches();
    const match = {
      id: generateId(),
      ...matchData,
      date: new Date().toISOString(),
      status: 'ongoing'
    };
    matches.unshift(match); // newest first
    saveMatches(matches);
    return match;
  }

  function updateMatch(id, updates) {
    const matches = getMatches();
    const index = matches.findIndex(m => m.id === id);
    if (index !== -1) {
      matches[index] = { ...matches[index], ...updates };
      saveMatches(matches);
    }
    return matches;
  }

  function completeMatch(id, winner) {
    const matches = getMatches();
    const match = matches.find(m => m.id === id);
    if (!match) return;

    match.status = 'completed';
    match.winner = winner;
    saveMatches(matches);

    // Update player stats
    const players = getPlayers();
    const winnerIds = winner === 'team1' ? match.team1 : match.team2;
    const loserIds = winner === 'team1' ? match.team2 : match.team1;

    winnerIds.forEach(pid => {
      const p = players.find(pl => pl.id === pid);
      if (p) {
        p.stats.wins++;
        p.stats.matches++;
      }
    });

    loserIds.forEach(pid => {
      const p = players.find(pl => pl.id === pid);
      if (p) {
        p.stats.losses++;
        p.stats.matches++;
      }
    });

    savePlayers(players);
    return match;
  }

  function deleteMatch(id) {
    const matches = getMatches();
    const match = matches.find(m => m.id === id);
    if (!match) return;

    // Revert stats if match was completed
    if (match.status === 'completed' && match.winner) {
      const players = getPlayers();
      const winnerIds = match.winner === 'team1' ? match.team1 : match.team2;
      const loserIds = match.winner === 'team1' ? match.team2 : match.team1;

      winnerIds.forEach(pid => {
        const p = players.find(pl => pl.id === pid);
        if (p) {
          p.stats.wins = Math.max(0, p.stats.wins - 1);
          p.stats.matches = Math.max(0, p.stats.matches - 1);
        }
      });

      loserIds.forEach(pid => {
        const p = players.find(pl => pl.id === pid);
        if (p) {
          p.stats.losses = Math.max(0, p.stats.losses - 1);
          p.stats.matches = Math.max(0, p.stats.matches - 1);
        }
      });

      savePlayers(players);
    }

    const filtered = matches.filter(m => m.id !== id);
    saveMatches(filtered);
    return filtered;
  }

  function getOngoingMatch() {
    return getMatches().find(m => m.status === 'ongoing') || null;
  }

  // ---- Stats ----
  function getLeaderboard() {
    const players = getPlayers();
    return players
      .filter(p => p.stats.matches > 0)
      .map(p => ({
        ...p,
        winRate: p.stats.matches > 0
          ? Math.round((p.stats.wins / p.stats.matches) * 100)
          : 0
      }))
      .sort((a, b) => {
        // Sort by win rate, then by total wins
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.stats.wins - a.stats.wins;
      });
  }

  function getPlayerStats(playerId) {
    const player = getPlayerById(playerId);
    if (!player) return null;

    const matches = getMatches().filter(m =>
      m.status === 'completed' &&
      (m.team1.includes(playerId) || m.team2.includes(playerId))
    );

    const winRate = player.stats.matches > 0
      ? Math.round((player.stats.wins / player.stats.matches) * 100)
      : 0;

    // Calculate current streak
    let streak = { type: null, count: 0 };
    for (const match of matches) {
      const isTeam1 = match.team1.includes(playerId);
      const won = (isTeam1 && match.winner === 'team1') || (!isTeam1 && match.winner === 'team2');

      if (streak.type === null) {
        streak.type = won ? 'W' : 'L';
        streak.count = 1;
      } else if ((won && streak.type === 'W') || (!won && streak.type === 'L')) {
        streak.count++;
      } else {
        break;
      }
    }

    // Find best partner (doubles)
    const partnerCounts = {};
    matches
      .filter(m => m.type === 'double')
      .forEach(m => {
        const team = m.team1.includes(playerId) ? m.team1 : m.team2;
        const partner = team.find(id => id !== playerId);
        if (partner) {
          if (!partnerCounts[partner]) {
            partnerCounts[partner] = { wins: 0, total: 0 };
          }
          partnerCounts[partner].total++;
          const isTeam1 = m.team1.includes(playerId);
          if ((isTeam1 && m.winner === 'team1') || (!isTeam1 && m.winner === 'team2')) {
            partnerCounts[partner].wins++;
          }
        }
      });

    let bestPartner = null;
    let bestPartnerWins = 0;
    Object.entries(partnerCounts).forEach(([pid, data]) => {
      if (data.wins > bestPartnerWins) {
        bestPartnerWins = data.wins;
        const p = getPlayerById(pid);
        bestPartner = p ? p.name : null;
      }
    });

    return {
      ...player,
      winRate,
      streak,
      bestPartner,
      totalMatches: player.stats.matches,
      recentMatches: matches.slice(0, 5)
    };
  }

  // ---- Kas / Treasury ----
  function getKasSessions() {
    return get(KEYS.KAS) || [];
  }

  function saveKasSessions(sessions) {
    set(KEYS.KAS, sessions);
  }

  function addKasSession(sessionData) {
    const sessions = getKasSessions();
    const session = {
      id: generateId(),
      date: new Date().toISOString(),
      costPerPerson: sessionData.costPerPerson || 0,
      totalCost: sessionData.totalCost || 0,
      note: sessionData.note || '',
      participants: sessionData.participants || [], // [{playerId, paid: bool}]
    };
    sessions.unshift(session);
    saveKasSessions(sessions);
    return session;
  }

  function updateKasSession(id, updates) {
    const sessions = getKasSessions();
    const idx = sessions.findIndex(s => s.id === id);
    if (idx !== -1) {
      sessions[idx] = { ...sessions[idx], ...updates };
      saveKasSessions(sessions);
    }
    return sessions;
  }

  function deleteKasSession(id) {
    const sessions = getKasSessions().filter(s => s.id !== id);
    saveKasSessions(sessions);
    return sessions;
  }

  function toggleKasPayment(sessionId, playerId) {
    const sessions = getKasSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      const participant = session.participants.find(p => p.playerId === playerId);
      if (participant) {
        participant.paid = !participant.paid;
        saveKasSessions(sessions);
      }
    }
    return sessions;
  }

  function getKasSummary() {
    const sessions = getKasSessions();
    const players = getPlayers();
    const summary = {};

    players.forEach(p => {
      summary[p.id] = { name: p.name, avatar: p.avatar, totalOwed: 0, totalPaid: 0 };
    });

    sessions.forEach(session => {
      session.participants.forEach(part => {
        if (summary[part.playerId]) {
          summary[part.playerId].totalOwed += session.costPerPerson;
          if (part.paid) {
            summary[part.playerId].totalPaid += session.costPerPerson;
          }
        }
      });
    });

    return Object.entries(summary)
      .map(([id, data]) => ({
        playerId: id,
        ...data,
        balance: data.totalPaid - data.totalOwed
      }))
      .filter(d => d.totalOwed > 0)
      .sort((a, b) => a.balance - b.balance);
  }

  // ---- Pairing History (for Fair Randomizer) ----
  function getPairingHistory() {
    return get(KEYS.PAIRING_HISTORY) || [];
  }

  function savePairingHistory(history) {
    set(KEYS.PAIRING_HISTORY, history);
  }

  function addPairing(pairingData) {
    const history = getPairingHistory();
    history.unshift({
      ...pairingData,
      date: new Date().toISOString()
    });
    // Keep only last 50 pairings
    if (history.length > 50) history.length = 50;
    savePairingHistory(history);
  }

  // ---- Export / Import ----
  function exportData() {
    const data = {
      version: CURRENT_VERSION,
      exportDate: new Date().toISOString(),
      players: getPlayers(),
      matches: getMatches(),
      kas: getKasSessions(),
      pairingHistory: getPairingHistory()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `badmintonku_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.players && data.matches) {
            savePlayers(data.players);
            saveMatches(data.matches);
            if (data.kas) saveKasSessions(data.kas);
            if (data.pairingHistory) savePairingHistory(data.pairingHistory);
            resolve(true);
          } else {
            reject(new Error('Format data tidak valid'));
          }
        } catch (err) {
          reject(new Error('File tidak valid'));
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.readAsText(file);
    });
  }

  // ---- Initialize ----
  function init() {
    const version = get(KEYS.VERSION);
    if (!version) {
      set(KEYS.VERSION, CURRENT_VERSION);
    }
  }

  init();

  return {
    generateId,
    getPlayers,
    savePlayers,
    addPlayer,
    removePlayer,
    togglePresence,
    getPresentPlayers,
    getPlayerById,
    getPlayerNames,
    getMatches,
    saveMatches,
    addMatch,
    updateMatch,
    completeMatch,
    deleteMatch,
    getOngoingMatch,
    getLeaderboard,
    getPlayerStats,
    getKasSessions,
    addKasSession,
    updateKasSession,
    deleteKasSession,
    toggleKasPayment,
    getKasSummary,
    getPairingHistory,
    addPairing,
    exportData,
    importData
  };
})();
