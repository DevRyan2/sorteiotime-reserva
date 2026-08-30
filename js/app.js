// app.js — controlador principal da UI

const UI = (() => {

  // ── Utilitários ────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  })[char]);
  const sessionArg = id => JSON.stringify(String(id));

  let _toastTimer = null;
  const toast = (msg, type = 'ok') => {
    const t = $('toast');
    t.textContent = msg;
    t.className   = 'toast show toast-' + type;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.className = 'toast', 3000);
  };

  const confirm = (msg) => window.confirm(msg);

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const TABS = ['sorteio', 'partidas', 'jogadores', 'perfil', 'rank', 'torneio'];
  let activeTab = 'sorteio';

  const showTab = (tab) => {
    if (!TABS.includes(tab)) return;
    activeTab = tab;
    TABS.forEach(t => {
      $('tab-btn-' + t)?.classList.toggle('active', t === tab);
      $('tab-' + t)?.classList.toggle('hidden', t !== tab);
    });
    if (tab === 'partidas')   renderPartidasTab();
    if (tab === 'jogadores')  renderJogadoresTab();
    if (tab === 'perfil')     renderPerfilTab();
    if (tab === 'rank')       renderRankTab();
    if (tab === 'torneio')    renderTorneioTab();
    if (tab === 'sorteio')    { /* state kept */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Admin ──────────────────────────────────────────────────────────────────
  const toggleAdmin = async () => {
    if (Storage.isAdmin()) {
      firebase.auth().signOut().then(() => firebase.auth().signInAnonymously()).catch(()=>{});
      Storage.setAdmin(false);
      renderAdminBtn();
      toast('🔓 Modo admin desativado');
      showTab(activeTab);
    } else {
      $('admin-password').value = '';
      $('admin-error')?.classList.add('hidden');
      $('modal-admin')?.classList.remove('hidden');
      setTimeout(() => $('admin-password')?.focus(), 50);
    }
  };

  const submitAdminLogin = async () => {
    const input = $('admin-password');
    const button = $('btn-admin-login');
    if (!input || !button) return;
    button.disabled = true;
    button.textContent = 'Verificando…';
    const valid = await Storage.checkPassword(input.value);
    button.disabled = false;
    button.textContent = 'Entrar no painel';
    if (!valid) {
      $('admin-error')?.classList.remove('hidden');
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    Storage.setAdmin(true);
    $('modal-admin')?.classList.add('hidden');
    toast('🔑 Painel desbloqueado!');
    renderAdminBtn();
    showTab(activeTab);
  };

  const renderAdminBtn = () => {
    const btn       = $('admin-btn');
    const scoringBtn= $('btn-scoring-config');
    if (!btn) return;
    btn.textContent = Storage.isAdmin() ? '🔑 Admin ON' : '🔒 Admin';
    btn.classList.toggle('admin-active', Storage.isAdmin());
    if (scoringBtn) scoringBtn.style.display = Storage.isAdmin() ? 'inline-block' : 'none';
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  TAB: SORTEIO
  // ══════════════════════════════════════════════════════════════════════════
  let sorteioStep = 1;

  const setStep = (n) => {
    sorteioStep = n;
    for (let i = 1; i <= 4; i++) {
      const s = $('stp' + i);
      if (!s) continue;
      s.className = 'stp';
      if (i < n) s.classList.add('done');
      else if (i === n) s.classList.add('active');
    }
    ['p1','p2','p3','p4'].forEach((id, i) => {
      const el = $(id);
      if (el) el.classList.toggle('hidden', i + 1 !== n);
    });
    $('line1')?.classList.toggle('filled', n > 1);
    $('line2')?.classList.toggle('filled', n > 2);
    $('line3')?.classList.toggle('filled', n > 3);
  };

  const renderPool = () => {
    const pool  = $('playerPool');
    const meta  = $('poolMeta');
    const pl    = Sorteio.getPlayers();
    if (!pool) return;
    pool.innerHTML = pl.map((p, i) => `
      <div class="ptag">
        <span>${p}</span>
        <button onclick="UI.removePlayer(${i})">✕</button>
      </div>`).join('');
    if (meta) meta.innerHTML = pl.length === 0
      ? 'Nenhum jogador adicionado.'
      : `<b>${pl.length}</b> jogador${pl.length > 1 ? 'es' : ''} na lista`;
  };

  const removePlayer = (i) => { Sorteio.removePlayer(i); renderPool(); };

  const updateSummary = () => {
    const n   = Math.max(2, parseInt($('numTeams')?.value) || 2);
    const pl  = Sorteio.getPlayers();
    const per = Math.floor(pl.length / n);
    const rem = pl.length % n;
    const modes = { balanced:'Equilibrado', snake:'Snake Draft', sequential:'Sequencial' };
    const mode = $('modeSelect')?.value || 'balanced';
    const box  = $('configSummary');
    if (!box) return;
    box.innerHTML = `
      <span style="color:var(--muted);font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Resumo</span><br><br>
      <span style="color:var(--accent);font-weight:600;">${pl.length}</span> jogadores em
      <span style="color:var(--accent);font-weight:600;">${n} times</span> de
      <span style="color:var(--accent);font-weight:600;">${per}${rem ? '–' + (per + 1) : ''} jogadores</span>
      · modo <b style="color:var(--text)">${modes[mode]}</b>`;
  };

  const renderResults = () => {
    const teams  = Sorteio.getTeams();
    const tcs    = ['tc0','tc1','tc2','tc3','tc4','tc5','tc6','tc7'];
    const emojis = ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱'];
    const grid   = $('resultsGrid');
    if (!grid) return;
    grid.innerHTML = teams.map((team, i) => `
      <div class="team-block ${tcs[i % 8]}" style="animation-delay:${i * 0.07}s">
        <div class="team-block-label">
          <div class="team-dot"></div>
          ${emojis[i % 8]} Time ${i + 1}
          <div class="team-count-badge">${team.length} jogadores</div>
        </div>
        <div class="team-members">
          ${team.map(p => `<div class="team-member">${p}</div>`).join('')}
        </div>
      </div>`).join('');

    const preview = $('outputPreview');
    const eventName = $('eventName')?.value.trim() || '';
    if (preview) preview.textContent = Sorteio.buildMessage(eventName);

    // Preencher select de time vencedor na step 4
    renderResultStep4();
  };

  const renderResultStep4 = () => {
    const teams     = Sorteio.getTeams();
    const selWinner = $('sel-winner');
    const selMvp    = $('sel-mvp');
    if (!selWinner || !selMvp) return;

    selWinner.innerHTML = teams.map((_, i) => `<option value="${i}">Time ${i + 1}</option>`).join('');

    const allPlayers = teams.flat();
    selMvp.innerHTML = `<option value="">— Sem MVP —</option>` +
      allPlayers.map(p => `<option value="${p}">${p}</option>`).join('');
  };

  const doDraw = () => {
    const n    = Math.max(2, parseInt($('numTeams')?.value) || 2);
    const mode = $('modeSelect')?.value || 'balanced';
    if (n >= Sorteio.getPlayers().length) { toast('⚠️ Mais jogadores que times!', 'warn'); return; }
    const overlay = $('drawOverlay');
    if (overlay) overlay.classList.add('active');
    setTimeout(() => {
      Sorteio.draw(n, mode);
      renderResults();
      if (overlay) overlay.classList.remove('active');
      setStep(3);
    }, 900);
  };

  const saveMatchResult = () => {
    const winnerIdx = parseInt($('sel-winner')?.value ?? '0');
    const mvpNick   = $('sel-mvp')?.value || null;
    const eventName = $('eventName')?.value.trim() || '';
    const { match, newAchievements } = Sorteio.saveResult(winnerIdx, mvpNick, eventName);

    const achCount = Object.values(newAchievements).flat().length;
    toast(`✅ Resultado salvo!${achCount > 0 ? ` ${achCount} conquista(s) desbloqueada(s) 🏅` : ''}`, 'ok');

    if (achCount > 0) {
      setTimeout(() => {
        const names = Object.entries(newAchievements)
          .map(([nick, ids]) => {
            const labels = ids.map(id => ACHIEVEMENTS_DEF.find(a => a.id === id)?.name || id).join(', ');
            return `${nick}: ${labels}`;
          }).join('\n');
        alert(`🏅 Novas conquistas!\n\n${names}`);
      }, 400);
    }

    $('result-saved-msg').classList.remove('hidden');
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  TAB: PARTIDAS
  // ══════════════════════════════════════════════════════════════════════════
  const renderPartidasTab = () => {
    const createBlock = $('session-create-block');
    if (createBlock) createBlock.classList.toggle('hidden', !Storage.isAdmin());

    // sempre definir data/hora atual como padrão quando o formulário for
    // mostrado — em celulares já acontece automaticamente via HTML, mas
    // em desktops o campo fica vazio a menos que o usuário digite.
    const dateInput = $('session-date');
    if (dateInput && !dateInput.value) {
      const now = new Date();
      const pad = n => n.toString().padStart(2, '0');
      const val = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}` +
                  `T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      dateInput.value = val;
    }

    // Aviso se Firebase não estiver configurado
    const fbWarn = $('firebase-warn');
    if (fbWarn) fbWarn.classList.toggle('hidden', !DB.isUsingFallback());

    renderSessions();
    renderMatchHistory();
  };

  // Formatos disponíveis
  const FORMATS = {
    '1v1': { label:'1v1', players:2,  teams:2, perTeam:1 },
    '2v2': { label:'2v2', players:4,  teams:2, perTeam:2 },
    '3v3': { label:'3v3', players:6,  teams:2, perTeam:3 },
    '4v4': { label:'4v4', players:8,  teams:2, perTeam:4 },
  };

  const renderSessions = () => {
    const wrap     = $('sessions-list');
    const sessions = DB.getSessions();
    if (!wrap) return;

    if (sessions.length === 0) {
      wrap.innerHTML = `<p style="color:var(--muted);font-size:13px;padding:20px 0">Nenhuma sessão agendada.</p>`;
      return;
    }

    wrap.innerHTML = sessions.map(s => {
      const dateStr   = new Date(s.scheduledAt).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });
      const confirmed = s.confirmed || [];
      const myConf    = Storage.getMyConfirmation(s.id);
      const admin     = Storage.isAdmin();
      const fmt       = FORMATS[s.format] || null;
      const needed    = fmt ? fmt.players : null;
      const hasEnough = fmt ? confirmed.length >= needed : confirmed.length >= 2;
      const isFull    = hasEnough; // same thing, but clearer semantics

      // Badge de formato
      const fmtBadge = fmt
        ? `<span class="format-badge">${fmt.label}</span>`
        : '';

      // Vagas: ex "3/4 confirmados"
      const vagasTxt = fmt
        ? `<span class="${confirmed.length >= needed ? 'vagas-ok' : 'vagas-pending'}">${confirmed.length}/${needed} confirmado${needed !== 1 ? 's' : ''}</span>`
        : `<b style="color:var(--accent)">${confirmed.length} confirmado${confirmed.length !== 1 ? 's' : ''}</b>`;

      // Status do próprio membro
      let myStatus = '';
      if (!admin) {
        if (myConf) {
          myStatus = `<div class="conf-status conf-ok">
            ✅ Você confirmou como <b>${myConf.nick}</b>
            ${!myConf.edited
              ? `<button class="btn btn-ghost btn-sm" style="margin-left:8px" onclick='UI.editMyPresence(${sessionArg(s.id)})'>✏️ Corrigir nick</button>`
              : `<span style="color:var(--muted);font-size:11px;margin-left:8px">(edição usada)</span>`}
          </div>`;
        } else {
          if (isFull) {
            myStatus = `<div class="conf-status conf-full">⚠️ Sala cheia</div>`;
          } else {
            myStatus = `<div class="conf-status conf-pending">⚠️ Você ainda não confirmou presença.</div>`;
          }
        }
      }

      // Lista de confirmados
      const listHTML = confirmed.length > 0
        ? `<div class="session-confirmed-list">
            ${confirmed.map(p => `
              <div class="conf-row">
                <span class="conf-nick">${escapeHTML(p)}</span>
                ${admin ? `<button class="conf-kick" onclick='UI.kickFromSession(${sessionArg(s.id)},${JSON.stringify(p)})' aria-label="Remover ${escapeHTML(p)}">✕</button>` : ''}
              </div>`).join('')}
           </div>`
        : `<p style="color:var(--muted);font-size:12px;margin-top:8px">Nenhuma confirmação ainda.</p>`;

      // Botão de sorteio (admin, quando tem jogadores suficientes)
      const drawLabel = hasEnough ? '🎲 Criar sala' : '🎲 Sortear times';
      const drawBtn = admin && (hasEnough || fmt)
        ? `<button class="btn ${hasEnough ? 'btn-primary' : 'btn-ghost'} btn-sm"` +
            (hasEnough ? ` onclick='UI.drawFromSession(${sessionArg(s.id)})'` : '') +
            `${hasEnough ? '' : ` disabled title="Faltam ${needed - confirmed.length} jogadores"`}>${drawLabel}</button>`
        : '';

      // Botão Finalizar (admin, após sorteio)
      const finishBtn = admin && s.teams && s.teams.length > 0
        ? `<button class="btn btn-accent btn-sm" onclick='UI.openFinishMatchModal(${sessionArg(s.id)})'>🏁 Finalizar</button>`
        : '';

      return `<div class="session-card">
        <div class="session-head">
          <div>
            <div class="session-name">${escapeHTML(s.eventName || 'Partida')} ${fmtBadge}</div>
            <div class="session-date">📅 ${dateStr} · ${vagasTxt}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${admin ? `<button class="btn btn-ghost btn-sm" onclick='UI.adminAddToSession(${sessionArg(s.id)})'>+ Adicionar</button>` : ''}
            ${admin ? `<button class="btn btn-ghost btn-sm" onclick='UI.deleteSession(${sessionArg(s.id)})'>🗑</button>` : ''}
          </div>
        </div>

        ${myStatus}
        ${listHTML}

        <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
          ${(!myConf && !admin && !isFull)
            ? `<button class="btn btn-primary btn-sm" onclick='UI.confirmPresence(${sessionArg(s.id)})'>✅ Confirmar presença</button>`
            : ''}
          ${(!myConf && !admin && isFull)
            ? `<button class="btn btn-secondary btn-sm" disabled>Sala cheia</button>`
            : ''}
          <button class="btn btn-ghost btn-sm" onclick='UI.copySessionLink(${sessionArg(s.id)})'>🔗 Copiar convite</button>
          <button class="btn btn-ghost btn-sm" onclick='UI.shareSession(${sessionArg(s.id)})'>📤 WhatsApp</button>
          ${drawBtn}
          ${finishBtn}
        </div>
      </div>`;
    }).join('');
  };

  const renderMatchHistory = () => {
    const wrap    = $('match-history');
    const matches = Storage.getMatches();
    if (!wrap) return;
    if (matches.length === 0) {
      wrap.innerHTML = `<p style="color:var(--muted);font-size:13px;padding:20px 0">Nenhuma partida registrada.</p>`;
      return;
    }
    wrap.innerHTML = matches.slice(0, 20).map(m => {
      const dateStr = new Date(m.date || m.createdAt).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });
      const winTeam = m.teams?.[m.winner];
      return `<div class="match-row">
        <div class="match-row-head">
          <span class="match-row-name">${m.eventName || 'Partida'}</span>
          <span class="match-row-date">${dateStr}</span>
          ${Storage.isAdmin() ? `<button class="btn btn-ghost btn-sm" onclick="UI.deleteMatch(${m.id})">🗑</button>` : ''}
        </div>
        <div class="match-row-body">
          ${m.teams?.map((t, i) => `
            <div class="match-team-pill ${i === m.winner ? 'match-team-won' : ''}">
              ${i === m.winner ? '🏆 ' : ''}Time ${i+1}: ${t.join(', ')}
            </div>`).join('') || ''}
          ${m.mvp ? `<div class="mvp-pill">⭐ MVP: ${m.mvp}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  };

  const createSession = async () => {
    if (!Storage.isAdmin()) { toast('⚠️ Apenas admin pode criar sessões', 'warn'); return; }
    const name    = $('session-name')?.value.trim() || '';
    const dateVal = $('session-date')?.value;
    const format  = $('session-format')?.value || '';
    if (!dateVal) { toast('⚠️ Informe a data/hora', 'warn'); return; }
    const btn = $('btn-create-session');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Criando...'; }
    try {
      await DB.addSession({
        eventName: name,
        scheduledAt: new Date(dateVal).getTime(),
        format: format || null,
      });
      $('session-name').value = '';
      // reset date field to now so admin doesn't have to re-enter
      const dateInput = $('session-date');
      if (dateInput) {
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        dateInput.value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}` +
                          `T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      }
      toast('📅 Sala criada!');
      // Firebase listener atualiza automaticamente; fallback precisa renderizar
      if (DB.isUsingFallback()) renderSessions();
    } catch(e) {
      toast('❌ Erro ao criar: ' + e.message, 'err');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📅 Criar sala'; }
    }
  };

  // ── Sortear times a partir dos confirmados ────────────────────────────────
  const drawFromSession = async (sessionId) => {
    if (!Storage.isAdmin()) return;
    const session = DB.getSession(sessionId);
    if (!session) return;

    const confirmed = [...(session.confirmed || [])];
    const fmt = FORMATS[session.format];

    // Embaralhar
    for (let i = confirmed.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [confirmed[i], confirmed[j]] = [confirmed[j], confirmed[i]];
    }

    let teams, extras = [];

    if (fmt) {
      // Pega exatamente os jogadores necessários, o resto vira reserva
      const playing = confirmed.slice(0, fmt.players);
      extras = confirmed.slice(fmt.players);
      teams = [];
      for (let i = 0; i < fmt.teams; i++) {
        teams.push(playing.slice(i * fmt.perTeam, (i + 1) * fmt.perTeam));
      }
    } else {
      // Sem formato definido: divide em 2 times iguais
      const half = Math.floor(confirmed.length / 2);
      teams = [confirmed.slice(0, half), confirmed.slice(half)];
    }

    // Mostrar resultado num modal
    const modal = $('modal-draw-result');
    const body  = $('draw-result-body');
    if (!modal || !body) return;

    const tcs = ['tc0','tc1','tc2','tc3','tc4','tc5'];
    body.innerHTML = `
      <div style="margin-bottom:16px">
        <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:16px;color:var(--white);margin-bottom:4px">
          ${session.eventName || 'Partida'} ${fmt ? `· <span class="format-badge">${fmt.label}</span>` : ''}
        </div>
        <div style="font-size:12px;color:var(--muted)">Sorteio realizado agora</div>
      </div>
      ${teams.map((team, i) => `
        <div class="team-block ${tcs[i % 6]}" style="margin-bottom:10px">
          <div class="team-block-label">
            <div class="team-dot"></div>
            Time ${i + 1}
          </div>
          <div class="team-members">
            ${team.map(p => `<div class="team-member">${p}</div>`).join('')}
          </div>
        </div>`).join('')}
      ${extras.length > 0 ? `
        <div style="margin-top:12px;padding:12px;background:rgba(255,255,255,0.03);border:1px solid var(--border2);border-radius:12px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:8px">⏳ Reservas</div>
          <div class="team-members">${extras.map(p => `<div class="team-member">${p}</div>`).join('')}</div>
        </div>` : ''}
    `;

    // Montar mensagem pra WA
    const date = new Date().toLocaleDateString('pt-BR');
    const slotEmojis = ['🟢','🔴','🔵','🟡','🟣','🟠','⚪','🟤'];
    let msg = '';
    if (session.eventName) msg += `🏆 *${session.eventName}*\n`;
    msg += `🔫 *SORTEIO DE TIMES — ${date}*\n${'━'.repeat(26)}\n\n`;
    teams.forEach((team, i) => {
      msg += `${slotEmojis[i % slotEmojis.length]} *Slot ${i + 1}* — ${team.length} jogador${team.length !== 1 ? 'es' : ''}\n`;
      team.forEach((p, idx) => { msg += `  🎮 *${idx + 1}.* ${p}\n`; });
      msg += '\n';
    });
    if (extras.length > 0) {
      msg += `⏳ *Reservas*\n`;
      extras.forEach(p => { msg += `  • ${p}\n`; });
      msg += '\n';
    }
    const rules = typeof Sorteio.getRulesText === 'function' ? Sorteio.getRulesText() : '';
    if (rules) msg += `${'─'.repeat(26)}\n${rules}\n`;

    const previewEl = $('draw-result-preview');
    if (previewEl) previewEl.textContent = msg;

    modal.classList.remove('hidden');

    // Salvar times na sessão para o botão Finalizar
    try { await DB.updateSession(sessionId, { teams }); } catch(e) {}
    if (DB.isUsingFallback()) renderSessions();
  };

  // Membro confirma presença pela primeira vez
  const confirmPresence = (sessionId) => {
    // if database cache isn't ready yet delay the operation; we need the
    // session object to exist so addConfirmed can actually write it.
    if (!DB.isReady()) {
      DB.onReady(() => confirmPresence(sessionId));
      return;
    }
    // store-level nick, if present we auto‑prompt
    const stored = Storage.getMyNick();
    const session = DB.getSession(sessionId);
    const fmt = FORMATS[session?.format] || null;
    const needed = fmt ? fmt.players : 2;
    if (session && (session.confirmed || []).length >= needed) {
      toast('⚠️ Sala já está cheia');
      return;
    }

    if (stored) {
      // quick confirm dialog
      if (!confirm(`Confirmar presença como ${stored}?`)) return;
      // go ahead and addConfirmed
      DB.addConfirmed(sessionId, stored).then(ok => {
        if (ok) {
          Storage.setMyConfirmation(sessionId, { nick: stored, edited: false });
          Players.autoRegister(stored);
          toast(`✅ ${stored} confirmado!`);
          if (DB.isUsingFallback()) renderSessions();
        } else {
          toast('⚠️ Não foi possível confirmar presença – sessão não encontrada ou já confirmada', 'warn');
        }
      }).catch(e => toast('❌ Erro: ' + e.message, 'err'));
      return;
    }

    // no stored nick, ask via modal (legacy behaviour)
    const modal = $('modal-confirm');
    if (!modal) return;
    modal.dataset.sessionId = sessionId;
    modal.dataset.mode = 'confirm';
    $('confirm-modal-title').textContent = '✅ Confirmar presença';
    $('confirm-nick-input').value = '';
    $('confirm-nick-input').placeholder = 'Seu nick exato no Free Fire';
    $('confirm-hint').textContent = 'Você poderá corrigir o nick uma única vez após confirmar.';
    modal.classList.remove('hidden');
    $('confirm-nick-input').focus();
  };

  // Membro edita o próprio nick (uma única vez)
  const editMyPresence = (sessionId) => {
    const myConf = Storage.getMyConfirmation(sessionId);
    if (!myConf || myConf.edited) { toast('⚠️ Edição não disponível', 'warn'); return; }

    const modal = $('modal-confirm');
    if (!modal) return;
    modal.dataset.sessionId = sessionId;
    modal.dataset.mode = 'edit';
    modal.dataset.oldNick = myConf.nick;
    $('confirm-modal-title').textContent = '✏️ Corrigir nick';
    $('confirm-nick-input').value = myConf.nick;
    $('confirm-nick-input').placeholder = 'Novo nick correto';
    $('confirm-hint').textContent = '⚠️ Após salvar, não será possível alterar novamente.';
    modal.classList.remove('hidden');
    $('confirm-nick-input').focus();
  };

  // Submete o modal de confirmação (serve pra confirm e edit)
  const submitConfirmModal = async () => {
    const modal     = $('modal-confirm');
    const sessionId = modal.dataset.sessionId;
    const mode      = modal.dataset.mode;
    const nick      = $('confirm-nick-input').value.trim();

    if (!nick) { toast('⚠️ Digite seu nick', 'warn'); return; }
    if (nick.length < 2 || nick.length > 40) { toast('⚠️ Nick inválido', 'warn'); return; }

    const session = DB.getSession(sessionId);
    if (!session) { toast('Sessão não encontrada', 'err'); return; }

    const btn2 = $('btn-submit-confirm');
    if (btn2) { btn2.disabled = true; btn2.textContent = '⏳ Salvando...'; }
    try {
      if (mode === 'confirm') {
        // respect capacity again just before sending to DB (race condition)
        const fmt = FORMATS[session.format] || null;
        const needed = fmt ? fmt.players : 2;
        if ((session.confirmed || []).length >= needed) {
          toast('⚠️ Sala já está cheia');
          return;
        }
        if ((session.confirmed || []).some(n => n.toLowerCase() === nick.toLowerCase())) {
          toast('⚠️ Esse nick já está confirmado!', 'warn'); return;
        }
        {
          const ok = await DB.addConfirmed(sessionId, nick);
          if (!ok) {
            toast('⚠️ Não foi possível confirmar presença – sessão não encontrada ou já confirmada', 'warn');
            return;
          }
        }
        Storage.setMyConfirmation(sessionId, { nick, edited: false });
        // persist nick for future visits
        if (!Storage.getMyNick()) Storage.setMyNick(nick);
        // auto-criar perfil se não existir
        Players.autoRegister(nick);
        toast(`✅ ${nick} confirmado!`);
      } else {
        const oldNick = modal.dataset.oldNick;
        await DB.replaceConfirmed(sessionId, oldNick, nick);
        Storage.setMyConfirmation(sessionId, { nick, edited: true });
        toast(`✏️ Nick atualizado para ${nick}`);
      }
      modal.classList.add('hidden');
      if (DB.isUsingFallback()) renderSessions();
    } catch(e) {
      toast('❌ Erro ao salvar: ' + e.message, 'err');
    } finally {
      if (btn2) { btn2.disabled = false; btn2.textContent = '✅ Confirmar'; }
    }
  };

  const closeConfirmModal = () => $('modal-confirm')?.classList.add('hidden');

  // Admin: remove jogador da lista
  const kickFromSession = async (sessionId, nick) => {
    if (!Storage.isAdmin()) return;
    if (!window.confirm(`Remover "${nick}" da sessão?`)) return;
    try {
      await DB.removeConfirmed(sessionId, nick);
      toast(`🚫 ${nick} removido`);
      if (DB.isUsingFallback()) renderSessions();
    } catch(e) {
      toast('❌ Erro: ' + e.message, 'err');
    }
  };

  // Admin: adiciona jogador manualmente
  const adminAddToSession = async (sessionId) => {
    if (!Storage.isAdmin()) return;
    const nick = window.prompt('Nick do jogador a adicionar:');
    if (!nick?.trim()) return;
    const session = DB.getSession(sessionId);
    if (!session) return;
    // enforce capacity when admin manually adds
    const fmt = FORMATS[session.format] || null;
    const needed = fmt ? fmt.players : Infinity;
    if ((session.confirmed || []).length >= needed) {
      toast('⚠️ Sala já está cheia');
      return;
    }
    if ((session.confirmed || []).some(n => n.toLowerCase() === nick.trim().toLowerCase())) {
      toast('⚠️ Nick já está na lista', 'warn'); return;
    }
    try {
      await DB.addConfirmed(sessionId, nick.trim());
      toast(`✅ ${nick.trim()} adicionado`);
      if (DB.isUsingFallback()) renderSessions();
    } catch(e) {
      toast('❌ Erro: ' + e.message, 'err');
    }
  };

  const copySessionLink = (sessionId) => {
    // include both query param and hash to improve link recognition in chat apps
    // origin will be "null" when running from file://, which produces a
    // broken link. fall back to using the full href in that case.
    let urlBase;
    if (!window.location.origin || window.location.origin === 'null' || window.location.origin.startsWith('file')) {
      urlBase = window.location.href.split('#')[0].split('?')[0];
    } else {
      urlBase = `${window.location.origin}${window.location.pathname}`;
    }
    const url = `${urlBase}?room=${encodeURIComponent(sessionId)}`;
    navigator.clipboard.writeText(url).then(() => toast('🔗 Link copiado! Mande pro grupo.')).catch(() => toast('Copie: ' + url));
  };

  const shareSession = (sessionId) => {
    let urlBase;
    if (!window.location.origin || window.location.origin === 'null' || window.location.origin.startsWith('file')) {
      urlBase = window.location.href.split('#')[0].split('?')[0];
    } else {
      urlBase = `${window.location.origin}${window.location.pathname}`;
    }
    const url = `${urlBase}?room=${encodeURIComponent(sessionId)}`;
    const text = `Participe da sala: ${url}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };

  const deleteSession = async (id) => {
    if (!window.confirm('Deletar sessão?')) return;
    try {
      await DB.deleteSession(id);
      toast('🗑 Sessão removida');
      if (DB.isUsingFallback()) renderSessions();
    } catch(e) {
      toast('❌ Erro: ' + e.message, 'err');
    }
  };

  const deleteMatch = (id) => {
    if (!confirm('Deletar partida do histórico?')) return;
    DB.deleteMatch(id).catch(()=>{});
    renderMatchHistory();
    toast('🗑 Partida removida');
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  TAB: RANK
  // ══════════════════════════════════════════════════════════════════════════
  const renderRankTab = () => {
    const wrap = $('rank-content');
    if (!wrap) return;

    const players = Players.getList();
    if (players.length === 0) {
      wrap.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:13px;padding:12px 0">Nenhum jogador cadastrado ainda.</p></div>`;
      return;
    }

    const now   = Date.now();
    const WEEK  = 7  * 24 * 60 * 60 * 1000;
    const MONTH = 30 * 24 * 60 * 60 * 1000;
    const medals = ['🥇','🥈','🥉'];

    const buildLeaderboard = (since) => {
      const rows = players.map(p => {
        const s = Players.getStatsInPeriod(p.nick, since);
        return s ? { ...p, ...s } : null;
      }).filter(Boolean)
        .filter(p => since === 0 ? (p.pts > 0) : (p.total > 0))
        .sort((a, b) => b.pts - a.pts)
        .slice(0, 10);

      if (rows.length === 0) {
        return `<p style="color:var(--muted);font-size:13px;padding:12px 0">Sem partidas no período.</p>`;
      }

      return rows.map((p, i) => `
        <div class="rank-row ${i < 3 ? 'rank-top-'+i : ''}" onclick="UI.openProfile('${p.nick}')">
          <div class="rank-pos">${medals[i] || `#${i+1}`}</div>
          <div class="rank-avatar-sm">${p.nick.charAt(0).toUpperCase()}</div>
          <div class="rank-info">
            <div class="rank-nick">${p.nick}</div>
            <div class="rank-badge-sm">${p.rank || 'Bronze'}</div>
          </div>
          <div class="rank-nums">
            <span class="rank-pts-big">${p.pts}pts</span>
            <span class="rank-sub">${p.wins}V · ${p.mvps}MVP · ${p.winrate}%WR</span>
          </div>
        </div>`).join('');
    };

    wrap.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div class="card-title"><div class="card-icon">🗓</div>Melhores da Semana</div>
        </div>
        <div class="rank-list">${buildLeaderboard(now - WEEK)}</div>
      </div>
      <div class="card">
        <div class="card-head">
          <div class="card-title"><div class="card-icon">📅</div>Melhores do Mês</div>
        </div>
        <div class="rank-list">${buildLeaderboard(now - MONTH)}</div>
      </div>
      <div class="card">
        <div class="card-head">
          <div class="card-title"><div class="card-icon">🏆</div>Ranking da Season</div>
          <span style="font-size:11px;color:var(--muted)">pontos acumulados</span>
        </div>
        <div class="rank-list">${buildLeaderboard(0)}</div>
      </div>`;
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  TAB: PERFIL
  // ══════════════════════════════════════════════════════════════════════════
  const renderPerfilTab = () => {
    const wrap = $('perfil-content');
    if (!wrap) return;
    const myNick = Storage.getMyNick();
    if (!myNick) {
      wrap.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:13px;padding:12px 0">Defina seu nick na aba <b>Jogadores</b> para ver seu perfil aqui.</p></div>`;
      return;
    }
    const html = Players.renderProfile(myNick);
    if (!html) {
      wrap.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:13px;padding:12px 0">Nick "<b>${myNick}</b>" não está cadastrado ainda. Peça ao admin para te cadastrar.</p></div>`;
      return;
    }
    wrap.innerHTML = `<div class="card profile-card">${html}</div>`;
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  MODAL: Finalizar Partida
  // ══════════════════════════════════════════════════════════════════════════
  const openFinishMatchModal = (sessionId) => {
    if (!Storage.isAdmin()) return;
    const session = DB.getSession(sessionId);
    if (!session) return;
    const teams = session.teams || [];
    if (teams.length === 0) { toast('⚠️ Sortear os times primeiro', 'warn'); return; }

    const modal     = $('modal-finish-match');
    const winnerSel = $('finish-winner-sel');
    const mvpSel    = $('finish-mvp-sel');
    if (!modal || !winnerSel || !mvpSel) return;

    winnerSel.innerHTML = teams.map((_, i) => `<option value="${i}">Time ${i + 1}</option>`).join('');
    const all = teams.flat();
    mvpSel.innerHTML = `<option value="">— Sem MVP —</option>` +
      all.map(p => `<option value="${p}">${p}</option>`).join('');

    modal.dataset.sessionId = sessionId;
    modal.classList.remove('hidden');
  };

  const confirmFinishMatch = async () => {
    const modal     = $('modal-finish-match');
    const sessionId = modal.dataset.sessionId;
    const session   = DB.getSession(sessionId);
    if (!session || !session.teams) { modal.classList.add('hidden'); return; }

    const winnerIdx = parseInt($('finish-winner-sel')?.value ?? '0');
    const mvpNick   = $('finish-mvp-sel')?.value || null;
    const cfg       = Storage.getScoringConfig();
    const now       = Date.now();

    await DB.addMatch({
      eventName: session.eventName || 'Partida',
      teams:     session.teams.map(t => [...t]),
      winner:    winnerIdx, mvp: mvpNick || null, date: now, sessionId,
    });

    session.teams.forEach((team, ti) => {
      const won = ti === winnerIdx;
      team.forEach(nick => {
        // Auto-criar perfil se não existir
        Players.autoRegister(nick);
        Players.recordMatch(nick, { won, mvp: nick === mvpNick, matchDate: now });
        if (won)              Storage.addPoints(nick, cfg.pointsPerWin || 10);
        if (nick === mvpNick) Storage.addPoints(nick, cfg.pointsPerMvp || 15);
        // Sync pontos pro Firebase
        DB.upsertPlayer(nick, Storage.getPlayer(nick)).catch(()=>{});
      });
    });

    modal.classList.add('hidden');
    await DB.updateSession(sessionId, { status:'closed', closedAt:now });
    toast('✅ Partida finalizada e resultado salvo!');
    renderPartidasTab();
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  MODAL: Configurar Pontuação (admin)
  // ══════════════════════════════════════════════════════════════════════════
  const openScoringConfigModal = () => {
    const modal = $('modal-scoring-config');
    if (!modal) return;
    const cfg = Storage.getScoringConfig();

    const winEl = $('scoring-points-win');
    const mvpEl = $('scoring-points-mvp');
    if (winEl) winEl.value = cfg.pointsPerWin;
    if (mvpEl) mvpEl.value = cfg.pointsPerMvp;

    const container = $('scoring-ranks-container');
    if (container) {
      container.innerHTML = cfg.ranks.map((rank, i) => `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
          <input type="text"   class="field-sm" style="flex:2" value="${rank.name}"      id="scoring-rank-name-${i}" placeholder="Rank">
          <input type="number" class="field-sm" style="flex:1" value="${rank.minPoints}" id="scoring-rank-min-${i}"  placeholder="Min pts" ${i===0?'disabled':''}>
        </div>`).join('');
    }
    modal.classList.remove('hidden');
  };

  const closeScoringConfigModal = () => $('modal-scoring-config')?.classList.add('hidden');

  const saveScoringConfig = () => {
    const cfg = Storage.getScoringConfig();
    const win = parseInt($('scoring-points-win')?.value) || 10;
    const mvp = parseInt($('scoring-points-mvp')?.value) || 15;
    const ranks = cfg.ranks.map((r, i) => ({
      name:      $(`scoring-rank-name-${i}`)?.value.trim() || r.name,
      minPoints: i === 0 ? 0 : parseInt($(`scoring-rank-min-${i}`)?.value) || r.minPoints,
    }));
    Storage.setScoringConfig({ pointsPerWin: win, pointsPerMvp: mvp, ranks });
    closeScoringConfigModal();
    toast('✅ Configuração salva!');
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  TAB: JOGADORES
  // ══════════════════════════════════════════════════════════════════════════
  let profileNick = null;

  const renderJogadoresTab = () => {
    const wrap = $('jogadores-content');
    if (!wrap) return;

    if (profileNick) {
      const html = Players.renderProfile(profileNick);
      wrap.innerHTML = `<div class="card profile-card">${html}</div>`;
      return;
    }

    const list = Players.getList();
    const adminActions = Storage.isAdmin() ? `
      <button class="btn btn-ghost btn-sm" onclick="UI.openRegisterModal()">+ Cadastrar</button>` : '';

    // show current user's stored nick with edit option
    let myNickHtml = '';
    const myNick = Storage.getMyNick();
    if (myNick) {
      const edits = Storage.getNickEdits();
      myNickHtml = `<div style="margin-bottom:12px">
          <strong>Seu nick:</strong> ${myNick}
          ${edits < 2 ? `<button class="btn btn-ghost btn-sm" style="margin-left:8px" onclick="UI.promptEditNick()">Editar (${2-edits} restantes)</button>` : ''}
        </div>`;
    } else {
      myNickHtml = `<div style="margin-bottom:12px">
          <button class="btn btn-ghost btn-sm" onclick="UI.promptEditNick()">Definir meu nick</button>
        </div>`;
    }

    wrap.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div class="card-title"><div class="card-icon">👤</div> Jogadores</div>
          <div style="display:flex;gap:8px">
            ${adminActions}
            <button class="btn btn-ghost btn-sm" onclick="UI.openInviteModal()">🔗 Gerar convite</button>
          </div>
        </div>
        ${myNickHtml}
        ${list.length === 0
          ? `<p style="color:var(--muted);font-size:13px;padding:12px 0">Nenhum jogador cadastrado. Clique em "+ Cadastrar" ou gere um link de convite.</p>`
          : `<div class="players-table">
              ${list.map(p => {
                const stats = Players.getStats(p.nick);
                const wrColor = stats.winrate >= 60 ? 'var(--green)' : stats.winrate >= 40 ? 'var(--accent)' : 'var(--red)';
                return `<div class="player-row" onclick="UI.openProfile('${p.nick}')">
                  <div class="player-avatar">${p.nick.charAt(0).toUpperCase()}</div>
                  <div class="player-row-info">
                    <div class="player-row-nick">${p.nick}</div>
                    <div class="player-row-rank">${p.rank || 'Bronze'}</div>
                  </div>
                  <div class="player-row-stats">
                    <span style="color:${wrColor}">${stats.winrate}% WR</span>
                    <span style="color:var(--muted);font-size:11px">${stats.total}j</span>
                    ${(p.achievements||[]).length > 0 ? `<span title="${(p.achievements||[]).length} conquistas">🏅×${(p.achievements||[]).length}</span>` : ''}
                  </div>
                </div>`;
              }).join('')}
            </div>`
        }
      </div>`;
  };

  const openProfile = (nick) => {
    profileNick = nick;
    renderJogadoresTab();
  };

  const deletePlayer = (nick) => {
    if (!Storage.isAdmin()) return;
    if (!confirm(`Deletar ${nick}? Isso não remove o histórico de partidas.`)) return;
    DB.deletePlayer(nick).catch(()=>{});
    profileNick = null;
    renderJogadoresTab();
    toast('🗑 Jogador removido');
  };

  const openRegisterModal = () => {
    const modal = $('modal-register');
    if (!modal) return;
    // Pré-preencher com nick salvo do dispositivo
    const saved = Storage.getMyNick();
    const nickInput = $('reg-nick');
    if (nickInput && saved && !nickInput.value) nickInput.value = saved;
    modal.classList.remove('hidden');
    if (!saved) nickInput?.focus();
  };

  const closeRegisterModal = () => {
    $('modal-register')?.classList.add('hidden');
  };

  const doRegister = () => {
    const nick = $('reg-nick')?.value.trim();
    if (!nick) { toast('⚠️ Informe o nick', 'warn'); return; }
    if (Players.register(nick)) {
      // Salvar nick do dispositivo se ainda não tem
      if (!Storage.getMyNick()) Storage.setMyNick(nick);
      toast(`✅ ${nick} cadastrado!`);
      closeRegisterModal();
      renderJogadoresTab();
    } else {
      toast('⚠️ Nick já cadastrado', 'warn');
    }
  };

  const openInviteModal = () => {
    const modal = $('modal-invite');
    if (modal) modal.classList.remove('hidden');
  };

  const closeInviteModal = () => $('modal-invite')?.classList.add('hidden');

  const generateInviteLink = () => {
    const nick = $('invite-nick')?.value.trim();
    const rank = $('invite-rank')?.value || 'Bronze';
    if (!nick) { toast('⚠️ Informe o nick', 'warn'); return; }
    const url  = `${location.href.split('#')[0]}#invite=${encodeURIComponent(nick)}:${encodeURIComponent(rank)}`;
    const out  = $('invite-link-out');
    if (out) { out.value = url; out.classList.remove('hidden'); }
    navigator.clipboard.writeText(url).then(() => toast('🔗 Link copiado!')).catch(() => {});
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  TAB: TORNEIO
  // ══════════════════════════════════════════════════════════════════════════
  const renderTournamentStats = () => {
    const { ranking, overallMvps, topKillers } = Tournament.getStats();
    if (!ranking.length) return '';
    const hasResults = ranking.some(player => player.matches > 0);
    return `
      <div class="tournament-live-stats">
        <div class="card tournament-ranking-card">
          <div class="card-head"><div class="card-title"><div class="card-icon">🎯</div> Ranking geral de kills</div><span class="live-pill">● AO VIVO</span></div>
          ${hasResults ? `<div class="kill-ranking-list">${ranking.map((player,index)=>`
            <div class="kill-ranking-row ${index===0?'kill-ranking-leader':''}">
              <span class="kill-ranking-position">${index+1}.</span><strong>${escapeHTML(player.name)}</strong>
              <span>${player.kills} ${player.kills===1?'kill':'kills'}</span>
            </div>`).join('')}</div>` : '<p class="tournament-awaiting">O ranking aparecerá após o primeiro resultado.</p>'}
        </div>
        <div class="tournament-highlights">
          <div class="tournament-highlight"><span>🔥</span><small>Mais kills até agora</small><strong>${topKillers.length ? topKillers.map(p=>escapeHTML(p.name)).join(', ') : 'Aguardando resultados'}</strong>${topKillers.length?`<b>${topKillers[0].kills} kills</b>`:''}</div>
          <div class="tournament-highlight"><span>⭐</span><small>MVP geral</small><strong>${overallMvps.length ? overallMvps.map(p=>escapeHTML(p.name)).join(', ') : 'Aguardando resultados'}</strong>${overallMvps.length?`<b>${overallMvps[0].mvps} ${overallMvps[0].mvps===1?'MVP':'MVPs'}</b>`:''}</div>
        </div>
      </div>`;
  };

  const renderTorneioTab = () => {
    const wrap = $('torneio-content');
    if (!wrap) return;

    const saved = Tournament.load();
    let setupHtml = '';

    if (!saved && Storage.isAdmin()) {
      const lastTeams = Sorteio.getTeams();
      const teamOptions = lastTeams.length >= 2
        ? `<button class="btn btn-ghost btn-full" onclick="UI.startTournamentFromSorteio()">🎲 Usar times aleatórios do último sorteio</button>`
        : `<button class="btn btn-ghost btn-full" disabled title="Faça um sorteio de times primeiro">🎲 Usar times aleatórios do último sorteio</button>`;
      setupHtml = `
        <div class="card">
          <div class="card-head">
            <div class="card-title"><div class="card-icon">🏆</div> Novo Torneio</div>
          </div>
          <div class="tournament-mode-grid">
            <div class="tournament-mode-card tournament-mode-card-active">
              <span class="tournament-mode-icon">✍️</span>
              <div>
                <strong>Participantes prontos</strong>
                <p>Você define os jogadores ou times. Somente os confrontos serão aleatórios.</p>
              </div>
            </div>
            <div class="tournament-mode-card">
              <span class="tournament-mode-icon">🎲</span>
              <div>
                <strong>Times aleatórios</strong>
                <p>Usa os times montados anteriormente na aba Sorteio.</p>
              </div>
            </div>
          </div>
          <div class="manual-tournament-box">
            <label class="field-label">Formato do torneio</label>
            <div class="tournament-format-group" id="tournament-format-group">
              <label class="format-opt"><input type="radio" name="tournament-format" value="1" checked><span>Solo</span></label>
              <label class="format-opt"><input type="radio" name="tournament-format" value="2"><span>Duo</span></label>
              <label class="format-opt"><input type="radio" name="tournament-format" value="3"><span>3v3</span></label>
              <label class="format-opt"><input type="radio" name="tournament-format" value="4"><span>Squad</span></label>
            </div>
            <label class="field-label" style="margin-top:16px">Nome das equipes</label>
            <div class="tournament-name-mode">
              <label class="format-opt"><input type="radio" name="tournament-name-mode" value="auto" checked><span>Automático</span></label>
              <label class="format-opt"><input type="radio" name="tournament-name-mode" value="manual"><span>Manual</span></label>
            </div>
            <div class="team-editor-head">
              <div><label class="field-label">Equipes cadastradas</label><p class="field-help" id="tournament-format-help">Informe os participantes separados por vírgula.</p></div>
              <button class="btn btn-ghost btn-sm" onclick="UI.addTournamentTeam()">+ Adicionar equipe</button>
            </div>
            <div class="tournament-team-editor" id="tournament-team-editor"></div>
            <button class="btn btn-primary btn-full" onclick="UI.startTournamentManual()">⚡ Sortear confrontos</button>
          </div>
          <div class="tournament-or"><span>ou</span></div>
          <div>
            ${teamOptions}
          </div>
        </div>`;
    } else if (saved) {
      setupHtml = `
        <div class="card-head" style="margin-bottom:16px">
          <div class="card-title"><div class="card-icon">🏆</div> Torneio em andamento</div>
          ${Storage.isAdmin() ? '<button class="btn btn-ghost btn-sm" onclick="UI.resetTournament()">🗑 Zerar torneio</button>' : ''}
        </div>
        ${!Storage.isAdmin() ? `<p class="hint">💡 <span>Apenas o admin pode definir o vencedor de cada partida.</span></p>` : ''}`;
    } else {
      setupHtml = `<div class="card"><div class="empty-state"><div class="empty-icon">🏆</div><h3>Nenhum torneio ativo</h3><p>Quando o admin criar o chaveamento, ele aparecerá aqui automaticamente.</p></div></div>`;
    }

    wrap.innerHTML = `
      ${setupHtml}
      <div class="card" id="bracket-container">
        ${Tournament.render()}
      </div>
      ${saved ? renderTournamentStats() : ''}`;
    if (!saved && Storage.isAdmin()) renderTournamentTeamEditor(2);
  };

  const getTournamentTeamSize = () => parseInt(document.querySelector('input[name="tournament-format"]:checked')?.value || '1', 10);
  const getTeamEditorValues = () => [...document.querySelectorAll('.tournament-team-entry')].map(entry => ({
    name: entry.querySelector('.tournament-team-name')?.value || '',
    roster: entry.querySelector('.tournament-roster-input')?.value || '',
  }));
  const renderTournamentTeamEditor = (minimum = 2, values = null) => {
    const editor = $('tournament-team-editor'); if (!editor) return;
    const rows = values || Array.from({ length:minimum }, () => ({ name:'', members:[] }));
    editor.innerHTML = '';
    rows.forEach(value => addTournamentTeam(value));
    updateTournamentTeamNumbers();
  };
  const addTournamentTeam = (value = {}) => {
    const editor = $('tournament-team-editor'); if (!editor) return;
    const entry = document.createElement('div'); entry.className = 'tournament-team-entry';
    entry.innerHTML = `<div class="team-entry-title"><strong>Equipe</strong><button class="team-remove-btn" type="button" aria-label="Remover equipe">✕</button></div>
      <div class="manual-team-name-field hidden"><label class="field-label">Nome da equipe</label><input class="field-full tournament-team-name" maxlength="40" placeholder="Ex: Os Brabos"></div>
      <label class="field-label">Participantes</label><input class="field-full tournament-roster-input" maxlength="240" placeholder="Ryan, João">`;
    entry.querySelector('.tournament-team-name').value = value.name || '';
    entry.querySelector('.tournament-roster-input').value = value.roster || value.members?.join(', ') || '';
    entry.querySelector('.team-remove-btn').addEventListener('click', () => {
      if (editor.children.length <= 2) { toast('⚠️ O torneio precisa de pelo menos 2 equipes', 'warn'); return; }
      entry.remove(); updateTournamentTeamNumbers();
    });
    editor.appendChild(entry); updateTournamentTeamNumbers();
    updateTournamentNameMode();
  };
  const updateTournamentTeamNumbers = () => document.querySelectorAll('.tournament-team-entry .team-entry-title strong').forEach((el,i) => el.textContent=`Equipe ${i+1}`);
  const updateTournamentNameMode = () => {
    const manual = document.querySelector('input[name="tournament-name-mode"]:checked')?.value === 'manual';
    document.querySelectorAll('.manual-team-name-field').forEach(field => field.classList.toggle('hidden', !manual));
  };

  const startTournamentManual = async () => {
    if (!Storage.isAdmin()) { toast('⚠️ Apenas o admin pode criar o torneio', 'warn'); return; }
    const teamSize = getTournamentTeamSize();
    const manualNames = document.querySelector('input[name="tournament-name-mode"]:checked')?.value === 'manual';
    const values = getTeamEditorValues();
    const teams = [];
    for (let i = 0; i < values.length; i++) {
      const members = values[i].roster.split(',').map(name => name.trim()).filter(Boolean);
      if (members.length !== teamSize) { toast(`⚠️ A Equipe ${i + 1} precisa ter exatamente ${teamSize} ${teamSize === 1 ? 'participante' : 'participantes'}, separados por vírgula`, 'warn'); return; }
      const name = manualNames ? values[i].name.trim() : `Equipe ${members[0]}`;
      if (!name) { toast(`⚠️ Informe o nome da Equipe ${i + 1}`, 'warn'); return; }
      teams.push({ id:`team-${Date.now()}-${i}`, name, members });
    }
    if (teams.length % 2 !== 0) { toast('⚠️ Não é possível gerar os confrontos com uma quantidade ímpar de equipes. Adicione mais 1 equipe.', 'warn'); return; }
    const normalizedTeamNames = teams.map(team => team.name.toLocaleLowerCase('pt-BR'));
    if (new Set(normalizedTeamNames).size !== normalizedTeamNames.length) { toast('⚠️ Existem equipes com o mesmo nome', 'warn'); return; }
    const normalizedMembers = teams.flatMap(team => team.members).map(name => name.toLocaleLowerCase('pt-BR'));
    if (new Set(normalizedMembers).size !== normalizedMembers.length) {
      toast('⚠️ Existe um jogador repetido nas formações', 'warn'); return;
    }
    const formats = { 1:'Solo', 2:'Duo', 3:'3v3', 4:'Squad' };
    const bracket = Tournament.create(teams, { format:formats[teamSize], teamSize });
    try { await DB.saveTournament(bracket); }
    catch (e) { toast(`❌ Não foi possível publicar o torneio: ${e.message}`, 'err'); return; }
    renderTorneioTab();
    toast(`🏆 Torneio ${formats[teamSize]} criado com ${teams.length} equipes!`);
  };

  const startTournamentFromSorteio = async () => {
    if (!Storage.isAdmin()) { toast('⚠️ Apenas o admin pode criar o torneio', 'warn'); return; }
    const teams = Sorteio.getTeams();
    if (teams.length < 2) { toast('⚠️ Faça um sorteio primeiro', 'warn'); return; }
    if (teams.length % 2 !== 0) { toast('⚠️ O último sorteio tem uma quantidade ímpar de times', 'warn'); return; }
    const structuredTeams = teams.map((members,i)=>({id:`draw-team-${Date.now()}-${i}`,name:`Time ${i+1}`,members:[...members]}));
    const bracket = Tournament.create(structuredTeams,{format:'Times sorteados',teamSize:teams[0]?.length||1});
    try { await DB.saveTournament(bracket); }
    catch (e) { toast(`❌ Não foi possível publicar o torneio: ${e.message}`, 'err'); return; }
    renderTorneioTab();
    toast('🏆 Chaveamento criado!');
  };

  let tournamentResultTarget = null;
  const openTournamentResult = (roundIdx, matchIdx) => {
    if (!Storage.isAdmin()) { toast('⚠️ Apenas o admin pode registrar resultados', 'warn'); return; }
    const match = Tournament.getBracket()?.rounds?.[roundIdx]?.matches?.[matchIdx];
    if (!match) return;
    tournamentResultTarget = { roundIdx, matchIdx };
    const previousKills = new Map((match.result?.kills || []).map(entry => [entry.player.toLocaleLowerCase('pt-BR'), entry.kills]));
    const renderTeam = (team, side) => `<fieldset class="tournament-result-team">
      <legend>${escapeHTML(team.name)}</legend>
      ${(team.members || []).map(player => `<label class="tournament-kill-row"><span>${escapeHTML(player)}</span><input class="field-full tournament-kill-input" type="number" min="0" step="1" inputmode="numeric" data-player="${escapeHTML(player)}" value="${previousKills.get(player.toLocaleLowerCase('pt-BR')) ?? ''}" placeholder="Kills" required></label>`).join('')}
      <label class="tournament-winner-option"><input type="radio" name="tournament-winner" value="${side}" ${match.winner?.id===team.id?'checked':''}><span>🏆 ${escapeHTML(team.name)} venceu</span></label>
    </fieldset>`;
    $('tournament-result-title').textContent = match.result ? '✏️ Alterar resultado' : '⚔️ Registrar resultado';
    $('tournament-result-body').innerHTML = `<div class="tournament-result-grid">${renderTeam(match.t1,'t1')}${renderTeam(match.t2,'t2')}</div><p class="tournament-mvp-note">⭐ O MVP será definido automaticamente pelo maior número de kills da partida. Empates serão mantidos.</p>`;
    $('tournament-result-error')?.classList.add('hidden');
    $('modal-tournament-result')?.classList.remove('hidden');
  };

  const closeTournamentResult = () => {
    $('modal-tournament-result')?.classList.add('hidden');
    tournamentResultTarget = null;
  };

  const confirmTournamentResult = async () => {
    if (!Storage.isAdmin() || !tournamentResultTarget) return;
    const error = $('tournament-result-error');
    const inputs = [...document.querySelectorAll('#tournament-result-body .tournament-kill-input')];
    const invalid = inputs.find(input => input.value.trim()==='' || !Number.isInteger(Number(input.value)) || Number(input.value)<0);
    const side = document.querySelector('input[name="tournament-winner"]:checked')?.value;
    if (invalid || !side) {
      error.textContent = invalid ? 'Preencha as kills de todos os jogadores com números inteiros iguais ou maiores que zero.' : 'Selecione a equipe vencedora.';
      error.classList.remove('hidden');
      invalid?.focus();
      return;
    }
    const kills = inputs.map(input => ({ player:input.dataset.player, kills:Number(input.value) }));
    const { roundIdx, matchIdx } = tournamentResultTarget;
    const bracket = Tournament.setResult(roundIdx, matchIdx, side, kills);
    if (!bracket) { error.textContent = 'Não foi possível validar o resultado.'; error.classList.remove('hidden'); return; }
    const button = $('tournament-result-confirm'); button.disabled = true; button.textContent = 'Salvando…';
    try {
      await DB.saveTournament(bracket);
      closeTournamentResult();
      const champ = bracket.champion;
      toast(champ ? `👑 Campeão: ${champ.name}! 🎉` : '✅ Resultado publicado ao vivo!');
      renderTorneioTab();
    } catch (e) {
      error.textContent = `Não foi possível publicar: ${e.message}`; error.classList.remove('hidden');
    } finally { button.disabled = false; button.textContent = 'Confirmar resultado'; }
  };

  const pickWinner = (roundIdx, matchIdx) => openTournamentResult(roundIdx, matchIdx);

  const chooseDirectAdvance = async (roundIdx, teamId) => {
    if (!Storage.isAdmin()) { toast('⚠️ Apenas o admin pode escolher o avanço direto', 'warn'); return; }
    const bracket = Tournament.setDirectAdvance(roundIdx, teamId);
    if (!bracket) { toast('❌ Não foi possível aplicar o avanço direto', 'err'); return; }
    try { await DB.saveTournament(bracket); }
    catch (e) { toast(`❌ Não foi possível atualizar o chaveamento: ${e.message}`, 'err'); return; }
    toast('↗ Avanço direto definido manualmente'); renderTorneioTab();
  };

  const resetTournament = async () => {
    if (!Storage.isAdmin()) { toast('⚠️ Apenas o admin pode zerar o torneio', 'warn'); return; }
    if (!confirm('Zerar torneio?')) return;
    Tournament.reset();
    try { await DB.clearTournament(); }
    catch (e) { toast(`❌ Não foi possível zerar o torneio: ${e.message}`, 'err'); return; }
    renderTorneioTab();
    toast('🗑 Torneio zerado');
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  URL Hash (convites e sessões)
  // ══════════════════════════════════════════════════════════════════════════
  const handleHash = () => {
    // guard: postpone processing until DB cache is ready
    // when user arrives via a link we may call this before the realtime
    // listener has populated `_cache`. in that case `DB.getSession` returns
    // null (or addConfirmed returns false) and the confirmation would not
    // actually be written server‑side; previously the nick was still stored
    // locally which led to confusion. to avoid the race we reschedule
    // handleHash until the database becomes ready, and our confirm logic
    // now only stores the nick locally once the DB write succeeds.
    if (!DB.isReady()) {
      DB.onReady(handleHash);
      return;
    }
    // Novo formato canônico: ?room=ID. Formatos antigos continuam aceitos.
    let hash = location.hash.slice(1);
    const qp = new URLSearchParams(location.search);
    const roomParam = qp.get('room') || qp.get('session');
    if (roomParam) hash = 'session=' + roomParam;
    if (!hash) return;

    // Link de sessão: #session=ID
    if (hash.startsWith('session=')) {
      const sessionId = decodeURIComponent(hash.slice(8)).trim();
      if (!sessionId || !/^[A-Za-z0-9_-]{1,80}$/.test(sessionId)) {
        showTab('partidas'); toast('❌ Link de sala inválido.', 'err'); return;
      }

      // Muda pra aba de partidas e abre modal de confirmação
      setTimeout(() => {
        showTab('partidas');
        // Admin não precisa confirmar — mas se quiser testar como membro, pode
        // abrir em aba anônima. Aqui só abre o modal pra quem ainda não confirmou.
        const session = DB.getSession(sessionId);
        if (!session) { toast('❌ Esta sala não existe ou foi removida.', 'err'); return; }
        if (session.status === 'closed') { toast('⚠️ Esta sala já foi encerrada.', 'warn'); return; }
        const myConf = Storage.getMyConfirmation(sessionId);
        if (myConf) {
          toast(`ℹ️ Você já está confirmado como ${myConf.nick}`);
          return;
        }
        // Admin também pode confirmar presença (como jogador), então não bypassa
        confirmPresence(sessionId);
      }, 400);
    }

    // Convite de cadastro: #invite=Nick:Rank
    if (hash.startsWith('invite=')) {
      const parts = decodeURIComponent(hash.slice(7)).split(':');
      const nick  = parts[0];
      const rank  = parts[1] || 'Bronze';
      history.replaceState(null, '', location.pathname);
      if (nick) {
        setTimeout(() => {
          if (confirm(`Confirmar cadastro?\n\nNick: ${nick}\nRank: ${rank}`)) {
            if (Players.register(nick, rank)) toast(`✅ Bem-vindo, ${nick}!`);
            else toast(`ℹ️ ${nick} já está cadastrado`);
          }
        }, 500);
      }
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  Init & eventos
  // ══════════════════════════════════════════════════════════════════════════
  const init = () => {
    // Inicializa Firebase e registra callback de tempo real
    DB.setOnChange((scope) => {
      if (activeTab === 'partidas') renderSessions();
      if (scope === 'tournament' && activeTab === 'torneio') renderTorneioTab();
    });
    DB.init();
    DB.onReady(() => {
      if (activeTab === 'partidas') renderSessions();
    });

    renderAdminBtn();
    renderPool();
    handleHash();

    // Navegação
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });

    // Botão admin
    $('admin-btn')?.addEventListener('click', toggleAdmin);
    window.addEventListener('ff-auth-change', () => {
      renderAdminBtn();
      if (activeTab === 'partidas') renderSessions();
      if (activeTab === 'torneio') renderTorneioTab();
    });
    $('modal-admin-close')?.addEventListener('click', () => $('modal-admin')?.classList.add('hidden'));
    $('btn-admin-login')?.addEventListener('click', submitAdminLogin);
    $('admin-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitAdminLogin(); });
    $('tournament-result-close')?.addEventListener('click', closeTournamentResult);
    $('tournament-result-confirm')?.addEventListener('click', confirmTournamentResult);
    $('modal-tournament-result')?.addEventListener('click', e => { if (e.target === $('modal-tournament-result')) closeTournamentResult(); });

    document.addEventListener('change', e => {
      if (e.target?.name === 'tournament-name-mode') { updateTournamentNameMode(); return; }
      if (e.target?.name !== 'tournament-format') return;
      const size = parseInt(e.target.value, 10);
      const help = $('tournament-format-help');
      if (!help) return;
      const existing = getTeamEditorValues();
      const label = size === 1 ? 'Solo' : size === 2 ? 'Duo' : size === 3 ? '3v3' : 'Squad';
      help.textContent = `${label}: informe exatamente ${size} ${size === 1 ? 'participante' : 'participantes'} por equipe, separados por vírgula.`;
      renderTournamentTeamEditor(Math.max(2, existing.length), existing);
    });

    // ── Sorteio: step 1 ────────────────────────────────────────────────────
    $('btnParse')?.addEventListener('click', () => {
      const added = Sorteio.parseText($('pasteArea').value);
      $('pasteArea').value = '';
      renderPool();
      toast(added > 0 ? `✅ ${added} nome(s) adicionado(s)!` : '⚠️ Nenhum nome novo');
    });

    $('btnClear')?.addEventListener('click', () => {
      Sorteio.clearPlayers();
      $('pasteArea').value = '';
      renderPool();
    });

    $('btnAdd')?.addEventListener('click', () => {
      const input = $('addInput');
      const r = Sorteio.addPlayer(input.value);
      if (r.ok) { input.value = ''; renderPool(); }
      else toast(r.reason === 'dup' ? '⚠️ Nome já está na lista!' : '⚠️ Nome inválido', 'warn');
    });

    $('addInput')?.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const r = Sorteio.addPlayer($('addInput').value);
      if (r.ok) { $('addInput').value = ''; renderPool(); }
      else toast(r.reason === 'dup' ? '⚠️ Nome já está na lista!' : '⚠️ Nome inválido', 'warn');
    });

    $('btnToConfig')?.addEventListener('click', () => {
      if (Sorteio.getPlayers().length < 2) { toast('⚠️ Adicione pelo menos 2 jogadores!', 'warn'); return; }
      updateSummary();
      setStep(2);
    });

    // ── Sorteio: step 2 ────────────────────────────────────────────────────
    $('btnBack1')?.addEventListener('click', () => setStep(1));
    $('numTeams')?.addEventListener('input', updateSummary);
    $('modeSelect')?.addEventListener('change', updateSummary);
    $('btnDraw')?.addEventListener('click', doDraw);

    // ── Sorteio: step 3 ────────────────────────────────────────────────────
    $('btnBack2')?.addEventListener('click', () => setStep(2));
    $('btnResort')?.addEventListener('click', () => {
      const overlay = $('drawOverlay');
      if (overlay) overlay.classList.add('active');
      setTimeout(() => {
        const n    = Math.max(2, parseInt($('numTeams')?.value) || 2);
        const mode = $('modeSelect')?.value || 'balanced';
        Sorteio.draw(n, mode);
        renderResults();
        if (overlay) overlay.classList.remove('active');
        toast('🎲 Novo sorteio feito!');
      }, 700);
    });

    $('btnCopy')?.addEventListener('click', () => {
      const text = $('outputPreview')?.textContent;
      navigator.clipboard.writeText(text)
        .then(() => toast('✅ Copiado!'))
        .catch(() => { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); toast('✅ Copiado!'); });
    });

    $('btnWA')?.addEventListener('click', () => {
      window.open('https://wa.me/?text=' + encodeURIComponent($('outputPreview')?.textContent || ''), '_blank');
    });

    $('btnToResult')?.addEventListener('click', () => setStep(4));
    $('btnBack3')?.addEventListener('click', () => setStep(3));
    $('btnSaveResult')?.addEventListener('click', saveMatchResult);

    // ── Partidas ───────────────────────────────────────────────────────────
    $('btn-create-session')?.addEventListener('click', createSession);
    // ── Modal resultado do sorteio de sessão ──────────────────────────────
    $('draw-result-close')?.addEventListener('click', () => $('modal-draw-result')?.classList.add('hidden'));
    $('modal-draw-result')?.addEventListener('click', e => { if (e.target === $('modal-draw-result')) $('modal-draw-result').classList.add('hidden'); });
    $('draw-result-copy')?.addEventListener('click', () => {
      const text = $('draw-result-preview')?.textContent || '';
      navigator.clipboard.writeText(text).then(() => toast('✅ Copiado!')).catch(() => {});
    });
    $('draw-result-wa')?.addEventListener('click', () => {
      window.open('https://wa.me/?text=' + encodeURIComponent($('draw-result-preview')?.textContent || ''), '_blank');
    });
    $('modal-confirm-close')?.addEventListener('click', closeConfirmModal);
    $('btn-submit-confirm')?.addEventListener('click', submitConfirmModal);
    $('confirm-nick-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitConfirmModal(); });
    $('modal-confirm')?.addEventListener('click', e => { if (e.target === $('modal-confirm')) closeConfirmModal(); });

    // ── Jogadores: modais ──────────────────────────────────────────────────
    $('modal-register-close')?.addEventListener('click', closeRegisterModal);
    $('btn-do-register')?.addEventListener('click', doRegister);
    $('modal-invite-close')?.addEventListener('click', closeInviteModal);
    $('btn-gen-invite')?.addEventListener('click', generateInviteLink);

    // ── Modal: Finalizar partida ───────────────────────────────────────────
    $('modal-finish-close')?.addEventListener('click',  () => $('modal-finish-match')?.classList.add('hidden'));
    $('btn-cancel-finish')?.addEventListener('click',   () => $('modal-finish-match')?.classList.add('hidden'));
    $('btn-confirm-finish')?.addEventListener('click',  confirmFinishMatch);
    $('modal-finish-match')?.addEventListener('click', e => { if (e.target === $('modal-finish-match')) $('modal-finish-match').classList.add('hidden'); });

    // ── Modal: Configurar pontuação ────────────────────────────────────────
    $('modal-scoring-close')?.addEventListener('click',  closeScoringConfigModal);
    $('btn-cancel-scoring')?.addEventListener('click',   closeScoringConfigModal);
    $('btn-save-scoring')?.addEventListener('click',     saveScoringConfig);
    $('modal-scoring-config')?.addEventListener('click', e => { if (e.target === $('modal-scoring-config')) closeScoringConfigModal(); });

    // Função auxiliar para definir/editar nick global do dispositivo
    UI.promptEditNick = () => {
      const current = Storage.getMyNick();
      const edits = Storage.getNickEdits();
      if (edits >= 2 && current) {
        toast('⚠️ Você já usou as 2 edições de nick', 'warn');
        return;
      }
      const promptText = current
        ? `Seu nick atual é "${current}". Novo nick:`
        : 'Digite seu nick:';
      const n = window.prompt(promptText, current || '');
      if (!n) return;
      if (n.trim().length < 2) { toast('⚠️ Nick inválido', 'warn'); return; }
      Storage.setMyNick(n.trim());
      if (current && n.trim() !== current) Storage.incrementNickEdits();
      toast('✅ Nick salvo: ' + n.trim());
      renderJogadoresTab();
    };

    // Fechar modal ao clicar fora
    document.querySelectorAll('.modal-backdrop').forEach(m => {
      m.addEventListener('click', e => { if (e.target === m) { closeRegisterModal(); closeInviteModal(); } });
    });

    // global escape key handler to dismiss any overlay or modal that might
    // get stuck (helps when focus/lock issues are reported).
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        // hide all backdrops
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
        // also clear draw-overlay if somehow left active
        const ov = $('drawOverlay');
        if (ov) ov.classList.remove('active');
      }
    });
  };

  return {
    init, showTab,
    // sorteio
    removePlayer, updateSummary,
    // torneio
    startTournamentManual, startTournamentFromSorteio, pickWinner, openTournamentResult, chooseDirectAdvance, resetTournament,
    addTournamentTeam,
    // jogadores
    openProfile, deletePlayer, openRegisterModal, openInviteModal,
    closeRegisterModal, closeInviteModal, doRegister, generateInviteLink,
    // partidas
    confirmPresence, editMyPresence, submitConfirmModal, closeConfirmModal,
    kickFromSession, adminAddToSession, copySessionLink, deleteSession, deleteMatch, drawFromSession,
    shareSession, openFinishMatchModal, confirmFinishMatch,
    // admin / scoring
    openScoringConfigModal, renderPerfilTab, renderRankTab,
    toast,
  };
})();

document.addEventListener('DOMContentLoaded', UI.init);
