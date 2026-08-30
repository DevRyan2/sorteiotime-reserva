// players.js — perfis, stats e conquistas

const RANKS = ['Bronze','Prata','Ouro','Platina','Diamante','Mestre','Grão-Mestre','Heroico','Desafiante'];

const ACHIEVEMENTS_DEF = [
  { id:'first_win',   icon:'🥇', name:'Primeira Vitória',   desc:'Venceu a primeira partida' },
  { id:'streak_3',    icon:'🔥', name:'Em Chamas',           desc:'3 vitórias seguidas' },
  { id:'streak_5',    icon:'💥', name:'Dominante',           desc:'5 vitórias seguidas' },
  { id:'streak_10',   icon:'⚡', name:'Imparável',           desc:'10 vitórias seguidas' },
  { id:'mvp_1',       icon:'⭐', name:'MVP',                 desc:'Eleito MVP em uma partida' },
  { id:'mvp_3',       icon:'🌟', name:'Super MVP',           desc:'Eleito MVP 3 vezes' },
  { id:'mvp_5',       icon:'👑', name:'Rei do MVP',          desc:'Eleito MVP 5 vezes' },
  { id:'games_10',    icon:'🎮', name:'Veterano',            desc:'10 partidas jogadas' },
  { id:'games_50',    icon:'🏆', name:'Lenda',               desc:'50 partidas jogadas' },
  { id:'winrate_70',  icon:'📊', name:'Consistente',         desc:'WR acima de 70% (min. 5 jogos)' },
  { id:'winrate_80',  icon:'🎯', name:'Preciso',             desc:'WR acima de 80% (min. 10 jogos)' },
];

