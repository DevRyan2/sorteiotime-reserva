// sorteio.js — lógica de sorteio de times

const Sorteio = (() => {
  let players = [];
  let teams   = [];
  let currentStep = 1;

  const getPlayers = () => players;
  const getTeams   = () => teams;

  // ── Pool de jogadores ──────────────────────────────────────────────────────
  const addPlayer = (name) => {
    name = name.trim();
    if (!name || name.length > 60) return { ok: false, reason: 'invalid' };
    if (players.includes(name)) return { ok: false, reason: 'dup' };
    players.push(name);
    return { ok: true };
  };

  const removePlayer = (idx) => { players.splice(idx, 1); };

  const setPlayers = (arr) => { players = arr; };

  const parseText = (text) => {
    const lines = text.split('\n')
      .map(l => l.replace(/^[\d.\-*•→☑✓]+\s*/, '').trim())
      .filter(l => l.length > 1 && l.length < 60);
    let added = 0;
    lines.forEach(n => { if (n && !players.includes(n)) { players.push(n); added++; } });
    return added;
  };

  const clearPlayers = () => { players = []; };

  // ── Sorteio ────────────────────────────────────────────────────────────────
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const draw = (numTeams, mode) => {
    const n = Math.max(2, Math.min(numTeams, players.length - 1));
    const s = shuffle(players);
    teams = Array.from({ length: n }, () => []);

    if (mode === 'snake') {
      let dir = 1, cur = 0;
      s.forEach(p => {
        teams[cur].push(p);
        const next = cur + dir;
        if (next >= n) { dir = -1; cur = n - 2; }
        else if (next < 0) { dir = 1; cur = 1; }
        else cur = next;
      });
    } else {
      s.forEach((p, i) => teams[i % n].push(p));
    }

    return teams;
  };

  // ── Formatação de mensagem WhatsApp ───────────────────────────────────────
  const buildMessage = (eventName) => {
    const date   = new Date().toLocaleDateString('pt-BR');
    const slotEmojis = ['🟢','🔴','🔵','🟡','🟣','🟠','⚪','🟤'];
    let msg = '';
    if (eventName) msg += `🏆 *${eventName}*\n`;
    msg += `🔫 *SORTEIO DE TIMES — ${date}*\n`;
    msg += `${'━'.repeat(26)}\n\n`;
    teams.forEach((team, i) => {
      msg += `${slotEmojis[i % slotEmojis.length]} *Slot ${i + 1}* — ${team.length} jogador${team.length !== 1 ? 'es' : ''}\n`;
      team.forEach((p, idx) => {
        msg += `  🎮 *${idx + 1}.* ${p}\n`;
      });
      msg += '\n';
    });
    msg += `${'─'.repeat(26)}\n`;
    msg += `${getRulesText()}\n`;
    return msg;
  };

  const getRulesText = () => {
    return [
      `⚠️ *Regras da sala*`,
      `🧬 Personagens: Alok, Kelly, Maxim, Moco, Leon e Laura`,
      `🚫 Sem carregamento / sem recursos extras`,
      `🐾 Pets proibidos: Drakino, Etzin e Cascudinho`,
      `⏱ 3 min pra entrar — após isso a vaga é liberada`,
      ``,
      `✅ _Sorteado automaticamente pelo FF Squad Manager_`,
    ].join('\n');
  };

  // ── Salvar resultado (para histórico + perfis) ───────────────────────────
  const saveResult = (winnerTeamIdx, mvpNick, eventName) => {
    const matchDate = Date.now();
    const match = Storage.addMatch({
      eventName: eventName || '',
      teams:     teams.map(t => [...t]),
      winner:    winnerTeamIdx,
      mvp:       mvpNick || null,
      date:      matchDate,
    });

    const newAchievements = {};
    teams.forEach((team, ti) => {
      const won = ti === winnerTeamIdx;
      team.forEach(nick => {
        // Registrar só se jogador existir no cadastro
        if (Storage.getPlayer(nick)) {
          const earned = Players.recordMatch(nick, { won, mvp: nick === mvpNick, matchDate, matchId: match.id });
          if (earned && earned.length > 0) newAchievements[nick] = earned;
        }
      });
    });

    return { match, newAchievements };
  };

  return { getPlayers, getTeams, addPlayer, removePlayer, setPlayers, parseText, clearPlayers, draw, buildMessage, getRulesText, saveResult };
})();