// db.js — camada de dados em tempo real (Firebase Realtime Database)
const DB = (() => {
  let _db = null, _ready = false, _usingFallback = false;
  let _cache = {}, _tournamentCache = null, _onChange = null, _playersById = {}, _matchesCache = [], _statAdjustments = {}, _season=null, _seasonResets={}, _roleRef=null;

  const init = () => {
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || cfg.databaseURL === 'COLE_AQUI') {
      _usingFallback = true; _ready = true; _loadFallback(); return;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      _db = firebase.database();
      // O UID anônimo persistido pelo Firebase é a credencial do dispositivo.
      // localStorage nunca é aceito como prova de identidade.
      firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{});
      firebase.auth().onAuthStateChanged(async user => {
        if(_roleRef){_roleRef.off();_roleRef=null;}
        if (!user) {
          Storage.setRole('player');
          window.dispatchEvent(new CustomEvent('ff-auth-change'));
          try { await firebase.auth().signInAnonymously(); } catch(e) { console.error('[Auth] Anonymous sign-in:', e); }
          return;
        }
        _roleRef=_db.ref(`roles/${user.uid}/role`);
        _roleRef.on('value',snap=>{
          const role=snap.val();Storage.setRole(role==='owner'||role==='admin'?role:'player');
          window.dispatchEvent(new CustomEvent('ff-auth-change'));
        },()=>{Storage.setRole('player');window.dispatchEvent(new CustomEvent('ff-auth-change'));});
        if(user.isAnonymous)_loadMyProfile(user.uid).catch(()=>{});
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
        // Remove caches legados: dados reais vivem exclusivamente no backend.
        localStorage.removeItem('ff_players'); localStorage.removeItem('ff_matches');
        _db.ref('players').on('value', snap => {
          _playersById = snap.val() || {};
          _rebuildPlayerCache();
          if (_onChange) _onChange();
        });
        _db.ref('matches').on('value', snap => {
          const raw = snap.val() || {};
          _matchesCache = Object.values(raw).sort((a,b) => (b.createdAt||b.date||0) - (a.createdAt||a.date||0));
          Storage.setRuntimeMatches(_matchesCache);
          _rebuildPlayerCache();
          if (_onChange) _onChange();
        });
        _db.ref('statAdjustments').on('value', snap => {
          _statAdjustments=snap.val()||{};
          _rebuildPlayerCache();
          if(_onChange)_onChange('players');
        });
        _db.ref('seasons/current').on('value',snap=>{_season=snap.val()||null;_rebuildPlayerCache();if(_onChange)_onChange('season');});
        _db.ref('seasonResets').on('value',snap=>{_seasonResets=snap.val()||{};_rebuildPlayerCache();if(_onChange)_onChange('players');});
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
  const normalizeNick = nick => String(nick || '').trim().replace(/\s+/g, ' ');
  const nickKey = nick => normalizeNick(nick).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9_-]/g,'');
  const validateNick = nick => {
    const clean = normalizeNick(nick);
    if (clean.length < 3 || clean.length > 20) return { ok:false, message:'O nick deve ter entre 3 e 20 caracteres.' };
    if (!/^[\p{L}\p{N}_. -]+$/u.test(clean) || /[<>"'`]/.test(clean)) return { ok:false, message:'Use apenas letras, números, espaço, ponto, hífen ou underline.' };
    return { ok:true, nick:clean, key:nickKey(clean) };
  };

  const _rebuildPlayerCache = () => {
    const all = {};
    Object.entries(_playersById).forEach(([id,p]) => {
      if (!p?.nick) return;
      const seasonId=_season?.id||Storage.getCurrentSeason(), resetAt=Number(_seasonResets[seasonId]?.[id]?.resetAt)||0;
      const matches = _matchesCache.filter(m=>m.season===seasonId&&(m.date||m.createdAt||0)>=resetAt).flatMap(m => {
        const result = Object.values(m.playerResults || {}).find(r => r.playerId === id);
        return result ? [{ won:!!result.won, mvp:!!result.mvp, kills:Number(result.kills)||0, date:m.date||m.createdAt, matchId:m.id }] : [];
      });
      const cfg = Storage.getScoringConfig();
      const adjustment=_statAdjustments[id]||{};
      const points = matches.reduce((sum,m)=>sum+(m.won?(cfg.pointsPerWin||10):0)+(m.mvp?(cfg.pointsPerMvp||15):0),0)+(Number(adjustment.points)||0);
      all[p.nick] = { ...p, id, playerId:id, matches, adjustments:adjustment, points:Math.max(0,points), rank:Storage.calculateRank(Math.max(0,points)), achievements:[] };
    });
    Storage.setPlayers(all);
    if (typeof Players !== 'undefined') Object.keys(all).forEach(nick => Players.checkAchievements(nick));
  };

  const _loadMyProfile = async uid => {
    if (!_db) return null;
    const id = (await _db.ref(`userProfiles/${uid}`).once('value')).val();
    if (!id) { localStorage.removeItem('ff_my_player_id'); localStorage.removeItem('ff_my_nick'); return null; }
    const profile = (await _db.ref(`players/${id}`).once('value')).val();
    if (!profile || profile.ownerUid !== uid) return null;
    localStorage.setItem('ff_my_player_id', JSON.stringify(id));
    Storage.setMyNick(profile.nick);
    return { ...profile, id, playerId:id };
  };

  const getMyProfile = async () => {
    const user = firebase.auth().currentUser;
    if (!user || user.email) return null;
    return _loadMyProfile(user.uid);
  };

  const createMyProfile = async rawNick => {
    if (_usingFallback) throw new Error('Perfis seguros exigem conexão com o Firebase.');
    const valid = validateNick(rawNick); if (!valid.ok) throw new Error(valid.message);
    let user = firebase.auth().currentUser;
    if (!user) { await firebase.auth().signInAnonymously(); user=firebase.auth().currentUser; }
    if (user.email) throw new Error('Saia do painel admin para criar um perfil de jogador.');
    if ((await _db.ref(`userProfiles/${user.uid}`).once('value')).exists()) return _loadMyProfile(user.uid);
    const playerId = crypto.randomUUID();
    const profile = { id:playerId, nick:valid.nick, nickKey:valid.key, ownerUid:user.uid, createdAt:firebase.database.ServerValue.TIMESTAMP };
    try {
      await _db.ref().update({ [`nickClaims/${valid.key}`]:playerId, [`userProfiles/${user.uid}`]:playerId, [`players/${playerId}`]:profile });
    } catch (e) { if (e?.code === 'PERMISSION_DENIED') throw new Error('Esse nick já está em uso. Escolha outro.'); throw e; }
    localStorage.setItem('ff_my_player_id', JSON.stringify(playerId)); Storage.setMyNick(valid.nick);
    return { ...profile, createdAt:Date.now() };
  };

  const changeMyNick = async rawNick => {
    if (_usingFallback) throw new Error('Perfis seguros exigem conexão com o Firebase.');
    const valid=validateNick(rawNick); if(!valid.ok) throw new Error(valid.message);
    const user=firebase.auth().currentUser, current=await getMyProfile();
    if(!user||!current) throw new Error('Perfil não encontrado neste dispositivo.');
    if(current.nickKey===valid.key) return current;
    try {
      await _db.ref().update({ [`nickClaims/${current.nickKey}`]:null, [`nickClaims/${valid.key}`]:current.id, [`players/${current.id}/nick`]:valid.nick, [`players/${current.id}/nickKey`]:valid.key });
    } catch(e){ if(e?.code==='PERMISSION_DENIED') throw new Error('Esse nick já está em uso. Escolha outro.'); throw e; }
    Storage.setMyNick(valid.nick); return { ...current,nick:valid.nick,nickKey:valid.key };
  };

  const getPlayerIdByNick = nick => Object.entries(_playersById).find(([,p]) => p.nick?.toLocaleLowerCase('pt-BR') === String(nick).toLocaleLowerCase('pt-BR'))?.[0] || null;
  const getPlayerById = id => _playersById[id] ? { ..._playersById[id],id,adjustments:_statAdjustments[id]||{} } : null;

  const isReady         = () => _ready;
  const isUsingFallback = () => _usingFallback;
  const onReady   = fn => { if(_ready) fn(); else { const t=setInterval(()=>{ if(_ready){clearInterval(t);fn();} },50); }};
  const setOnChange = fn => { _onChange = fn; };

  const _requireAdminAuth = async () => {
    const user = firebase.auth().currentUser;
    const role=user?(await _db.ref(`roles/${user.uid}/role`).once('value')).val():null;
    if (!user || (role!=='admin'&&role!=='owner')) {
      Storage.setRole('player');
      window.dispatchEvent(new CustomEvent('ff-auth-change'));
      throw new Error('A sessão de admin expirou. Entre novamente no painel.');
    }

    // Atualiza o token antes de operações protegidas. Isso evita que uma
    // troca recente do usuário anônimo para o admin use credenciais antigas.
    await user.getIdToken(true);
    Storage.setRole(role);
    return user;
  };
  const _requireOwnerAuth=async()=>{const user=await _requireAdminAuth();if(Storage.getRole()!=='owner')throw new Error('Apenas o dono pode executar esta ação.');return user;};
  const signInStaff=async(email,password)=>{try{const credential=await firebase.auth().signInWithEmailAndPassword(String(email).trim(),password);const role=(await _db.ref(`roles/${credential.user.uid}/role`).once('value')).val();if(role!=='admin'&&role!=='owner'){await firebase.auth().signOut();Storage.setRole('player');return false;}Storage.setRole(role);window.dispatchEvent(new CustomEvent('ff-auth-change'));return true;}catch{Storage.setRole('player');return false;}};
  const _auditUpdate=(updates,action,details={})=>{const user=firebase.auth().currentUser,key=_db.ref('auditLog').push().key;updates[`auditLog/${key}`]={actorUid:user.uid,role:Storage.getRole(),action,details,createdAt:Date.now()};};

  const _friendlyWriteError = error => {
    if (error?.code === 'PERMISSION_DENIED' || error?.code === 'permission-denied') {
      return new Error('O Firebase recusou a gravação. Publique as regras de database.rules.json no Realtime Database.');
    }
    return error;
  };

  // ── Sessões ────────────────────────────────────────────────────────────────
  const getSessions = () => Object.values(_cache).sort((a,b)=>b.createdAt-a.createdAt);
  const getSession  = id  => _cache[id] || null;

  const addSession = async session => {
    const createdAt = Date.now();
    const id = _usingFallback
      ? `${createdAt}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`
      : _db.ref('sessions').push().key;
    const s = { id, confirmed:[], createdAt, status:'open', createdBy:firebase.auth().currentUser?.uid||null, ...session };
    if (_usingFallback) { _cache[id]=s; _saveFallback(); if(_onChange)_onChange(); return s; }
    await _requireAdminAuth();const updates={[`sessions/${id}`]:{...s,confirmed:{}}};_auditUpdate(updates,'session_created',{sessionId:id,eventName:s.eventName||''});await _db.ref().update(updates);
    return s;
  };

  const deleteSession = async id => {
    if (_usingFallback) { delete _cache[id]; _saveFallback(); if(_onChange)_onChange(); return; }
    await _requireAdminAuth();const updates={[`sessions/${id}`]:null};_auditUpdate(updates,'session_cancelled',{sessionId:id});await _db.ref().update(updates);
  };

  const updateSession = async (id, updates) => {
    const s = _cache[id]; if(!s) return null;
    _cache[id] = {...s, ...updates};
    if (_usingFallback) { _saveFallback(); if(_onChange)_onChange(); return _cache[id]; }
    await _requireAdminAuth();
    const { confirmed, ...rest } = updates;
    if (Object.keys(rest).length > 0) {const paths=Object.fromEntries(Object.entries(rest).map(([key,value])=>[`sessions/${id}/${key}`,value]));_auditUpdate(paths,'session_updated',{sessionId:id,fields:Object.keys(rest)});await _db.ref().update(paths);}
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
    const user=firebase.auth().currentUser;
    const admin=Storage.isAdmin();
    const profile = admin
      ? (()=>{const id=getPlayerIdByNick(nick),p=id&&_playersById[id];return p?{...p,id}:null;})()
      : await getMyProfile();
    if (!profile || profile.nick !== nick) throw new Error('Perfil inválido ou não cadastrado.');
    const key = profile.id;
    const entryRef = _db.ref(`sessions/${sessionId}/confirmed/${key}`);
    const result = await entryRef.transaction(current => current ? undefined : ({
      playerId:profile.id, nick:profile.nick, addedAt:firebase.database.ServerValue.TIMESTAMP, ownerUid:profile.ownerUid,
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
  const deletePlayer = async nick => {
    if(_usingFallback)throw new Error('Operação indisponível sem Firebase.');
    await _requireOwnerAuth();
    const id=getPlayerIdByNick(nick),profile=id&&_playersById[id];
    if(!profile)throw new Error('Perfil não encontrado.');
    const updates={[`players/${id}`]:null,[`nickClaims/${profile.nickKey}`]:null,[`userProfiles/${profile.ownerUid}`]:null,[`statAdjustments/${id}`]:null};
    const sessions=(await _db.ref('sessions').once('value')).val()||{};
    Object.entries(sessions).forEach(([sessionId,session])=>{if(session.status==='closed')return;if(session.confirmed?.[id])updates[`sessions/${sessionId}/confirmed/${id}`]=null;if(Array.isArray(session.teams)&&session.teams.flat().includes(profile.nick))updates[`sessions/${sessionId}/teams`]=null;});
    _auditUpdate(updates,'player_deleted',{playerId:id,nick:profile.nick});await _db.ref().update(updates);
  };

  const savePlayerAdmin = async (playerId,{ nick,adjustments }) => {
    if(_usingFallback)throw new Error('Operação indisponível sem Firebase.');
    await _requireOwnerAuth();
    const current=_playersById[playerId];if(!current)throw new Error('Perfil não encontrado.');
    const valid=validateNick(nick);if(!valid.ok)throw new Error(valid.message);
    const allowed=['points','wins','losses','kills','mvps'], clean={};
    allowed.forEach(key=>{const value=Number(adjustments?.[key]||0);if(!Number.isInteger(value)||Math.abs(value)>10000)throw new Error('Ajustes devem ser números inteiros entre -10000 e 10000.');clean[key]=value;});
    clean.reason=String(adjustments?.reason||'').trim().slice(0,120);clean.updatedAt=Date.now();
    const updates={[`statAdjustments/${playerId}`]:clean};
    if(valid.key!==current.nickKey){
      updates[`nickClaims/${current.nickKey}`]=null;updates[`nickClaims/${valid.key}`]=playerId;updates[`players/${playerId}/nick`]=valid.nick;updates[`players/${playerId}/nickKey`]=valid.key;
      const sessions=(await _db.ref('sessions').once('value')).val()||{};
      Object.entries(sessions).forEach(([sessionId,session])=>{
        if(session.confirmed?.[playerId])updates[`sessions/${sessionId}/confirmed/${playerId}/nick`]=valid.nick;
        if(Array.isArray(session.teams))updates[`sessions/${sessionId}/teams`]=session.teams.map(team=>Array.isArray(team)?team.map(name=>name===current.nick?valid.nick:name):team);
      });
    }
    _auditUpdate(updates,'player_adjusted',{playerId,nick:valid.nick,adjustments:clean});try{await _db.ref().update(updates);}catch(e){if(e?.code==='PERMISSION_DENIED')throw new Error('Nick já utilizado ou regras administrativas não publicadas.');throw e;}
    return true;
  };

  // ── Partidas oficiais ─────────────────────────────────────────────────────
  const finalizeSession = async (sessionId, result) => {
    if (_usingFallback) throw new Error('Finalização oficial exige Firebase.');
    await _requireAdminAuth();
    const sessionSnap=await _db.ref(`sessions/${sessionId}`).once('value'), session=sessionSnap.val();
    if(!session || session.status==='closed' || session.matchId) throw new Error('Esta partida já foi finalizada.');
    const teams=session.teams||[], flat=teams.flat();
    if(new Set(flat.map(n=>n.toLocaleLowerCase('pt-BR'))).size!==flat.length) throw new Error('Há jogador duplicado nas equipes.');
    if(!Number.isInteger(result.winner)||result.winner<0||result.winner>=teams.length) throw new Error('Equipe vencedora inválida.');
    const kills=result.kills||[];
    if(kills.length!==flat.length||kills.some(k=>!Number.isInteger(k.kills)||k.kills<0||k.kills>100)) throw new Error('Kills devem ser inteiras entre 0 e 100.');
    const resultNames=kills.map(k=>k.player.toLocaleLowerCase('pt-BR'));
    if(new Set(resultNames).size!==flat.length||flat.some(n=>!resultNames.includes(n.toLocaleLowerCase('pt-BR')))) throw new Error('A lista de kills não corresponde aos participantes.');
    if(result.mvp && !flat.includes(result.mvp)) throw new Error('MVP inválido.');
    const matchId=crypto.randomUUID(), now=Date.now();
    const resultRows=flat.map(nick=>({ playerId:getPlayerIdByNick(nick), nick, kills:kills.find(k=>k.player===nick).kills, won:teams[result.winner].includes(nick), mvp:result.mvp===nick }));
    if(resultRows.some(r=>!r.playerId)) throw new Error('Todos os participantes precisam possuir um perfil válido.');
    const playerResults=Object.fromEntries(resultRows.map(row=>[row.playerId,row]));
    const match={ id:matchId,sessionId,eventName:session.eventName||'Partida',teams,winner:result.winner,mvp:result.mvp||null,playerResults,date:now,createdAt:now,season:_season?.id||Storage.getCurrentSeason(),finalizedBy:firebase.auth().currentUser.uid,status:'finalized' };
    const updates={ [`matches/${matchId}`]:match,[`sessions/${sessionId}/status`]:'closed',[`sessions/${sessionId}/closedAt`]:now,[`sessions/${sessionId}/matchId`]:matchId };_auditUpdate(updates,'match_finalized',{matchId,sessionId,winner:result.winner,mvp:result.mvp||null,kills});await _db.ref().update(updates);
    return match;
  };

  const deleteOfficialMatch=async matchId=>{await _requireOwnerAuth();const snap=await _db.ref(`matches/${matchId}`).once('value'),match=snap.val();if(!match)throw new Error('Resultado não encontrado.');const updates={[`matches/${matchId}`]:null,[`sessions/${match.sessionId}/status`]:'open',[`sessions/${match.sessionId}/closedAt`]:null,[`sessions/${match.sessionId}/matchId`]:null};_auditUpdate(updates,'match_cancelled',{matchId,sessionId:match.sessionId});await _db.ref().update(updates);};
  const correctOfficialMatch=async(matchId,result)=>{await _requireOwnerAuth();const snap=await _db.ref(`matches/${matchId}`).once('value'),match=snap.val();if(!match||match.status!=='finalized')throw new Error('Resultado finalizado não encontrado.');const teams=match.teams||[],flat=teams.flat(),kills=result.kills||[];if(!Number.isInteger(result.winner)||result.winner<0||result.winner>=teams.length)throw new Error('Equipe vencedora inválida.');if(kills.length!==flat.length||kills.some(k=>!Number.isInteger(k.kills)||k.kills<0||k.kills>100))throw new Error('Kills devem ser inteiras entre 0 e 100.');if(result.mvp&&!flat.includes(result.mvp))throw new Error('MVP inválido.');const rows=flat.map(nick=>({playerId:getPlayerIdByNick(nick),nick,kills:kills.find(k=>k.player===nick)?.kills,won:teams[result.winner].includes(nick),mvp:result.mvp===nick}));if(rows.some(r=>!r.playerId||!Number.isInteger(r.kills)))throw new Error('Participantes inválidos.');const now=Date.now(),updates={[`matches/${matchId}/winner`]:result.winner,[`matches/${matchId}/mvp`]:result.mvp||null,[`matches/${matchId}/playerResults`]:Object.fromEntries(rows.map(r=>[r.playerId,r])),[`matches/${matchId}/correctedAt`]:now,[`matches/${matchId}/correctedBy`]:firebase.auth().currentUser.uid};_auditUpdate(updates,'match_corrected',{matchId,sessionId:match.sessionId,winner:result.winner,mvp:result.mvp||null,kills});await _db.ref().update(updates);};

  const setAdminRole=async(uid,label)=>{await _requireOwnerAuth();if(!/^[A-Za-z0-9_-]{6,128}$/.test(uid))throw new Error('UID inválido.');const updates={[`roles/${uid}`]:{role:'admin',label:String(label||'ADM').trim().slice(0,60),updatedAt:Date.now()}};_auditUpdate(updates,'admin_granted',{targetUid:uid,label});await _db.ref().update(updates);};
  const removeAdminRole=async uid=>{await _requireOwnerAuth();const updates={[`roles/${uid}`]:null};_auditUpdate(updates,'admin_revoked',{targetUid:uid});await _db.ref().update(updates);};
  const getRoles=async()=>{await _requireOwnerAuth();return (await _db.ref('roles').once('value')).val()||{};};
  const getAuditLog=async()=>{await _requireOwnerAuth();return Object.values((await _db.ref('auditLog').limitToLast(100).once('value')).val()||{}).sort((a,b)=>b.createdAt-a.createdAt);};
  const resetPlayerSeason=async playerId=>{await _requireOwnerAuth();if(!_playersById[playerId])throw new Error('Jogador não encontrado.');const seasonId=_season?.id||Storage.getCurrentSeason(),updates={[`seasonResets/${seasonId}/${playerId}`]:{resetAt:Date.now(),byUid:firebase.auth().currentUser.uid},[`statAdjustments/${playerId}`]:null};_auditUpdate(updates,'player_metrics_reset',{playerId,seasonId});await _db.ref().update(updates);};
  const startNewSeason=async()=>{await _requireOwnerAuth();const old=_season||{id:Storage.getCurrentSeason(),number:1,name:'Temporada 1'},number=(Number(old.number)||1)+1,id=`season-${number}`,now=Date.now();const ranking=Players.getList().map(p=>({playerId:p.playerId,nick:p.nick,points:p.points,stats:Players.getStats(p.nick)}));const updates={[`seasons/archive/${old.id}`]:{...old,endedAt:now,ranking},'seasons/current':{id,number,name:`Temporada ${number}`,startedAt:now}};_auditUpdate(updates,'season_started',{previousSeason:old.id,newSeason:id});await _db.ref().update(updates);};

  // ── Torneio ───────────────────────────────────────────────────────────────
  const getTournament = () => _tournamentCache;

  const saveTournament = async tournament => {
    if (!Storage.isAdmin()) throw new Error('Apenas o admin pode alterar o torneio.');
    if (_usingFallback) {
      _tournamentCache = tournament;
      Storage.setTournament(tournament);
      if (_onChange) _onChange('tournament');
      return tournament;
    }
    await _requireAdminAuth();
    try { await _db.ref('tournament').set(tournament); }
    catch (error) { throw _friendlyWriteError(error); }
    _tournamentCache = tournament;
    Storage.setTournament(tournament);
    return tournament;
  };

  const clearTournament = async () => {
    if (!Storage.isAdmin()) throw new Error('Apenas o admin pode alterar o torneio.');
    if (_usingFallback) {
      _tournamentCache = null;
      Storage.clearTournament();
      if (_onChange) _onChange('tournament');
      return;
    }
    await _requireAdminAuth();
    try { await _db.ref('tournament').remove(); }
    catch (error) { throw _friendlyWriteError(error); }
    _tournamentCache = null;
    Storage.clearTournament();
  };

  return {
    init, isReady, isUsingFallback, onReady, setOnChange,
    getSessions, getSession, addSession, deleteSession, updateSession,
    addConfirmed, replaceConfirmed, removeConfirmed,
    deletePlayer, savePlayerAdmin, getPlayerById,
    finalizeSession, deleteOfficialMatch, correctOfficialMatch,
    validateNick, createMyProfile, changeMyNick, getMyProfile, getPlayerIdByNick, signInStaff,
    setAdminRole, removeAdminRole, getRoles, getAuditLog, resetPlayerSeason, startNewSeason,
    getTournament, saveTournament, clearTournament,
  };
})();
