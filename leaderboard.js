// DOMINATION - LEADERBOARD
// Reads the same localStorage key used by game.js and keeps old scores compatible.

function getScores() {
  const current = JSON.parse(localStorage.getItem('dominationLeaderboard') || '[]');
  const legacy = JSON.parse(localStorage.getItem('dominationLeaderboards') || '{}');
  const legacyScores = [
    ...(Array.isArray(legacy.alltime) ? legacy.alltime : []),
    ...(Array.isArray(legacy.weekly) ? legacy.weekly : []),
    ...(Array.isArray(legacy.daily) ? legacy.daily : [])
  ];

  const combined = [...current, ...legacyScores];
  const seen = new Set();
  return combined.filter(entry => {
    if (!entry || typeof entry.player !== 'string' || entry.player.trim() === '') return false;
    const key = `${entry.player}|${entry.score}|${entry.date || entry.timestamp || ''}|${entry.mode || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function loadLeaderboard(period) {
  const now = Date.now();
  const cutoff = period === 'daily' ? now - 86400000 : period === 'weekly' ? now - 604800000 : 0;
  return getScores()
    .filter(entry => {
      if (!cutoff) return true;
      const timestamp = entry.date ? Date.parse(entry.date) : Number(entry.timestamp || 0);
      return timestamp >= cutoff;
    })
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 10);
}

function displayLeaderboard(period) {
  const data = loadLeaderboard(period);
  const tableBody = document.getElementById('leaderboardBody');
  const noScoresMessage = document.getElementById('noScoresMessage');
  if (!tableBody || !noScoresMessage) return;

  tableBody.innerHTML = '';
  if (!data.length) {
    tableBody.style.display = 'none';
    noScoresMessage.style.display = 'block';
    return;
  }

  tableBody.style.display = 'block';
  noScoresMessage.style.display = 'none';

  data.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'table-row';
    const rankClass = index < 3 ? `rank-${index + 1}` : '';
    const dateValue = entry.date ? new Date(entry.date) : new Date(Number(entry.timestamp || Date.now()));
    const formattedDate = Number.isNaN(dateValue.getTime()) ? 'Unknown' : dateValue.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const mode = entry.mode === 'bots' ? 'Bots Battle' : entry.mode === '1v1' ? '1v1 Duel' : 'Domination';

    row.innerHTML = `
      <div class="rank-col ${rankClass}">${index + 1}</div>
      <div class="player-col ${rankClass}">${escapeHtml(entry.player)}</div>
      <div class="score-col">${Number(entry.score || 0).toLocaleString()}</div>
      <div class="mode-col">${mode}</div>
      <div class="date-col">${formattedDate}</div>
    `;
    tableBody.appendChild(row);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
}

function changeTab(period) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.period === period));
  displayLeaderboard(period);
}

function goToMenu() { window.location.href = 'index.html'; }

window.addEventListener('load', () => displayLeaderboard('alltime'));
