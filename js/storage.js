// storage.js — camada de dados (localStorage)

const Storage = (() => {
  let runtimePlayers = null, runtimeMatches = null;
  const K = {
    PLAYERS:  'ff_players',
    MATCHES:  'ff_matches',
    SESSIONS: 'ff_sessions',
    IS_ADMIN: 'ff_is_admin',
    ADMIN_MODE:'ff_admin_mode',
    TOURNAMENT:'ff_tournament',
    SCORING_CONFIG:'ff_scoring_config',
  };

  const DEFAULT_SCORING = {
    pointsPerWin: 10,
    pointsPerMvp: 15,
    ranks: [
      { name: 'Bronze',   minPoints: 0   },
      { name: 'Prata',    minPoints: 50  },
      { name: 'Ouro',     minPoints: 100 },
      { name: 'Platina',  minPoints: 200 },
      { name: 'Diamante', minPoints: 350 },
      { name: 'Mestre',   minPoints: 500 },
    ],
  };

  const get = key => {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { return null; }
  };
  const set = (key, val) => localStorage.setItem(key, JSON.stringify(val));

  // ── Players ──────────────────────────────────────────────────────────────
  const usesBackend = () => window.FIREBASE_CONFIG?.databaseURL && window.FIREBASE_CONFIG.databaseURL !== 'COLE_AQUI';
  const getPlayers  = ()  => usesBackend() ? (runtimePlayers || {}) : (get(K.PLAYERS) || {});
  const setPlayers  = p => { if (usesBackend()) runtimePlayers=p; else set(K.PLAYERS,p); };

  const getPlayer = (nick) => getPlayers()[nick] || null;

  const upsertPlayer = (nick, data) => {
    const all = getPlayers();
    all[nick] = {
      nick,
      rank: 'Bronze',
      matches: [],
      achievements: [],
      joinedAt: Date.now(),
      ...(all[nick] || {}),
      ...data,
    };
    setPlayers(all);
    return all[nick];
  };

  const deletePlayer = (nick) => {
    const all = getPlayers();
    delete all[nick];
    setPlayers(all);
  };

  // ── Matches ───────────────────────────────────────────────────────────────
  const getMatches = () => usesBackend() ? (runtimeMatches || []) : (get(K.MATCHES) || []);
  const setRuntimeMatches = matches => { runtimeMatches=Array.isArray(matches)?matches:[]; };

  const getCurrentSeason = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // ── Sessions (agendamento) ────────────────────────────────────────────────
  const getSessions  = ()  => get(K.SESSIONS) || [];

  const addSession = (session) => {
    const all = getSessions();
    const s = { id: Date.now(), confirmed: [], createdAt: Date.now(), ...session };
    all.unshift(s);
    set(K.SESSIONS, all);
    return s;
  };

  const updateSession = (id, updates) => {
    const all = getSessions();
    const i = all.findIndex(s => s.id === id);
    if (i >= 0) { all[i] = { ...all[i], ...updates }; set(K.SESSIONS, all); }
    return all[i] || null;
  };

  const deleteSession = (id) => set(K.SESSIONS, getSessions().filter(s => s.id !== id));

  // ── Confirmação local (por dispositivo) ───────────────────────────────────
  // Guarda no navegador do membro: qual nick ele confirmou e se já editou
  // Formato: { nick: 'João', edited: false }
  const getMyConfirmation = (sessionId) => get(`ff_myconf_${sessionId}`);
  const setMyConfirmation = (sessionId, data) => set(`ff_myconf_${sessionId}`, data);

  // Adicionar nick confirmado à sessão (chamado pelo admin ou pelo membro)
  const addConfirmed = (sessionId, nick) => {
    const all = getSessions();
    const i = all.findIndex(s => s.id === sessionId);
    if (i < 0) return null;
    const confirmed = all[i].confirmed || [];
    if (!confirmed.includes(nick)) {
      all[i].confirmed = [...confirmed, nick];
      set(K.SESSIONS, all);
    }
    return all[i];
  };

  // Trocar nick confirmado (edição única do membro)
  const replaceConfirmed = (sessionId, oldNick, newNick) => {
    const all = getSessions();
    const i = all.findIndex(s => s.id === sessionId);
    if (i < 0) return null;
    all[i].confirmed = (all[i].confirmed || []).map(n => n === oldNick ? newNick : n);
    set(K.SESSIONS, all);
    return all[i];
  };

  // Remover nick da lista (admin)
  const removeConfirmed = (sessionId, nick) => {
    const all = getSessions();
    const i = all.findIndex(s => s.id === sessionId);
    if (i < 0) return null;
    all[i].confirmed = (all[i].confirmed || []).filter(n => n !== nick);
    set(K.SESSIONS, all);
    return all[i];
  };

  // ── Admin ─────────────────────────────────────────────────────────────────
  let runtimeRole='player', authorizedRole='player';
  const getRole=()=>runtimeRole;
  const getAuthorizedRole=()=>authorizedRole;
  const isAuthorizedAdmin=()=>authorizedRole==='admin'||authorizedRole==='owner';
  const isAdminModeActive=()=>authorizedRole==='owner'||(authorizedRole==='admin'&&localStorage.getItem(K.ADMIN_MODE)==='true');
  const isAdmin=()=>runtimeRole==='admin'||runtimeRole==='owner';
  const isOwner=()=>runtimeRole==='owner';
  const setAuthorizedRole=role=>{authorizedRole=['admin','owner'].includes(role)?role:'player';runtimeRole=authorizedRole==='owner'?'owner':authorizedRole==='admin'&&isAdminModeActive()?'admin':'player';if(authorizedRole==='player')localStorage.removeItem(K.ADMIN_MODE);};
  const setAdminMode=active=>{if(authorizedRole!=='admin')return false;localStorage.setItem(K.ADMIN_MODE,active?'true':'false');runtimeRole=active?'admin':'player';return true;};
  const setRole=setAuthorizedRole;
  const setAdmin=v=>{if(authorizedRole==='admin')setAdminMode(v);else setAuthorizedRole(v?'admin':'player');};

  // ── Nick persistente do usuário ───────────────────────────────────────
  // Guardamos o nick que o dispositivo usou para confirmar presença pela
  // primeira vez; o usuário pode alterá-lo até 2 vezes.
  const getMyNick        = () => get('ff_my_nick') || '';
  const setMyNick        = (n) => set('ff_my_nick', n);
  const getNickEdits     = () => get('ff_my_nick_edits') || 0;
  const incrementNickEdits = () => set('ff_my_nick_edits', getNickEdits() + 1);

  // ── Scoring Configuration ─────────────────────────────────────────────────
  const getScoringConfig  = () => JSON.parse(JSON.stringify(DEFAULT_SCORING));
  const setScoringConfig  = () => false;

  const calculateRank = (points) => {
    const cfg = getScoringConfig();
    for (let i = cfg.ranks.length - 1; i >= 0; i--) {
      if (points >= cfg.ranks[i].minPoints) return cfg.ranks[i].name;
    }
    return cfg.ranks[0].name;
  };

  // ── Tournament ────────────────────────────────────────────────────────────
  const getTournament  = ()  => get(K.TOURNAMENT);
  const setTournament  = (t) => set(K.TOURNAMENT, t);
  const clearTournament= ()  => localStorage.removeItem(K.TOURNAMENT);

  return {
    getPlayers, setPlayers, getPlayer, upsertPlayer, deletePlayer,
    getMatches, setRuntimeMatches,
    getSessions, addSession, updateSession, deleteSession,
    addConfirmed, replaceConfirmed, removeConfirmed,
    getMyConfirmation, setMyConfirmation,
    isAdmin, isOwner, getRole, getAuthorizedRole, isAuthorizedAdmin, isAdminModeActive, setAuthorizedRole, setAdminMode, setRole, setAdmin,
    getMyNick, setMyNick, getNickEdits, incrementNickEdits,
    getScoringConfig, setScoringConfig, calculateRank,
    getCurrentSeason,
    getTournament, setTournament, clearTournament,
  };
})();
