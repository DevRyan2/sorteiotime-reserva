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
    if(Storage.isOwner()){toast('👑 O modo do Dono permanece sempre ativo.');return;}
    if(Storage.getAuthorizedRole()==='admin'){
      const active=Storage.isAdminModeActive();
      Storage.setAdminMode(!active);
      renderAdminBtn();
      toast(active?'🔓 Modo ADM desativado temporariamente. Sua autorização foi mantida.':'🔑 Modo ADM ativado novamente.');
      showTab(activeTab);
    }else{
      $('admin-password').value = '';
      if($('admin-email'))$('admin-email').value='';
      $('admin-error')?.classList.add('hidden');
      $('modal-admin')?.classList.remove('hidden');
      setTimeout(() => $('admin-email')?.focus(), 50);
    }
  };

  const submitAdminLogin = async () => {
    const input = $('admin-password');
    const button = $('btn-admin-login');
    if (!input || !button) return;
    button.disabled = true;
    button.textContent = 'Verificando…';
    const valid = await DB.signInStaff($('admin-email')?.value||'',input.value);
    button.disabled = false;
    button.textContent = 'Entrar no painel';
    if (!valid) {
      $('admin-error')?.classList.remove('hidden');
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    $('modal-admin')?.classList.add('hidden');
    toast('🔑 Painel desbloqueado!');
    renderAdminBtn();
    showTab(activeTab);
  };

  const renderAdminBtn = () => {
    const btn       = $('admin-btn');
    const scoringBtn= $('btn-scoring-config');
    if (!btn) return;
    btn.textContent = Storage.isOwner() ? '👑 Dono' : Storage.getAuthorizedRole()==='admin' ? (Storage.isAdmin()?'🔓 Sair do modo ADM':'🔑 Entrar no modo ADM') : '🔒 Admin';
    btn.classList.toggle('admin-active', Storage.isAdmin());
    btn.title=Storage.getAuthorizedRole()==='admin'?'Sua autorização de ADM permanece salva até o Dono removê-la.':'Acesso administrativo';
    if (scoringBtn) scoringBtn.style.display = 'none';
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
    if (!Storage.isAdmin()) { toast('⚠️ Apenas administradores podem registrar resultados oficiais.', 'warn'); return; }
    toast('⚠️ Para registrar estatísticas, crie uma sala na aba Partidas e finalize por ela.', 'warn');
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
      const finishBtn = admin && s.status !== 'closed' && s.teams && s.teams.length > 0
        ? `<button class="btn btn-accent btn-sm" onclick='UI.openFinishMatchModal(${sessionArg(s.id)})'>🏁 Finalizar</button>`
        : '';

      return `<div class="session-card">
        <div class="session-head">
          <div>
            <div class="session-name">${escapeHTML(s.eventName || 'Partida')} ${fmtBadge} ${s.status === 'closed' ? '<span class="closed-badge">Encerrada</span>' : ''}</div>
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
          <span class="official-result-badge">Resultado oficial</span>
        </div>
        <div class="match-row-body">
          ${m.teams?.map((t, i) => `
            <div class="match-team-pill ${i === m.winner ? 'match-team-won' : ''}">
              ${i === m.winner ? '🏆 ' : ''}Time ${i+1}: ${t.join(', ')}
            </div>`).join('') || ''}
          ${m.mvp ? `<div class="mvp-pill">⭐ MVP: ${m.mvp}</div>` : ''}
          ${m.playerResults ? `<div class="match-kills">🎯 ${Object.values(m.playerResults).map(entry => `${escapeHTML(entry.nick)}: ${Number(entry.kills)||0}`).join(' · ')}</div>` : ''}
          ${Storage.isOwner() ? `<div style="margin-top:8px;display:flex;gap:8px"><button class="btn btn-secondary btn-sm" onclick="UI.openCorrectMatch('${m.id}')">Corrigir</button><button class="btn btn-danger btn-sm" onclick="UI.deleteOfficialMatch('${m.id}')">Cancelar resultado</button></div>` : ''}
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
    if (name.length > 60 || /[<>`]/.test(name)) { toast('⚠️ Nome de sala inválido', 'warn'); return; }
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
      // Perfil persistente: quem abre um link de sala entra sem redigitar o nick.
      DB.addConfirmed(sessionId, stored).then(ok => {
        if (ok) {
          Storage.setMyConfirmation(sessionId, { nick: stored, edited: false });
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
    modal.dataset.mode = 'finalization';
    delete modal.dataset.matchId;
    const title=modal.querySelector('.modal-title');if(title)title.textContent='🏁 Finalizar partida';
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
          let profile = await DB.getMyProfile();
          if (!profile) profile = await DB.createMyProfile(nick);
          else if (profile.nick !== nick) throw new Error('Este navegador já possui um perfil. Use a opção “Trocar perfil” para mudar o nick.');
          const ok = await DB.addConfirmed(sessionId, profile.nick);
          if (!ok) {
            toast('⚠️ Não foi possível confirmar presença – sessão não encontrada ou já confirmada', 'warn');
            return;
          }
        }
        const profile = await DB.getMyProfile();
        Storage.setMyConfirmation(sessionId, { nick: profile.nick, playerId:profile.id, edited: false });
        toast(`✅ ${profile.nick} confirmado!`);
      } else {
        const oldNick = modal.dataset.oldNick;
        const profile = await DB.changeMyNick(nick);
        await DB.replaceConfirmed(sessionId, oldNick, profile.nick);
        Storage.setMyConfirmation(sessionId, { nick:profile.nick, playerId:profile.id, edited: true });
        toast(`✏️ Nick atualizado para ${profile.nick}`);
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
    const validNick=DB.validateNick(nick);
    if(!validNick.ok){toast('⚠️ '+validNick.message,'warn');return;}
    const session = DB.getSession(sessionId);
    if (!session) return;
    // enforce capacity when admin manually adds
    const fmt = FORMATS[session.format] || null;
    const needed = fmt ? fmt.players : Infinity;
    if ((session.confirmed || []).length >= needed) {
      toast('⚠️ Sala já está cheia');
      return;
    }
    if ((session.confirmed || []).some(n => n.toLowerCase() === validNick.nick.toLowerCase())) {
      toast('⚠️ Nick já está na lista', 'warn'); return;
    }
    try {
      await DB.addConfirmed(sessionId, validNick.nick);
      toast(`✅ ${validNick.nick} adicionado`);
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
    toast('🔒 Resultados oficiais são imutáveis e não podem ser excluídos.', 'warn');
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

    const medals = ['🥇','🥈','🥉'];

    const buildLeaderboard = (metric, title) => {
      const rows = players.map(p => {
        const s = Players.getStats(p.nick);
        if (!s) return null;
        const cfg = Storage.getScoringConfig();
        return { ...p, ...s, seasonPoints: s.season.wins * (cfg.pointsPerWin||10) + s.season.mvps * (cfg.pointsPerMvp||15) };
      }).filter(Boolean)
        .filter(p => metric === 'seasonPoints' ? p.season.total > 0 : p.total > 0)
        .sort((a, b) => (b[metric]||0)-(a[metric]||0) || (b.points||0)-(a.points||0))
        .slice(0, 10);

      if (rows.length === 0) {
        return `<p style="color:var(--muted);font-size:13px;padding:12px 0">Sem partidas no período.</p>`;
      }

      return rows.map((p, i) => `
        <div class="rank-row ${i < 3 ? 'rank-top-'+i : ''}" onclick="UI.openProfile(decodeURIComponent('${encodeURIComponent(p.nick)}'))">
          <div class="rank-pos">${medals[i] || `#${i+1}`}</div>
          <div class="rank-avatar-sm">${p.nick.charAt(0).toUpperCase()}</div>
          <div class="rank-info">
            <div class="rank-nick">${escapeHTML(p.nick)}</div>
            <div class="rank-badge-sm">${p.rank || 'Bronze'}</div>
          </div>
          <div class="rank-nums">
            <span class="rank-pts-big">${metric === 'seasonPoints' ? `${p.seasonPoints||0} pts` : metric === 'winrate' ? `${p.winrate}%` : `${p[metric]||0} ${title}`}</span>
            <span class="rank-sub">${p.wins}V · ${p.kills}K · ${p.mvps}MVP · ${p.total}J</span>
          </div>
        </div>`).join('');
    };

    wrap.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div class="card-title"><div class="card-icon">🏆</div>Ranking da Season</div>
          <span style="font-size:11px;color:var(--muted)">pontos acumulados</span>
        </div>
        <div class="rank-list">${buildLeaderboard('seasonPoints', 'pts')}</div>
      </div>
      <div class="leaderboard-grid">
        ${[['kills','Mais kills','kills','🎯'],['mvps','Mais MVPs','MVPs','⭐'],['wins','Mais vitórias','vitórias','🥇'],['winrate','Maior winrate','WR','📈'],['total','Mais partidas','partidas','🎮']].map(([metric,label,unit,icon]) => `
          <div class="card"><div class="card-head"><div class="card-title"><div class="card-icon">${icon}</div>${label}</div></div><div class="rank-list">${buildLeaderboard(metric,unit)}</div></div>`).join('')}
      </div>`;
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  TAB: PERFIL
  // ══════════════════════════════════════════════════════════════════════════
  const renderPerfilTab = async () => {
    const wrap = $('perfil-content');
    if (!wrap) return;
    wrap.innerHTML='<div class="card profile-loading">⏳ Carregando seu perfil…</div>';
    try {
      const user=firebase.auth().currentUser;
      const account=user&&!user.isAnonymous&&Storage.getRole()!=='admin'?`<div class="card" style="margin-bottom:14px"><div class="card-title">Conta do jogador</div><p class="hint">${escapeHTML(user.displayName||'Jogador')} · ${escapeHTML(user.email||'')}</p><button class="btn btn-ghost btn-sm" onclick="UI.signOutPlayerAccount()">Sair da conta</button></div>`:`<div class="card" style="margin-bottom:14px"><div class="card-title">Acesse seu perfil em qualquer dispositivo</div><p class="hint">Crie uma conta ou entre para manter seu perfil.</p><button class="btn btn-primary btn-sm" onclick="UI.openPlayerAccount()">Criar conta / Entrar</button></div>`;
      const profile=await DB.getMyProfile();
      if(!profile){wrap.innerHTML=account+'<div class="card"><p class="profile-state-text">Você ainda não possui um perfil. O link não é enviado automaticamente por e-mail: peça ao Dono para abrir seu perfil, clicar em <b>Transferir perfil</b> e enviar o link para você por WhatsApp ou outro meio.</p></div>';return;}
      const html=Players.renderProfile(profile.nick);
      if(!html){wrap.innerHTML='<div class="card profile-loading">⏳ Sincronizando estatísticas do Firebase…</div>';return;}
      wrap.innerHTML=account+`<div class="card profile-card">${html}</div>`;
    }catch(e){wrap.innerHTML=`<div class="card"><p class="profile-state-text">Não foi possível carregar o perfil. ${escapeHTML(e.message)}</p><button class="btn btn-ghost btn-sm" onclick="UI.renderPerfilTab()">Tentar novamente</button></div>`;}
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
    const killsList = $('finish-kills-list');
    if (killsList) killsList.innerHTML = teams.map((team, ti) => `
      <fieldset class="finish-team-kills"><legend>Time ${ti + 1}</legend>${team.map(player => `
        <label class="finish-kill-row"><span>${escapeHTML(player)}</span><input class="field-full finish-kill-input" type="number" min="0" step="1" inputmode="numeric" value="0" data-player="${escapeHTML(player)}" required></label>`).join('')}</fieldset>`).join('');

    modal.dataset.sessionId = sessionId;
    modal.dataset.reviewing = '';
    $('finish-review')?.classList.add('hidden');
    const submit=$('btn-confirm-finish'); if(submit) submit.textContent='Revisar resultado';
    [winnerSel,mvpSel,...document.querySelectorAll('#finish-kills-list input')].forEach(e=>e.disabled=false);
    modal.classList.remove('hidden');
  };

  const confirmFinishMatch = async () => {
    const modal     = $('modal-finish-match');
    const sessionId = modal.dataset.sessionId;
    const session   = DB.getSession(sessionId);
    if (!session || !session.teams) { modal.classList.add('hidden'); return; }

    const winnerIdx = parseInt($('finish-winner-sel')?.value ?? '0');
    const mvpNick   = $('finish-mvp-sel')?.value || null;
    const now       = Date.now();
    const killInputs = [...document.querySelectorAll('#finish-kills-list .finish-kill-input')];
    const invalid = killInputs.some(input => input.value === '' || !Number.isInteger(Number(input.value)) || Number(input.value) < 0);
    if (invalid) {
      const error = $('finish-kills-error');
      if (error) { error.textContent = 'Informe as kills de todos os jogadores usando números inteiros a partir de zero.'; error.classList.remove('hidden'); }
      return;
    }
    $('finish-kills-error')?.classList.add('hidden');
    const kills = killInputs.map(input => ({ player: input.dataset.player, kills: Number(input.value) }));

    if(modal.dataset.reviewing!=='yes'){
      const review=$('finish-review');
      if(review){review.innerHTML=`<strong>Confira os dados.</strong> Depois de finalizar, somente o dono poderá corrigir esta partida.<br>Vencedor: Time ${winnerIdx+1}<br>MVP: ${escapeHTML(mvpNick||'Sem MVP')}<br>Kills: ${kills.map(k=>`${escapeHTML(k.player)} ${k.kills}`).join(' · ')}`;review.classList.remove('hidden');}
      modal.dataset.reviewing='yes';
      [ $('finish-winner-sel'), $('finish-mvp-sel'), ...killInputs].forEach(e=>{if(e)e.disabled=true;});
      const submit=$('btn-confirm-finish');if(submit)submit.textContent='✅ Confirmar finalização';
      return;
    }

    const button=$('btn-confirm-finish'); if(button){button.disabled=true;button.textContent='Salvando…';}
    try {
      if(modal.dataset.mode==='correction')await DB.correctOfficialMatch(modal.dataset.matchId,{winner:winnerIdx,mvp:mvpNick,kills});
      else await DB.finalizeSession(sessionId,{ winner:winnerIdx,mvp:mvpNick,kills });
      modal.classList.add('hidden');
      toast(modal.dataset.mode==='correction'?'✅ Resultado corrigido pelo dono!':'✅ Partida finalizada e resultado salvo!');
      renderPartidasTab();
    } catch(e) { toast('❌ '+e.message,'err'); }
    finally { if(button){button.disabled=false;button.textContent='Revisar resultado';} }
  };

  const createPlayerCardBlob = async nick => {
    const p = Storage.getPlayer(nick), stats = Players.getStats(nick);
    if (!p || !stats) throw new Error('Perfil não encontrado');
    const position = Players.getList().findIndex(player => player.nick === nick) + 1;
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630;
    const ctx = canvas.getContext('2d');
    const rounded = (x,y,w,h,r,fill,stroke) => { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();} };
    const bg = ctx.createLinearGradient(0,0,1200,630); bg.addColorStop(0,'#06130c'); bg.addColorStop(1,'#0d2115'); ctx.fillStyle=bg; ctx.fillRect(0,0,1200,630);
    ctx.fillStyle='rgba(37,211,102,.12)'; ctx.beginPath(); ctx.arc(1080,40,260,0,Math.PI*2); ctx.fill();
    for(let x=22;x<1200;x+=42) for(let y=20;y<630;y+=42){ctx.fillStyle='rgba(110,255,160,.10)';ctx.fillRect(x,y,2,2);}
    rounded(30,30,1140,570,28,'rgba(7,22,13,.88)','rgba(110,255,160,.25)');
    rounded(75,75,92,92,46,'rgba(37,211,102,.15)','rgba(37,211,102,.55)'); ctx.fillStyle='#31e978';ctx.font='800 48px Syne, sans-serif';ctx.textAlign='center';ctx.fillText(nick[0].toUpperCase(),121,137);
    ctx.textAlign='left';ctx.fillStyle='#f3fff7';ctx.font='800 42px Syne, sans-serif';ctx.fillText(nick,195,112); rounded(195,127,120,34,17,'rgba(37,211,102,.15)','rgba(37,211,102,.35)');ctx.fillStyle='#6effa0';ctx.font='600 18px Inter, sans-serif';ctx.fillText(p.rank||'Bronze',217,151);
    ctx.fillStyle='#8fab97';ctx.font='500 18px Inter, sans-serif';ctx.fillText(`${p.points||0} pontos  •  #${position || '—'} no ranking`,195,185);
    const metrics=[['RANK',p.rank||'Bronze'],['PONTOS',p.points||0],['VITÓRIAS',stats.wins],['DERROTAS',stats.losses],['WINRATE',`${stats.winrate}%`],['KILLS',stats.kills],['MVPs',stats.mvps],['PARTIDAS',stats.total]];
    metrics.forEach(([label,value],i)=>{const col=i%4,row=Math.floor(i/4),x=75+col*270,y=235+row*145;rounded(x,y,245,115,18,'rgba(0,0,0,.32)','rgba(143,171,151,.15)');ctx.textAlign='center';ctx.fillStyle=i===3?'#ff627c':'#75ff9b';ctx.font=`800 ${String(value).length>9?25:34}px Syne, sans-serif`;ctx.fillText(String(value),x+122.5,y+50);ctx.fillStyle='#8fab97';ctx.font='700 13px Inter, sans-serif';ctx.fillText(label,x+122.5,y+82);});
    ctx.textAlign='left';ctx.fillStyle='#6effa0';ctx.font='700 16px Syne, sans-serif';ctx.fillText('FF SQUAD MANAGER',75,570);
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Falha ao gerar PNG')),'image/png'));
  };

  const downloadPlayerCard = async nick => { try { const blob=await createPlayerCardBlob(nick),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`perfil-${nick.replace(/[^a-z0-9_-]/gi,'-')}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('🖼 Card PNG baixado!'); } catch(e){toast('❌ '+e.message,'err');} };
  const sharePlayerCard = async nick => { try { const blob=await createPlayerCardBlob(nick),file=new File([blob],`perfil-${nick}.png`,{type:'image/png'});if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:`Perfil de ${nick}`,text:`Confira minhas estatísticas no FF Squad Manager`,files:[file]});}else{await downloadPlayerCard(nick);toast('Seu navegador não compartilha arquivos; o card foi baixado.');} }catch(e){if(e.name!=='AbortError')toast('❌ '+e.message,'err');} };

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
    const adminActions = '';

    // show current user's stored nick with edit option
    let myNickHtml = '';
    const myNick = Storage.getMyNick();
    if (myNick) {
      myNickHtml = `<div style="margin-bottom:12px">
          <strong>Seu nick:</strong> ${escapeHTML(myNick)}
          <button class="btn btn-ghost btn-sm" style="margin-left:8px" onclick="UI.promptEditNick()">Trocar perfil</button>
          <button class="btn btn-ghost btn-sm" style="margin-left:8px" onclick="UI.copyMyAdminCode()">Copiar código para ADM</button>
        </div>`;
    } else {
      myNickHtml = `<div style="margin-bottom:12px">
          <button class="btn btn-ghost btn-sm" onclick="UI.promptEditNick()">Definir meu nick</button>
        </div>`;
    }

    const linkedPlayers=list.filter(p=>p.ownerUid&&p.ownerUid!=='RECOVERY_UNCLAIMED');
    const ownerPanel=Storage.isOwner()?`<div class="card" style="margin-bottom:14px"><div class="card-title">👑 Controle do dono</div><p class="hint">Escolha um perfil vinculado ou cole o código que a pessoa copiou no próprio dispositivo. O acesso aparece para ela em tempo real, sem senha.</p><div style="display:grid;grid-template-columns:2fr 2fr 1fr auto;gap:8px;margin:12px 0"><select id="owner-admin-player" class="field-full"><option value="">Selecionar jogador vinculado</option>${linkedPlayers.map(p=>`<option value="${escapeHTML(p.ownerUid)}">${escapeHTML(p.nick)}</option>`).join('')}</select><input id="owner-admin-uid" class="field-full" placeholder="Ou cole o código/UID"><input id="owner-admin-label" class="field-full" placeholder="Nome do ADM"><button class="btn btn-primary" onclick="UI.grantAdmin()">Conceder ADM</button></div><div id="owner-role-list">Carregando cargos…</div><div style="margin-top:12px"><button class="btn btn-danger btn-sm" onclick="UI.startNewSeason()">Iniciar nova temporada</button></div><details style="margin-top:12px"><summary>Auditoria recente</summary><div id="owner-audit-list">Carregando…</div></details></div>`:'';
    wrap.innerHTML = `${ownerPanel}
      <div class="card">
        <div class="card-head">
          <div class="card-title"><div class="card-icon">👤</div> Jogadores</div>
          <div style="display:flex;gap:8px">
            ${adminActions}
          </div>
        </div>
        ${myNickHtml}
        ${list.length === 0
          ? `<p style="color:var(--muted);font-size:13px;padding:12px 0">Nenhum jogador cadastrado. Cada jogador deve criar o próprio perfil neste dispositivo.</p>`
          : `<div class="players-table">
              ${list.map(p => {
                const stats = Players.getStats(p.nick);
                const wrColor = stats.winrate >= 60 ? 'var(--green)' : stats.winrate >= 40 ? 'var(--accent)' : 'var(--red)';
                return `<div class="player-row" onclick="UI.openProfile(decodeURIComponent('${encodeURIComponent(p.nick)}'))">
                  <div class="player-avatar">${p.avatar?`<img src="${escapeHTML(p.avatar)}" alt="Foto de ${escapeHTML(p.nick)}">`:p.nick.charAt(0).toUpperCase()}</div>
                  <div class="player-row-info">
                    <div class="player-row-nick">${escapeHTML(p.nick)}</div>
                    <div class="player-row-rank">${p.rank || 'Bronze'}</div>
                  </div>
                  <div class="player-row-stats">
                    <span style="color:${wrColor}">${stats.winrate}% WR</span>
                    <span style="color:var(--muted);font-size:11px">${stats.total}j</span>
                    ${(p.achievements||[]).length > 0 ? `<span title="${(p.achievements||[]).length} conquistas">🏅×${(p.achievements||[]).length}</span>` : ''}
                    ${p.ownerUid==='RECOVERY_UNCLAIMED'?'<small>Perfil aguardando transferência pelo Dono</small>':'<small>Perfil já vinculado a uma conta</small>'}
                  </div>
                </div>`;
              }).join('')}
            </div>`
        }
      </div>`;
    if(Storage.isOwner())renderOwnerData();
  };

  const renderOwnerData=async()=>{try{const [roles,logs]=await Promise.all([DB.getRoles(),DB.getAuditLog()]);const roleWrap=$('owner-role-list');if(roleWrap)roleWrap.innerHTML=Object.entries(roles).map(([uid,r])=>`<div class="player-row"><div class="player-row-info"><b>${escapeHTML(r.label||r.role)}</b><small>${escapeHTML(uid)} · ${escapeHTML(r.role)}</small></div>${r.role==='admin'?`<button class="btn btn-danger btn-sm" onclick="UI.revokeAdmin('${uid}')">Remover</button>`:''}</div>`).join('')||'<span class="hint">Nenhum ADM comum.</span>';const audit=$('owner-audit-list');if(audit)audit.innerHTML=logs.slice(0,20).map(l=>`<div class="hint">${new Date(l.createdAt).toLocaleString('pt-BR')} · ${escapeHTML(l.action)} · ${escapeHTML(l.actorUid)}</div>`).join('')||'Sem eventos.';}catch(e){toast('❌ '+e.message,'err');}};
  const grantAdmin=async()=>{try{const uid=$('owner-admin-player')?.value||$('owner-admin-uid')?.value.trim();await DB.setAdminRole(uid,$('owner-admin-label').value||$('owner-admin-player')?.selectedOptions[0]?.textContent);toast('✅ ADM concedido — aparecerá automaticamente no dispositivo da pessoa');renderOwnerData();}catch(e){toast('❌ '+e.message,'err');}};
  const copyMyAdminCode=async()=>{const user=firebase.auth().currentUser;if(!user?.isAnonymous){toast('Abra como jogador para copiar o código.','warn');return;}try{await navigator.clipboard.writeText(user.uid);toast('✅ Código copiado. Envie ao dono.');}catch{window.prompt('Copie este código e envie ao dono:',user.uid);}};
  const revokeAdmin=async uid=>{if(!confirm('Remover as permissões deste ADM?'))return;try{await DB.removeAdminRole(uid);toast('✅ Permissão removida');renderOwnerData();}catch(e){toast('❌ '+e.message,'err');}};
  const startNewSeason=async()=>{if(!confirm('Iniciar uma nova temporada e arquivar o ranking atual?'))return;if(window.prompt('Digite NOVA TEMPORADA para confirmar:')!=='NOVA TEMPORADA')return;try{await DB.startNewSeason();toast('✅ Nova temporada iniciada');}catch(e){toast('❌ '+e.message,'err');}};

  const openProfile = (nick) => {
    profileNick = nick;
    renderJogadoresTab();
  };

  const closePlayerProfile = () => { profileNick=null;renderJogadoresTab(); };

  let customizeAvatar;
  const setCustomizePreview=(avatar,nick='?')=>{const preview=$('profile-photo-preview');if(preview)preview.innerHTML=avatar?`<img src="${escapeHTML(avatar)}" alt="Prévia da foto">`:escapeHTML((nick||'?').charAt(0).toUpperCase());};
  const openCustomizeProfile=async()=>{try{const profile=await DB.getMyProfile();if(!profile)throw new Error('Este perfil não está vinculado a este dispositivo.');customizeAvatar=undefined;$('profile-bio-input').value=profile.bio||'';$('profile-bio-count').textContent=String((profile.bio||'').length);$('profile-customize-error')?.classList.add('hidden');setCustomizePreview(profile.avatar,profile.nick);$('modal-customize-profile')?.classList.remove('hidden');}catch(e){toast('❌ '+e.message,'err');}};
  const closeCustomizeProfile=()=>{$('modal-customize-profile')?.classList.add('hidden');const input=$('profile-photo-input');if(input)input.value='';customizeAvatar=undefined;};
  const compressProfilePhoto=async file=>{if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>10*1024*1024)throw new Error('Escolha uma imagem JPG, PNG ou WebP de até 10 MB.');let source;try{if('createImageBitmap'in window)source=await createImageBitmap(file);else throw new Error();}catch{source=await new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('O arquivo está corrompido ou não é uma imagem válida.'));};img.src=url;});}if(!source.width||!source.height)throw new Error('A imagem não possui dimensões válidas.');const max=320,scale=Math.min(1,max/Math.max(source.width,source.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Seu navegador não conseguiu processar a imagem.');ctx.fillStyle='#08130c';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);source.close?.();let quality=.82,data=canvas.toDataURL('image/jpeg',quality);while(data.length>175000&&quality>.32){quality-=.08;data=canvas.toDataURL('image/jpeg',quality);}if(!data.startsWith('data:image/jpeg;base64,')||data.length>180000)throw new Error('Não foi possível reduzir essa imagem. Escolha uma foto menor.');return data;};
  const handleProfilePhoto=async e=>{const file=e.target.files?.[0];if(!file)return;try{customizeAvatar=await compressProfilePhoto(file);setCustomizePreview(customizeAvatar);}catch(err){toast('❌ '+err.message,'err');e.target.value='';}};
  const saveCustomizeProfile=async()=>{const button=$('profile-customize-save');if(button){button.disabled=true;button.textContent='Salvando…';}try{await DB.updateMyProfile({bio:$('profile-bio-input')?.value||'',avatar:customizeAvatar});closeCustomizeProfile();toast('✅ Perfil personalizado');if(profileNick)renderJogadoresTab();if(activeTab==='perfil')renderPerfilTab();}catch(e){const error=$('profile-customize-error');if(error){error.textContent=e.message;error.classList.remove('hidden');}}finally{if(button){button.disabled=false;button.textContent='Salvar perfil';}}};

  let adminPlayerId=null;
  const openPlayerAdmin = nick => {
    if(!Storage.isOwner())return;
    const player=Storage.getPlayer(nick);if(!player)return;
    adminPlayerId=player.playerId||player.id;const a=player.adjustments||{};
    $('player-admin-title').textContent=`⚙️ Gerenciar ${player.nick}`;
    $('player-admin-nick').value=player.nick;
    ['points','wins','losses','kills','mvps'].forEach(key=>{const input=$(`player-adjust-${key}`);if(input)input.value=Number(a[key])||0;});
    $('player-adjust-reason').value=a.reason||'';$('player-admin-error')?.classList.add('hidden');
    $('modal-player-admin')?.classList.remove('hidden');
  };
  const closePlayerAdmin = () => {adminPlayerId=null;$('modal-player-admin')?.classList.add('hidden');};
  const transferProfile=async()=>{if(!Storage.isOwner()||!adminPlayerId)return;try{const transfer=await DB.createProfileTransfer(adminPlayerId),base=location.href.split('#')[0].split('?')[0],url=`${base}#transfer=${transfer.token}`;try{await navigator.clipboard.writeText(url);toast('✅ Link único copiado. Expira em 7 dias.');}catch{window.prompt('Copie o link seguro e envie diretamente ao jogador:',url);}}catch(e){toast('❌ '+e.message,'err');}};
  const cancelProfileTransfer=async()=>{if(!Storage.isOwner()||!adminPlayerId)return;if(!confirm('Cancelar o link de transferência ativo deste perfil?'))return;try{await DB.cancelProfileTransfer(adminPlayerId);toast('✅ Transferência cancelada');}catch(e){toast('❌ '+e.message,'err');}};
  let pendingTransferToken=null;
  const openProfileTransfer=async token=>{pendingTransferToken=token;const modal=$('modal-profile-transfer'),message=$('profile-transfer-message'),error=$('profile-transfer-error');error?.classList.add('hidden');try{const transfer=await DB.getProfileTransfer(token);message.textContent=`Você recebeu o perfil ${transfer.displayName}. Deseja vincular este perfil à sua conta atual?`;modal?.classList.remove('hidden');}catch(e){if(firebase.auth().currentUser?.isAnonymous){toast('Entre em uma conta de jogador para abrir a transferência.','warn');openPlayerAccount();}else toast('❌ '+e.message,'err');}};
  const acceptProfileTransfer=async()=>{const button=$('profile-transfer-accept'),error=$('profile-transfer-error');if(!pendingTransferToken)return;if(button)button.disabled=true;try{const profile=await DB.acceptProfileTransfer(pendingTransferToken);$('modal-profile-transfer')?.classList.add('hidden');history.replaceState(null,'',location.pathname);toast(`✅ Perfil ${profile.nick} vinculado à sua conta`);showTab('perfil');}catch(e){if(error){error.textContent=e.message;error.classList.remove('hidden');}}finally{if(button)button.disabled=false;}};
  const savePlayerAdmin = async () => {
    if(!Storage.isOwner()||!adminPlayerId)return;
    const adjustments={reason:$('player-adjust-reason')?.value||''};
    for(const key of ['points','wins','losses','kills','mvps'])adjustments[key]=Number($(`player-adjust-${key}`)?.value||0);
    const nick=$('player-admin-nick')?.value||'',button=$('btn-save-player-admin');
    if(button){button.disabled=true;button.textContent='Salvando…';}
    try{await DB.savePlayerAdmin(adminPlayerId,{nick,adjustments});profileNick=nick.trim().replace(/\s+/g,' ');closePlayerAdmin();toast('✅ Perfil atualizado');}
    catch(e){const error=$('player-admin-error');if(error){error.textContent=e.message;error.classList.remove('hidden');}}
    finally{if(button){button.disabled=false;button.textContent='Salvar alterações';}}
  };
  const deletePlayerAdmin = async () => {
    if(!Storage.isOwner()||!adminPlayerId)return;
    const player=DB.getPlayerById(adminPlayerId);if(!player)return;
    if(!confirm(`ATENÇÃO: apagar completamente o perfil "${player.nick}"?\n\nEsta ação remove a identidade, reserva do nick e ajustes administrativos. O histórico oficial das partidas será preservado.`))return;
    const typed=window.prompt(`Para confirmar, digite o nick exatamente como aparece: ${player.nick}`);
    if(typed!==player.nick){toast('Exclusão cancelada: confirmação diferente do nick.','warn');return;}
    try{await DB.deletePlayer(player.nick);profileNick=null;closePlayerAdmin();renderJogadoresTab();toast('🗑 Perfil apagado');}
    catch(e){toast('❌ '+e.message,'err');}
  };
  const resetPlayerAdmin=async()=>{if(!Storage.isOwner()||!adminPlayerId)return;const player=DB.getPlayerById(adminPlayerId);if(!player)return;if(!confirm(`Zerar as métricas de ${player.nick} somente na temporada atual? O histórico será preservado.`))return;if(window.prompt('Digite ZERAR para confirmar:')!=='ZERAR')return;try{await DB.resetPlayerSeason(adminPlayerId);closePlayerAdmin();toast('✅ Métricas da temporada zeradas');}catch(e){toast('❌ '+e.message,'err');}};

  const deleteOfficialMatch=async matchId=>{if(!Storage.isOwner())return;if(!confirm('Cancelar este resultado oficial? As estatísticas serão recalculadas e a sala será reaberta.'))return;if(window.prompt('Digite CANCELAR para confirmar:')!=='CANCELAR')return;try{await DB.deleteOfficialMatch(matchId);toast('✅ Resultado cancelado');renderPartidasTab();}catch(e){toast('❌ '+e.message,'err');}};
  const openCorrectMatch=matchId=>{if(!Storage.isOwner())return;const match=Storage.getMatches().find(m=>m.id===matchId);if(!match)return;openFinishMatchModal(match.sessionId);const modal=$('modal-finish-match');modal.dataset.mode='correction';modal.dataset.matchId=matchId;const title=modal.querySelector('.modal-title');if(title)title.textContent='🛠 Corrigir resultado (DONO)';$('finish-winner-sel').value=String(match.winner);$('finish-mvp-sel').value=match.mvp||'';document.querySelectorAll('#finish-kills-list .finish-kill-input').forEach(input=>{const row=Object.values(match.playerResults||{}).find(r=>r.nick===input.dataset.player);input.value=Number(row?.kills)||0;});};

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

  const doRegister = async () => {
    const nick = $('reg-nick')?.value.trim();
    if (!nick) { toast('⚠️ Informe o nick', 'warn'); return; }
    try {
      const profile=await DB.createMyProfile(nick);
      toast(`✅ ${profile.nick} cadastrado!`);
      closeRegisterModal();
      renderJogadoresTab();
    } catch(e) { toast('❌ '+e.message,'err'); }
  };

  const openPlayerAccount=()=>{$('player-account-error')?.classList.add('hidden');$('modal-player-account')?.classList.remove('hidden');setTimeout(()=>$('player-account-email')?.focus(),50);};
  const closePlayerAccount=()=>$('modal-player-account')?.classList.add('hidden');
  const submitPlayerAccount=async mode=>{const email=$('player-account-email')?.value.trim(),password=$('player-account-password')?.value||'',name=$('player-account-name')?.value.trim()||'',error=$('player-account-error'),buttons=[$('player-account-login'),$('player-account-register')];if(!email||password.length<6){error.textContent='Informe um e-mail válido e uma senha com pelo menos 6 caracteres.';error.classList.remove('hidden');return;}buttons.forEach(b=>{if(b)b.disabled=true;});try{if(mode==='register')await DB.registerPlayerAccount(email,password,name);else await DB.signInPlayer(email,password);closePlayerAccount();toast(mode==='register'?'✅ Conta criada':'✅ Conta acessada');renderPerfilTab();renderJogadoresTab();}catch(e){const messages={'auth/email-already-in-use':'Este e-mail já possui uma conta. Use Entrar.','auth/invalid-login-credentials':'E-mail ou senha incorretos.','auth/wrong-password':'E-mail ou senha incorretos.','auth/invalid-email':'E-mail inválido.','auth/credential-already-in-use':'Este e-mail já pertence a outra conta.'};error.textContent=messages[e.code]||e.message||'Não foi possível acessar a conta.';error.classList.remove('hidden');}finally{buttons.forEach(b=>{if(b)b.disabled=false;});}};
  const signOutPlayerAccount=async()=>{try{await DB.signOutPlayer();toast('Você saiu da conta.');renderPerfilTab();renderJogadoresTab();}catch(e){toast('❌ '+e.message,'err');}};
  const forgotPlayerPassword=async()=>{const email=$('player-account-email')?.value.trim(),error=$('player-account-error'),button=$('player-account-forgot'),success=()=>toast('✅ Se esse endereço existir e receber mensagens, o Firebase enviará o link de recuperação.');if(button)button.disabled=true;try{await DB.sendPlayerPasswordReset(email);success();}catch(e){if(e.code==='auth/user-not-found'){success();return;}const messages={'auth/invalid-email':'Informe o identificador em formato de e-mail.','auth/too-many-requests':'Muitas tentativas. Aguarde alguns minutos.'};if(error){error.textContent=messages[e.code]||e.message||'Não foi possível solicitar a recuperação.';error.classList.remove('hidden');}}finally{if(button)button.disabled=false;}};

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
  let bracketSwapSource = null;
  const tournamentAdminPanel = bracket => {
    if (!Storage.isAdmin() || !bracket?.rounds?.length) return '';
    const ri = bracket.rounds.length - 1, round = bracket.rounds[ri];
    const editable = round.matches.every(match => !match.winner && !match.result);
    const slots = round.matches.flatMap((match,mi)=>[['t1',match.t1],['t2',match.t2]].map(([side,team])=>({mi,side,team})));
    return `<div class="card tournament-bracket-tools">
      <div class="card-head"><div class="card-title"><div class="card-icon">🧩</div> Montagem dos confrontos</div><span class="save-live-label">● Salvo ao vivo</span></div>
      <p class="field-help">Defina a disponibilidade e ajuste somente as posições necessárias. Confrontos definidos manualmente ficam protegidos da sugestão inteligente.</p>
      <div class="team-status-grid">${(bracket.teams||[]).map(team=>`<button class="team-status-button ${team.available===false?'is-unavailable':'is-available'}" onclick="UI.toggleTournamentAvailability('${team.id}')"><span>${team.available===false?'🔴':'🟢'}</span><strong>${escapeHTML(team.name)}</strong><small>${team.available===false?'Indisponível':'Disponível'}</small></button>`).join('')}</div>
      <div class="bracket-tool-actions"><button class="btn btn-ghost btn-sm" onclick="UI.toggleTournamentNamesEditor()">✏️ Corrigir nomes</button></div>
      <div class="tournament-names-editor hidden" id="tournament-names-editor">
        <p class="field-help">Corrija os nomes abaixo. Resultados, kills e MVPs já registrados serão mantidos.</p>
        ${(bracket.teams||[]).map((team,index)=>`<div class="tournament-name-edit-row" data-team-id="${team.id}">
          <label><span>Equipe ${index+1}</span><input class="field-full tournament-edit-team-name" maxlength="40" value="${escapeHTML(team.name)}"></label>
          <label><span>${team.members.length===1?'Jogador':'Jogadores (separados por vírgula)'}</span><input class="field-full tournament-edit-members" maxlength="240" value="${escapeHTML(team.members.join(', '))}"></label>
        </div>`).join('')}
        <button class="btn btn-primary btn-full" onclick="UI.saveTournamentNames()">Salvar nomes corrigidos</button>
      </div>
      ${editable?`<div class="bracket-tool-actions">
        <button class="btn btn-ghost btn-sm" onclick="UI.randomizeTournamentRound(${ri})">🎲 Sorteio automático</button>
        <button class="btn btn-ghost btn-sm" onclick="UI.smartArrangeTournament(${ri})">✨ Organização inteligente</button>
        <button class="btn btn-ghost btn-sm" onclick="UI.toggleManualBracketEditor()">✍️ Montagem manual</button>
        ${bracketSwapSource?'<button class="btn btn-ghost btn-sm" onclick="UI.cancelBracketSwap()">✕ Cancelar troca</button>':''}
      </div>
      <div class="swap-guidance ${bracketSwapSource?'swap-active':''}">${bracketSwapSource?'Agora clique na equipe que deve trocar de posição.':'Para trocar apenas duas posições, clique na primeira equipe e depois na segunda.'}</div>
      <div class="manual-bracket-editor hidden" id="manual-bracket-editor"><div class="manual-bracket-grid">${slots.map((slot,index)=>`<label><span>Posição ${index+1}</span><select class="field-sm manual-bracket-select">${slots.map(option=>`<option value="${option.team.id}" ${option.team.id===slot.team.id?'selected':''}>${option.team.available===false?'🔴':'🟢'} ${escapeHTML(option.team.name)}</option>`).join('')}</select></label>`).join('')}</div><button class="btn btn-primary btn-full" onclick="UI.saveManualBracket(${ri})">Salvar montagem manual</button></div>`:'<p class="field-help">A rodada atual já possui resultados e não pode mais ser reorganizada.</p>'}
    </div>`;
  };
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
            <fieldset class="tournament-choice-section">
              <legend class="field-label">Formato do torneio</legend>
              <div class="tournament-format-group" id="tournament-format-group">
                <label class="format-opt"><input type="radio" name="tournament-format" value="1" checked><span class="format-opt-card"><b class="format-opt-icon">⚡</b><strong>Solo</strong><small>1 jogador</small><i aria-hidden="true">✓</i></span></label>
                <label class="format-opt"><input type="radio" name="tournament-format" value="2"><span class="format-opt-card"><b class="format-opt-icon">🤝</b><strong>Duo</strong><small>2 jogadores</small><i aria-hidden="true">✓</i></span></label>
                <label class="format-opt"><input type="radio" name="tournament-format" value="3"><span class="format-opt-card"><b class="format-opt-icon">🛡️</b><strong>3v3</strong><small>3 jogadores</small><i aria-hidden="true">✓</i></span></label>
                <label class="format-opt"><input type="radio" name="tournament-format" value="4"><span class="format-opt-card"><b class="format-opt-icon">🔥</b><strong>Squad</strong><small>4 jogadores</small><i aria-hidden="true">✓</i></span></label>
              </div>
            </fieldset>
            <fieldset class="tournament-choice-section tournament-name-section">
              <legend class="field-label">Nome das equipes</legend>
              <div class="tournament-name-mode">
                <label class="format-opt"><input type="radio" name="tournament-name-mode" value="auto" checked><span class="format-opt-card name-opt-card"><b class="format-opt-icon">✨</b><span><strong>Automático</strong><small>Criamos a partir dos participantes</small></span><i aria-hidden="true">✓</i></span></label>
                <label class="format-opt"><input type="radio" name="tournament-name-mode" value="manual"><span class="format-opt-card name-opt-card"><b class="format-opt-icon">✏️</b><span><strong>Manual</strong><small>Você escolhe cada nome</small></span><i aria-hidden="true">✓</i></span></label>
              </div>
            </fieldset>
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
        ${!Storage.isAdmin() ? `<p class="hint">💡 <span>Apenas o admin pode definir o vencedor de cada partida.</span></p>` : ''}
        ${tournamentAdminPanel(saved)}`;
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
    available: entry.querySelector('.tournament-team-availability')?.checked !== false,
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
      <label class="field-label">Participantes</label><input class="field-full tournament-roster-input" maxlength="240" placeholder="Ryan, João">
      <label class="tournament-availability-toggle"><input class="tournament-team-availability" type="checkbox" checked><span>🟢 Disponível hoje</span></label>`;
    entry.querySelector('.tournament-team-name').value = value.name || '';
    entry.querySelector('.tournament-roster-input').value = value.roster || value.members?.join(', ') || '';
    entry.querySelector('.tournament-team-availability').checked = value.available !== false;
    entry.querySelector('.tournament-availability-toggle span').textContent=value.available===false?'🔴 Indisponível hoje':'🟢 Disponível hoje';
    entry.querySelector('.tournament-team-availability').addEventListener('change', e => { e.currentTarget.nextElementSibling.textContent=e.currentTarget.checked?'🟢 Disponível hoje':'🔴 Indisponível hoje'; });
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
      teams.push({ id:`team-${Date.now()}-${i}`, name, members, available:values[i].available });
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

  const saveBracketChange = async (bracket, message) => {
    if (!bracket) { toast('⚠️ Esta rodada não pode mais ser alterada', 'warn'); return false; }
    try { await DB.saveTournament(bracket); bracketSwapSource=null; renderTorneioTab(); toast(message); return true; }
    catch(e) { toast(`❌ Não foi possível salvar: ${e.message}`, 'err'); return false; }
  };
  const toggleTournamentAvailability = async teamId => {
    if(!Storage.isAdmin())return;const team=Tournament.getBracket()?.teams?.find(t=>t.id===teamId);if(!team)return;
    await saveBracketChange(Tournament.setAvailability(teamId,team.available===false),`Status de ${team.name} atualizado`);
  };
  const toggleTournamentNamesEditor = () => $('tournament-names-editor')?.classList.toggle('hidden');
  const saveTournamentNames = async () => {
    if(!Storage.isAdmin())return;
    const bracket=Tournament.getBracket(),teamSize=Number(bracket?.teamSize)||1;
    const updates=[...document.querySelectorAll('.tournament-name-edit-row')].map(row=>({
      id:row.dataset.teamId,
      name:row.querySelector('.tournament-edit-team-name').value.trim(),
      members:row.querySelector('.tournament-edit-members').value.split(',').map(name=>name.trim()).filter(Boolean),
    }));
    if(updates.some(update=>!update.name)){toast('⚠️ Informe o nome de todas as equipes','warn');return;}
    if(updates.some(update=>update.members.length!==teamSize)){toast(`⚠️ Cada equipe precisa ter exatamente ${teamSize} ${teamSize===1?'jogador':'jogadores'}`,'warn');return;}
    const teamNames=updates.map(update=>update.name.toLocaleLowerCase('pt-BR'));
    const playerNames=updates.flatMap(update=>update.members).map(name=>name.toLocaleLowerCase('pt-BR'));
    if(new Set(teamNames).size!==teamNames.length){toast('⚠️ Existem equipes com o mesmo nome','warn');return;}
    if(new Set(playerNames).size!==playerNames.length){toast('⚠️ Existem jogadores com o mesmo nome','warn');return;}
    await saveBracketChange(Tournament.updateNames(updates),'✅ Nomes corrigidos no torneio');
  };
  const selectBracketTeam = async (roundIdx,matchIdx,side) => {
    if(!Storage.isAdmin())return;const position={roundIdx,matchIdx,side};
    if(!bracketSwapSource){bracketSwapSource=position;renderTorneioTab();return;}
    if(bracketSwapSource.roundIdx===roundIdx&&bracketSwapSource.matchIdx===matchIdx&&bracketSwapSource.side===side){bracketSwapSource=null;renderTorneioTab();return;}
    await saveBracketChange(Tournament.swapTeams(bracketSwapSource,position),'🔄 Equipes trocadas; demais confrontos preservados');
  };
  const cancelBracketSwap = () => { bracketSwapSource=null;renderTorneioTab(); };
  const randomizeTournamentRound = ri => saveBracketChange(Tournament.randomizeRound(ri),'🎲 Confrontos livres sorteados');
  const smartArrangeTournament = ri => saveBracketChange(Tournament.arrangeSmart(ri),'✨ Organização inteligente aplicada');
  const toggleManualBracketEditor = () => $('manual-bracket-editor')?.classList.toggle('hidden');
  const saveManualBracket = ri => {
    const ids=[...document.querySelectorAll('.manual-bracket-select')].map(select=>select.value);
    if(new Set(ids).size!==ids.length){toast('⚠️ Cada equipe deve ocupar exatamente uma posição','warn');return;}
    saveBracketChange(Tournament.setRoundOrder(ri,ids),'✍️ Montagem manual salva ao vivo');
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

    if(hash.startsWith('transfer=')){
      const token=hash.slice(9).trim();
      if(!/^[a-f0-9]{64}$/.test(token)){toast('❌ Link de transferência inválido.','err');return;}
      openProfileTransfer(token);return;
    }

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

    // Convites antigos que carregavam nick/rank na URL foram desativados:
    // parâmetros de URL nunca podem criar ou assumir identidade.
    if (hash.startsWith('invite=')) {
      history.replaceState(null, '', location.pathname);
      toast('⚠️ Convite de perfil antigo ignorado por segurança. Crie seu perfil no próprio dispositivo.', 'warn');
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  Init & eventos
  // ══════════════════════════════════════════════════════════════════════════
  const init = () => {
    // Inicializa Firebase e registra callback de tempo real
    DB.setOnChange((scope) => {
      if (activeTab === 'partidas') renderSessions();
      if (activeTab === 'torneio') renderTorneioTab();
      if(activeTab==='jogadores')renderJogadoresTab();
      if(activeTab==='perfil')renderPerfilTab();
      if(activeTab==='rank')renderRankTab();
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
      if (!Storage.isAdmin()) DB.getMyProfile().then(profile => { if(profile && activeTab==='perfil') renderPerfilTab(); }).catch(()=>{});
      if (activeTab === 'partidas') renderSessions();
      if (activeTab === 'torneio') renderTorneioTab();
      if (activeTab === 'jogadores') renderJogadoresTab();
      if(location.hash.startsWith('#transfer=')&&firebase.auth().currentUser&&!firebase.auth().currentUser.isAnonymous&&Storage.getRole()!=='admin')setTimeout(handleHash,100);
    });
    $('modal-admin-close')?.addEventListener('click', () => $('modal-admin')?.classList.add('hidden'));
    $('btn-admin-login')?.addEventListener('click', submitAdminLogin);
    $('admin-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitAdminLogin(); });
    $('admin-email')?.addEventListener('keydown',e=>{if(e.key==='Enter')$('admin-password')?.focus();});
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
    $('player-account-close')?.addEventListener('click',closePlayerAccount);
    $('player-account-login')?.addEventListener('click',()=>submitPlayerAccount('login'));
    $('player-account-register')?.addEventListener('click',()=>submitPlayerAccount('register'));
    $('player-account-forgot')?.addEventListener('click',forgotPlayerPassword);
    $('player-account-password')?.addEventListener('keydown',e=>{if(e.key==='Enter')submitPlayerAccount('login');});
    $('modal-invite-close')?.addEventListener('click', closeInviteModal);
    $('btn-gen-invite')?.addEventListener('click', generateInviteLink);
    $('player-admin-close')?.addEventListener('click',closePlayerAdmin);
    $('btn-save-player-admin')?.addEventListener('click',savePlayerAdmin);
    $('btn-delete-player')?.addEventListener('click',deletePlayerAdmin);
    $('btn-transfer-player')?.addEventListener('click',transferProfile);
    $('btn-cancel-transfer')?.addEventListener('click',cancelProfileTransfer);
    $('btn-reset-player')?.addEventListener('click',resetPlayerAdmin);
    $('profile-transfer-close')?.addEventListener('click',()=>$('modal-profile-transfer')?.classList.add('hidden'));
    $('profile-transfer-decline')?.addEventListener('click',()=>$('modal-profile-transfer')?.classList.add('hidden'));
    $('profile-transfer-accept')?.addEventListener('click',acceptProfileTransfer);
    $('modal-player-admin')?.addEventListener('click',e=>{if(e.target===$('modal-player-admin'))closePlayerAdmin();});
    $('customize-profile-close')?.addEventListener('click',closeCustomizeProfile);
    $('profile-customize-cancel')?.addEventListener('click',closeCustomizeProfile);
    $('profile-customize-save')?.addEventListener('click',saveCustomizeProfile);
    $('profile-photo-input')?.addEventListener('change',handleProfilePhoto);
    $('profile-photo-remove')?.addEventListener('click',()=>{customizeAvatar=null;setCustomizePreview(null,Storage.getMyNick());});
    $('profile-bio-input')?.addEventListener('input',e=>{if($('profile-bio-count'))$('profile-bio-count').textContent=String(e.target.value.length);});
    $('modal-customize-profile')?.addEventListener('click',e=>{if(e.target===$('modal-customize-profile'))closeCustomizeProfile();});

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
    UI.promptEditNick = async () => {
      const current = Storage.getMyNick();
      const promptText = current
        ? `Seu perfil atual é "${current}". Digite o nick do perfil que deseja usar:`
        : 'Digite seu nick:';
      const n = window.prompt(promptText, current || '');
      if (!n) return;
      if (n.trim().length < 2) { toast('⚠️ Nick inválido', 'warn'); return; }
      try {
        const profile = current ? await DB.changeMyNick(n) : await DB.createMyProfile(n);
        toast('✅ Perfil salvo: ' + profile.nick);
        renderJogadoresTab();
        if (activeTab === 'perfil') renderPerfilTab();
      } catch(e) { toast('❌ '+e.message,'err'); }
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
    toggleTournamentAvailability, toggleTournamentNamesEditor, saveTournamentNames, selectBracketTeam, cancelBracketSwap, randomizeTournamentRound, smartArrangeTournament, toggleManualBracketEditor, saveManualBracket,
    addTournamentTeam,
    // jogadores
    openProfile, closePlayerProfile, openCustomizeProfile, openPlayerAdmin, deletePlayer, openRegisterModal, openInviteModal, downloadPlayerCard, sharePlayerCard,
    openPlayerAccount, signOutPlayerAccount,
    transferProfile, cancelProfileTransfer, acceptProfileTransfer,
    grantAdmin,revokeAdmin,startNewSeason,deleteOfficialMatch,openCorrectMatch,copyMyAdminCode,
    closeRegisterModal, closeInviteModal, doRegister, generateInviteLink,
    // partidas
    confirmPresence, editMyPresence, submitConfirmModal, closeConfirmModal,
    kickFromSession, adminAddToSession, copySessionLink, deleteSession, deleteMatch, drawFromSession,
    shareSession, openFinishMatchModal, confirmFinishMatch,
    // admin / scoring
    openScoringConfigModal, renderPerfilTab, renderRankTab, promptEditNick:null,
    toast,
  };
})();

document.addEventListener('DOMContentLoaded', UI.init);