const Players = (() => {

  const getAll  = () => Storage.getPlayers();
  const getList = () => Object.values(getAll()).sort((a,b) => (b.points||0) - (a.points||0));

  // Cria perfil sem rank manual — rank é calculado pelo sistema
  const register = (nick) => {
    if (Storage.getPlayer(nick)) return false;
    Storage.upsertPlayer(nick, { nick });
    DB.upsertPlayer(nick, Storage.getPlayer(nick)).catch(()=>{});
    return true;
  };

  // Cria perfil silenciosamente (chamado ao confirmar presença em sessão)
  const autoRegister = (nick) => {
    if (Storage.getPlayer(nick)) return false;
    Storage.upsertPlayer(nick, { nick });
    DB.upsertPlayer(nick, Storage.getPlayer(nick)).catch(()=>{});
    return true;
  };

  const getStats = (nick) => {
    const p = Storage.getPlayer(nick);
    if (!p) return null;
    const matches = p.matches || [];

    const wins    = matches.filter(m => m.won).length;
    const losses  = matches.filter(m => !m.won).length;
    const mvps    = matches.filter(m => m.mvp).length;
    const total   = matches.length;
    const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;

    // Sequência atual
    let streak = 0, streakType = null;
    for (let i = matches.length - 1; i >= 0; i--) {
      if (streakType === null) streakType = matches[i].won;
      if (matches[i].won === streakType) streak++;
      else break;
    }

    // Melhor dupla
    const allMatches = Storage.getMatches();
    const mates = {};
    allMatches.forEach(m => {
      if (!m.teams) return;
      m.teams.forEach((team, ti) => {
        if (!team.includes(nick)) return;
        const won = m.winner === ti;
        team.forEach(p => {
          if (p === nick) return;
          if (!mates[p]) mates[p] = { wins:0, games:0 };
          mates[p].games++;
          if (won) mates[p].wins++;
        });
      });
    });
    const bestMates = Object.entries(mates)
      .filter(([,v]) => v.games >= 2)
      .map(([name,v]) => ({ name, wr: Math.round((v.wins/v.games)*100), games: v.games }))
      .sort((a,b) => b.wr - a.wr).slice(0,3);

    // Winrate por mês
    const monthly = {};
    matches.forEach(m => {
      const d = new Date(m.date || m.matchDate || Date.now());
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!monthly[key]) monthly[key] = { wins:0, total:0, label: d.toLocaleString('pt-BR',{month:'short'}) };
      monthly[key].total++;
      if (m.won) monthly[key].wins++;
    });
    const monthlyChart = Object.entries(monthly)
      .sort(([a],[b]) => a.localeCompare(b)).slice(-6)
      .map(([,v]) => ({ label: v.label, wr: Math.round((v.wins/v.total)*100) }));

    return { wins, losses, mvps, winrate, streak, streakType, bestMates, monthlyChart, total };
  };

  // Stats filtrados por período (para a aba Rank)
  const getStatsInPeriod = (nick, since) => {
    const p = Storage.getPlayer(nick);
    if (!p) return null;
    const matches = (p.matches || []).filter(m => since === 0 || (m.date || m.matchDate || 0) >= since);
    const wins    = matches.filter(m => m.won).length;
    const mvps    = matches.filter(m => m.mvp).length;
    const total   = matches.length;
    const winrate = total > 0 ? Math.round(wins/total*100) : 0;
    const cfg     = Storage.getScoringConfig();
    const pts     = since === 0
      ? (p.points || 0)
      : wins * (cfg.pointsPerWin||10) + mvps * (cfg.pointsPerMvp||15);
    return { wins, mvps, total, winrate, pts };
  };

  const recordMatch = (nick, { won, mvp, matchDate, matchId }) => {
    const p = Storage.getPlayer(nick);
    if (!p) return;
    const entry = { won, mvp: !!mvp, date: matchDate || Date.now(), matchId };
    Storage.upsertPlayer(nick, { matches: [...(p.matches||[]), entry] });
    const achievements = checkAchievements(nick);
    // Sync para Firebase (fire & forget)
    DB.upsertPlayer(nick, Storage.getPlayer(nick)).catch(()=>{});
    return achievements;
  };

  const checkAchievements = (nick) => {
    const p = Storage.getPlayer(nick);
    if (!p) return [];
    const stats   = getStats(nick);
    const current = new Set(p.achievements || []);
    const newOnes = [];

    const check = (id, cond) => { if (cond && !current.has(id)) { current.add(id); newOnes.push(id); } };
    check('first_win',  stats.wins   >= 1);
    check('streak_3',   stats.streakType===true && stats.streak>=3);
    check('streak_5',   stats.streakType===true && stats.streak>=5);
    check('streak_10',  stats.streakType===true && stats.streak>=10);
    check('mvp_1',      stats.mvps   >= 1);
    check('mvp_3',      stats.mvps   >= 3);
    check('mvp_5',      stats.mvps   >= 5);
    check('games_10',   stats.total  >= 10);
    check('games_50',   stats.total  >= 50);
    check('winrate_70', stats.total  >= 5  && stats.winrate >= 70);
    check('winrate_80', stats.total  >= 10 && stats.winrate >= 80);

    if (newOnes.length > 0) {
      Storage.upsertPlayer(nick, { achievements: [...current] });
    }
    return newOnes;
  };

  // ── Render: mini SVG de linha para winrate ────────────────────────────────
  const renderWinrateChart = (monthlyChart) => {
    if (!monthlyChart || monthlyChart.length < 2) {
      return `<p style="color:var(--muted);font-size:12px;text-align:center;padding:20px 0">Dados insuficientes (mín. 2 meses)</p>`;
    }
    const W=260, H=80, pad=10;
    const pts = monthlyChart.map((d,i) => ({
      x: pad + (i/(monthlyChart.length-1)) * (W-pad*2),
      y: H - pad - (d.wr/100) * (H-pad*2),
      wr: d.wr, label: d.label,
    }));
    const poly = pts.map(p=>`${p.x},${p.y}`).join(' ');
    const area = `${pts[0].x},${H} ${poly} ${pts[pts.length-1].x},${H}`;
    const dots = pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--green)" stroke="var(--bg)" stroke-width="2"/><title>${p.label}: ${p.wr}%</title>`).join('');
    const labels = pts.map(p=>`<text x="${p.x}" y="${H}" font-size="9" fill="var(--muted)" text-anchor="middle">${p.label}</text>`).join('');
    const wrLabels = pts.map(p=>`<text x="${p.x}" y="${p.y-7}" font-size="9" fill="var(--accent)" text-anchor="middle">${p.wr}%</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H+14}" width="100%" style="overflow:visible">
      <defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#25D366" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#25D366" stop-opacity="0"/>
      </linearGradient></defs>
      <polygon points="${area}" fill="url(#chartGrad)"/>
      <polyline points="${poly}" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}${labels}${wrLabels}
    </svg>`;
  };

  // ── Render: card de perfil completo ──────────────────────────────────────
  const renderProfile = (nick) => {
    const p     = Storage.getPlayer(nick);
    const stats = getStats(nick);
    if (!p || !stats) return '';

    const achDefs = ACHIEVEMENTS_DEF.filter(a => (p.achievements||[]).includes(a.id));
    const achHTML = achDefs.length > 0
      ? achDefs.map(a=>`<div class="ach-badge" title="${a.desc}"><span class="ach-icon">${a.icon}</span><span class="ach-name">${a.name}</span></div>`).join('')
      : `<span style="color:var(--muted);font-size:12px">Nenhuma conquista ainda</span>`;

    const streakColor = stats.streakType===true ? 'var(--green)' : stats.streakType===false ? 'var(--red)' : 'var(--muted)';
    const streakLabel = stats.streak > 0
      ? `${stats.streakType?'🔥':'❄️'} ${stats.streak} ${stats.streakType?'vitórias':'derrotas'} seguidas` : '—';

    const matesHTML = stats.bestMates.length > 0
      ? stats.bestMates.map(m=>`<div class="mate-row"><span class="mate-name">${m.name}</span><span class="mate-wr" style="color:${m.wr>=60?'var(--green)':m.wr>=40?'var(--accent)':'var(--red)'}">${m.wr}% WR</span><span class="mate-games">${m.games}j</span></div>`).join('')
      : `<span style="color:var(--muted);font-size:12px">Dados insuficientes (mín. 2 partidas juntos)</span>`;

    const adminDeleteBtn = Storage.isAdmin()
      ? `<button class="btn btn-ghost btn-sm" onclick="UI.deletePlayer('${nick}')">🗑 Deletar</button>` : '';

    return `
      <div class="profile-header">
        <div class="profile-avatar">${nick.charAt(0).toUpperCase()}</div>
        <div class="profile-info">
          <div class="profile-nick">${nick}</div>
          <div class="profile-rank rank-tag">${p.rank || 'Bronze'}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${p.points||0} pontos</div>
        </div>
        <div style="margin-left:auto;display:flex;gap:8px;align-items:center">
          ${adminDeleteBtn}
          <button class="btn btn-ghost btn-sm" onclick="UI.showTab('jogadores')">← Voltar</button>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-val" style="color:var(--green)">${stats.wins}</div><div class="stat-lbl">Vitórias</div></div>
        <div class="stat-box"><div class="stat-val" style="color:var(--red)">${stats.losses}</div><div class="stat-lbl">Derrotas</div></div>
        <div class="stat-box"><div class="stat-val" style="color:var(--accent)">${stats.winrate}%</div><div class="stat-lbl">WR</div></div>
        <div class="stat-box"><div class="stat-val">${stats.mvps}</div><div class="stat-lbl">MVPs</div></div>
      </div>
      <div class="stat-streak" style="color:${streakColor}">${streakLabel}</div>
      <div class="section-title">📈 WinRate por mês</div>
      <div class="chart-wrap">${renderWinrateChart(stats.monthlyChart)}</div>
      <div class="section-title">🤝 Melhor dupla</div>
      <div class="mates-list">${matesHTML}</div>
      <div class="section-title">🏅 Conquistas</div>
      <div class="ach-list">${achHTML}</div>
    `;
  };

  return { getAll, getList, register, autoRegister, getStats, getStatsInPeriod, recordMatch, checkAchievements, renderProfile, renderWinrateChart };
})();