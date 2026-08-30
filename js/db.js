// db.js — camada de dados em tempo real (Firebase Realtime Database)
const DB = (() => {
  let _db = null, _ready = false, _usingFallback = false;
  let _cache = {}, _tournamentCache = null, _onChange = null;

  const init = () => {
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || cfg.databaseURL === 'COLE_AQUI') {
      _usingFallback = true; _ready = true; _loadFallback(); return;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      _db = firebase.database();
      firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(()=>{});
      firebase.auth().onAuthStateChanged(async user => {
        const admin = user?.email === cfg.adminEmail;
        Storage.setAdmin(admin);
        if (!user) {
          try { await firebase.auth().signInAnonymously(); } catch(e) { console.error('[Auth] Anonymous sign-in:', e); }
        }
        window.dispatchEvent(new CustomEvent('ff-auth-change'));
      });

      _db.ref('sessions').on('value', snap => {
        const raw = snap.val() || {};
        Object.keys(raw).forEach(id => { raw[id].confirmed = _normalizeConfirmed(raw[id].confirmed); });
        _cache = raw; _ready = true;
        if (_onChange) _onChange();
      }, err => {
        console.error('[DB] Firebase error:', err);
        _usingFallback = true; _ready = true; _loadFallback();
        if (_onChange) _onChange();
      });

      _db.ref('tournament').on('value', snap => {
        _tournamentCache = snap.val() || null;
        if (_tournamentCache) Storage.setTournament(_tournamentCache);
        else Storage.clearTournament();
        if (_onChange) _onChange('tournament');
      }, err => console.error('[DB] Tournament listener:', err));

      if (cfg.syncStats === true) {
        _db.ref('players').on('value', snap => {
          const raw = snap.val() || {}, all = {};
          Object.values(raw).forEach(p => { if (p && p.nick) all[p.nick] = p; });
          localStorage.setItem('ff_players', JSON.stringify(all));
          if (_onChange) _onChange();
        });
        _db.ref('matches').on('value', snap => {
          const raw = snap.val() || {};
          const arr = Object.values(raw).sort((a,b) => b.createdAt - a.createdAt);
          localStorage.setItem('ff_matches', JSON.stringify(arr));
        });
      }

    } catch(e) {
      console.error('[DB] Firebase init failed:', e);
      _usingFallback = true; _ready = true; _loadFallback();
    }
  };

  const _normalizeConfirmed = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return Object.values(raw).sort((a,b)=>(a.addedAt||0)-(b.addedAt||0)).map(v=>typeof v==='string'?v:v.nick);
  };

  const _loadFallback = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('ff_sessions')||'[]');
      _cache = {};
      saved.forEach(s => { s.confirmed = _normalizeConfirmed(s.confirmed); _cache[s.id] = s; });
    } catch { _cache = {}; }
    _tournamentCache = Storage.getTournament();
  };
  const _saveFallback = () => localStorage.setItem('ff_sessions', JSON.stringify(Object.values(_cache)));
  const _safeKey = str => str.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,40);

  const isReady         = () => _ready;
  const isUsingFallback = () => _usingFallback;
  const onReady   = fn => { if(_ready) fn(); else { const t=setInterval(()=>{ if(_ready){clearInterval(t);fn();} },50); }};
  const setOnChange = fn => { _onChange = fn; };

  // ── Sessões ────────────────────────────────────────────────────────────────
  const getSessions = () => Object.values(_cache).sort((a,b)=>b.createdAt-a.createdAt);
  const getSession  = id  => _cache[id] || null;

  const addSession = async session => {
    const createdAt = Date.now();
    const id = _usingFallback
      ? `${createdAt}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`
      : _db.ref('sessions').push().key;
    const s = { id, confirmed:[], createdAt, status:'open', ...session };
    if (_usingFallback) { _cache[id]=s; _saveFallback(); if(_onChange)_onChange(); return s; }
    await _db.ref(`sessions/${id}`).set({ ...s, confirmed:{} });
    return s;
  };

  const deleteSession = async id => {
    delete _cache[id];
    if (_usingFallback) { _saveFallback(); if(_onChange)_onChange(); return; }
    await _db.ref(`sessions/${id}`).remove();
  };

  const updateSession = async (id, updates) => {
    const s = _cache[id]; if(!s) return null;
    _cache[id] = {...s, ...updates};
    if (_usingFallback) { _saveFallback(); if(_onChange)_onChange(); return _cache[id]; }
    const { confirmed, ...rest } = updates;
    if (Object.keys(rest).length > 0) await _db.ref(`sessions/${id}`).update(rest);
    return _cache[id];
  };

  const addConfirmed = async (sessionId, nick) => {
    const s = _cache[sessionId];
    if(!s || s.status === 'closed') return false;
    if (s.confirmed.some(n=>n.toLowerCase()===nick.toLowerCase())) return false;
    if (s.format && s.format.includes('v')) {
      const num = parseInt(s.format.split('v')[0],10);
      if (!isNaN(num) && s.confirmed.length >= num*2) return;
    }
    if (_usingFallback) { s.confirmed=[...s.confirmed,nick]; _saveFallback(); if(_onChange)_onChange(); return true; }
    if (!firebase.auth().currentUser) await firebase.auth().signInAnonymously();
    const key = _safeKey(nick) || `p_${Date.now()}`;
    const entryRef = _db.ref(`sessions/${sessionId}/confirmed/${key}`);
    const result = await entryRef.transaction(current => current ? undefined : ({
      nick, addedAt:firebase.database.ServerValue.TIMESTAMP, ownerUid:firebase.auth().currentUser.uid,
    }));
    return result.committed;
  };

  const replaceConfirmed = async (sessionId, oldNick, newNick) => {
    const s = _cache[sessionId]; if(!s) return;
    if (_usingFallback) { s.confirmed=s.confirmed.map(n=>n===oldNick?newNick:n); _saveFallback(); if(_onChange)_onChange(); return; }
    const snap = await _db.ref(`sessions/${sessionId}/confirmed`).once('value');
    const data = snap.val()||{};
    const entry = Object.entries(data).find(([,v])=>v.nick===oldNick);
    if (entry) await _db.ref(`sessions/${sessionId}/confirmed/${entry[0]}`).update({ nick:newNick, editedAt:Date.now() });
  };

  const removeConfirmed = async (sessionId, nick) => {
    const s = _cache[sessionId]; if(!s) return;
    if (_usingFallback) { s.confirmed=s.confirmed.filter(n=>n!==nick); _saveFallback(); if(_onChange)_onChange(); return; }
    const snap = await _db.ref(`sessions/${sessionId}/confirmed`).once('value');
    const data = snap.val()||{};
    const entry = Object.entries(data).find(([,v])=>v.nick===nick);
    if (entry) await _db.ref(`sessions/${sessionId}/confirmed/${entry[0]}`).remove();
  };

  // ── Jogadores ──────────────────────────────────────────────────────────────
  const upsertPlayer = async (nick, data) => {
    Storage.upsertPlayer(nick, data); // imediato no localStorage
    if (!_usingFallback && _db && Storage.isAdmin() && window.FIREBASE_CONFIG?.syncStats === true) {
      try { await _db.ref(`players/${_safeKey(nick)}`).set(Storage.getPlayer(nick)); }
      catch(e) { console.warn('[DB] upsertPlayer:', e.message); }
    }
    return Storage.getPlayer(nick);
  };

  const deletePlayer = async nick => {
    Storage.deletePlayer(nick);
    if (!_usingFallback && _db && Storage.isAdmin() && window.FIREBASE_CONFIG?.syncStats === true) {
      try { await _db.ref(`players/${_safeKey(nick)}`).remove(); } catch(e) {}
    }
  };

  // ── Partidas ───────────────────────────────────────────────────────────────
  const addMatch = async match => {
    const m = Storage.addMatch(match);
    if (!_usingFallback && _db && Storage.isAdmin() && window.FIREBASE_CONFIG?.syncStats === true) {
      try { await _db.ref(`matches/${m.id}`).set(m); } catch(e) {}
    }
    return m;
  };

  const deleteMatch = async id => {
    Storage.deleteMatch(id);
    if (!_usingFallback && _db && Storage.isAdmin() && window.FIREBASE_CONFIG?.syncStats === true) {
      try { await _db.ref(`matches/${id}`).remove(); } catch(e) {}
    }
  };

  // ── Torneio ───────────────────────────────────────────────────────────────
  const getTournament = () => _tournamentCache;

  const saveTournament = async tournament => {
    if (!Storage.isAdmin()) throw new Error('Apenas o admin pode alterar o torneio.');
    _tournamentCache = tournament;
    Storage.setTournament(tournament);
    if (_usingFallback) { if (_onChange) _onChange('tournament'); return tournament; }
    await _db.ref('tournament').set(tournament);
    return tournament;
  };

  const clearTournament = async () => {
    if (!Storage.isAdmin()) throw new Error('Apenas o admin pode alterar o torneio.');
    _tournamentCache = null;
    Storage.clearTournament();
    if (_usingFallback) { if (_onChange) _onChange('tournament'); return; }
    await _db.ref('tournament').remove();
  };

  return {
    init, isReady, isUsingFallback, onReady, setOnChange,
    getSessions, getSession, addSession, deleteSession, updateSession,
    addConfirmed, replaceConfirmed, removeConfirmed,
    upsertPlayer, deletePlayer,
    addMatch, deleteMatch,
    getTournament, saveTournament, clearTournament,
  };
})();
