// tournament.js — chaveamento eliminatório dinâmico, sem avanços automáticos
const Tournament = (() => {
  let bracket = null;
  const _shuffle = values => { const r=[...values]; for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];} return r; };
  const _roundName = (count, index) => count===2?'Final':count===4?'Semifinal':count===8?'Quartas de final':count===16?'Oitavas de final':index===0?'Primeira fase':`Fase ${index+1}`;
  const _makeRound = (participants, carried=[]) => {
    if(participants.length%2!==0) throw new Error('A rodada precisa ter uma quantidade par de equipes.');
    const ri=bracket.rounds.length;
    return { id:`round-${ri}-${Date.now()}`,name:_roundName(participants.length+carried.length,ri),participants:[...participants],carried:[...carried],directAdvance:null,awaitingDirectAdvance:false,
      matches:Array.from({length:participants.length/2},(_,i)=>({id:`r${ri}-m${i}`,t1:participants[i*2],t2:participants[i*2+1],winner:null})) };
  };
  const create = (teams, options={}) => {
    if(!Array.isArray(teams)||teams.length<2||teams.length%2!==0) throw new Error('O torneio precisa de uma quantidade par de equipes.');
    if(teams.some(t=>!t?.name||!Array.isArray(t.members)||t.members.length===0)) throw new Error('Todas as equipes precisam de nome e participantes.');
    bracket={teams:teams.map(t=>({...t,members:[...t.members],available:t.available!==false})),rounds:[],champion:null,format:options.format||'Livre',teamSize:options.teamSize||1,createdAt:Date.now(),version:4};
    bracket.rounds.push(_makeRound(options.manual?bracket.teams:_shuffle(bracket.teams))); return bracket;
  };
  const load = () => { const saved=DB.getTournament(); bracket=saved&&[3,4].includes(saved.version)?saved:null;if(bracket){bracket.version=4;(bracket.teams||[]).forEach(t=>{if(typeof t.available!=='boolean')t.available=true;});}return bracket; };
  const reset = () => { bracket=null; };
  const _label = team => team?.name||'Equipe';
  const _roster = team => (team?.members||[]).join(', ');
  const _escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const _playerKey = name => String(name||'').trim().toLocaleLowerCase('pt-BR');
  const _evaluateRound = ri => {
    const r=bracket.rounds[ri]; if(!r||!r.matches.every(m=>m.winner))return;
    const qualified=[...(r.carried||[]),...r.matches.map(m=>m.winner)];
    if(qualified.length===1){bracket.champion=qualified[0];return;}
    if(qualified.length%2!==0){r.awaitingDirectAdvance=true;return;}
    bracket.rounds.push(_makeRound(_shuffle(qualified)));
  };
  const setResult = (ri,mi,side,kills) => {
    if(!bracket)return null; const r=bracket.rounds[ri],m=r?.matches[mi]; if(!m)return null;
    const winner=side==='t1'?m.t1:m.t2; if(!winner)return null;
    const players=[...(m.t1.members||[]),...(m.t2.members||[])];
    if(!Array.isArray(kills)||kills.length!==players.length)return null;
    const killMap=new Map(kills.map(entry=>[_playerKey(entry.player),Number(entry.kills)]));
    if(players.some(player=>!killMap.has(_playerKey(player))||!Number.isInteger(killMap.get(_playerKey(player)))||killMap.get(_playerKey(player))<0))return null;
    const normalizedKills=players.map(player=>({player,kills:killMap.get(_playerKey(player))}));
    const maxKills=Math.max(...normalizedKills.map(entry=>entry.kills));
    const mvps=normalizedKills.filter(entry=>entry.kills===maxKills).map(entry=>entry.player);
    const previousConfirmedAt=m.result?.confirmedAt||Date.now();
    bracket.rounds=bracket.rounds.slice(0,ri+1); bracket.champion=null; r.awaitingDirectAdvance=false;r.directAdvance=null;m.winner=winner;
    m.result={kills:normalizedKills,mvps,totalKills:normalizedKills.reduce((sum,entry)=>sum+entry.kills,0),confirmedAt:previousConfirmedAt,updatedAt:Date.now()};
    _evaluateRound(ri);return bracket;
  };
  const setWinner = () => null;
  const setDirectAdvance = (ri,teamId) => {
    if(!bracket)return null;const r=bracket.rounds[ri];if(!r?.awaitingDirectAdvance||!r.matches.every(m=>m.winner))return null;
    const qualified=[...(r.carried||[]),...r.matches.map(m=>m.winner)],selected=qualified.find(t=>t.id===teamId);if(!selected)return null;
    const remaining=qualified.filter(t=>t.id!==teamId);if(!remaining.length||remaining.length%2!==0)return null;
    r.directAdvance=selected;r.awaitingDirectAdvance=false;bracket.rounds=bracket.rounds.slice(0,ri+1);bracket.rounds.push(_makeRound(_shuffle(remaining),[selected]));
    return bracket;
  };
  const _editable = position => {
    const round=bracket?.rounds?.[position?.roundIdx],match=round?.matches?.[position?.matchIdx];
    return !!match&&!match.winner&&!match.result&&position.roundIdx===bracket.rounds.length-1;
  };
  const setAvailability = (teamId,available) => {
    const team=bracket?.teams?.find(t=>t.id===teamId);if(!team)return null;
    team.available=!!available;
    (bracket.rounds||[]).forEach(r=>[...(r.matches||[]).flatMap(m=>[m.t1,m.t2]),...(r.carried||[])].forEach(t=>{if(t?.id===teamId)t.available=!!available;}));
    return bracket;
  };
  const updateNames = updates => {
    if(!bracket||!Array.isArray(updates))return null;
    const byId=new Map(updates.map(update=>[update.id,update]));
    const playerRenames=new Map();
    (bracket.teams||[]).forEach(team=>{
      const update=byId.get(team.id);if(!update)return;
      (team.members||[]).forEach((oldName,index)=>playerRenames.set(_playerKey(oldName),update.members[index]));
      team.name=update.name;team.members=[...update.members];
    });
    const syncTeam=team=>{const update=byId.get(team?.id);if(update){team.name=update.name;team.members=[...update.members];}};
    (bracket.rounds||[]).forEach(round=>{
      (round.matches||[]).forEach(match=>{
        syncTeam(match.t1);syncTeam(match.t2);syncTeam(match.winner);
        if(match.result){
          (match.result.kills||[]).forEach(entry=>{entry.player=playerRenames.get(_playerKey(entry.player))||entry.player;});
          match.result.mvps=(match.result.mvps||[]).map(name=>playerRenames.get(_playerKey(name))||name);
        }
      });
      (round.carried||[]).forEach(syncTeam);syncTeam(round.directAdvance);
    });
    syncTeam(bracket.champion);
    return bracket;
  };
  const swapTeams = (a,b,{lock=true}={}) => {
    if(!_editable(a)||!_editable(b))return null;const ma=bracket.rounds[a.roundIdx].matches[a.matchIdx],mb=bracket.rounds[b.roundIdx].matches[b.matchIdx];
    const ta=ma[a.side],tb=mb[b.side];if(!ta||!tb)return null;ma[a.side]=tb;mb[b.side]=ta;
    if(lock){ma.manual=true;mb.manual=true;}return bracket;
  };
  const setRoundOrder = (roundIdx,teamIds) => {
    const round=bracket?.rounds?.[roundIdx];if(!round||roundIdx!==bracket.rounds.length-1||round.matches.some(m=>m.winner||m.result))return null;
    const current=round.matches.flatMap(m=>[m.t1,m.t2]),byId=new Map(current.map(t=>[t.id,t]));
    if(teamIds.length!==current.length||new Set(teamIds).size!==current.length||teamIds.some(id=>!byId.has(id)))return null;
    round.matches.forEach((m,i)=>{m.t1=byId.get(teamIds[i*2]);m.t2=byId.get(teamIds[i*2+1]);m.manual=true;});return bracket;
  };
  const arrangeSmart = roundIdx => {
    const round=bracket?.rounds?.[roundIdx];if(!round||roundIdx!==bracket.rounds.length-1||round.matches.some(m=>m.winner||m.result))return null;
    const open=round.matches.filter(m=>!m.manual),pool=_shuffle(open.flatMap(m=>[m.t1,m.t2]));
    const yes=pool.filter(t=>t.available!==false),no=pool.filter(t=>t.available===false),ordered=[];
    while(yes.length>=2)ordered.push(yes.pop(),yes.pop());while(no.length>=2)ordered.push(no.pop(),no.pop());ordered.push(...yes,...no);
    open.forEach((m,i)=>{m.t1=ordered[i*2];m.t2=ordered[i*2+1];});return bracket;
  };
  const randomizeRound = roundIdx => {
    const round=bracket?.rounds?.[roundIdx];if(!round||roundIdx!==bracket.rounds.length-1||round.matches.some(m=>m.winner||m.result))return null;
    const open=round.matches.filter(m=>!m.manual),pool=_shuffle(open.flatMap(m=>[m.t1,m.t2]));open.forEach((m,i)=>{m.t1=pool[i*2];m.t2=pool[i*2+1];});return bracket;
  };
  const render = () => {
    if(!bracket)return '<p style="color:var(--muted);text-align:center;padding:40px">Nenhum torneio ativo.</p>';
    let html='<div class="bracket-scroll"><div class="bracket-wrap bracket-wrap-dynamic">';
    bracket.rounds.forEach((r,ri)=>{
      html+=`<div class="bracket-col"><div class="bracket-round-label">${r.name}</div><div class="bracket-round-body">`;
      const renderMatch=(m,mi)=>{const w1=m.winner?.id===m.t1.id,w2=m.winner?.id===m.t2.id;const result=m.result,canEdit=Storage.isAdmin()&&!m.winner&&ri===bracket.rounds.length-1;const slot=(t,side,win,seed)=>`<div class="match-slot ${win?'match-winner':m.winner?'match-loser':''} ${canEdit?'match-slot-editable':''}" ${canEdit?`onclick="UI.selectBracketTeam(${ri},${mi},'${side}')" role="button" tabindex="0"`:''}><span class="match-seed">${seed}</span><span class="team-availability ${t.available===false?'team-unavailable':'team-available'}" title="${t.available===false?'Indisponível':'Disponível'}">${t.available===false?'🔴':'🟢'}</span><span class="match-team-name" title="${_escape(_roster(t))}">${_escape(_label(t))}</span>${win?'<span class="match-crown">✓</span>':''}</div>`;return `<div class="match-card ${result?'match-card-result':''} ${m.manual?'match-manual':''}">
        ${slot(m.t1,'t1',w1,mi*2+1)}
        ${slot(m.t2,'t2',w2,mi*2+2)}
        ${m.manual?'<div class="manual-match-label">🔒 Definido manualmente</div>':''}
        ${result?`<div class="match-result-summary">${result.kills.map(entry=>`<span>${_escape(entry.player)} <b>${entry.kills}</b></span>`).join('')}<small>⭐ MVP: ${result.mvps.map(_escape).join(', ')}</small></div>`:''}
        ${Storage.isAdmin()?`<button class="match-result-btn" onclick="UI.openTournamentResult(${ri},${mi})">${result?'Editar resultado':'Registrar resultado'}</button>`:''}
      </div>`;};
      for(let i=0;i<r.matches.length;i+=2){const group=r.matches.slice(i,i+2);html+=`<div class="bracket-pair ${group.length===1?'bracket-pair-single':''}">${group.map((m,offset)=>renderMatch(m,i+offset)).join('')}</div>`;}
      if(r.carried?.length)html+=`<div class="direct-carry-card"><span>↗</span><div><strong>${_label(r.carried[0])}</strong><small>Avanço direto escolhido manualmente</small></div></div>`;
      if(r.awaitingDirectAdvance){const q=[...(r.carried||[]),...r.matches.map(m=>m.winner)];html+=`<div class="manual-advance-box"><strong>Esta fase possui ${q.length} equipes classificadas.</strong><p>${Storage.isAdmin()?'Escolha manualmente uma equipe para avançar diretamente:':'Aguardando o admin definir o avanço direto.'}</p>${Storage.isAdmin()?`<div class="manual-advance-actions">${q.map(t=>`<button class="btn btn-ghost btn-sm" onclick="UI.chooseDirectAdvance(${ri},'${t.id}')">↗ ${_label(t)}</button>`).join('')}</div>`:''}</div>`;}
      html+='</div></div>';
    });
    html+='</div></div>';if(bracket.champion)html+=`<div class="champion-banner">👑 Campeão: <strong>${_escape(_label(bracket.champion))}</strong></div>`;return html;
  };
  const getStats = () => {
    if(!bracket)return {ranking:[],matchMvps:[],overallMvps:[],topKillers:[]};
    const players=new Map();
    (bracket.teams||[]).forEach(team=>(team.members||[]).forEach(name=>players.set(_playerKey(name),{name,kills:0,mvps:0,matches:0})));
    const matchMvps=[];
    (bracket.rounds||[]).forEach((round,ri)=>(round.matches||[]).forEach((match,mi)=>{
      if(!match.result)return;
      (match.result.kills||[]).forEach(entry=>{const p=players.get(_playerKey(entry.player));if(p){p.kills+=Number(entry.kills)||0;p.matches++;}});
      (match.result.mvps||[]).forEach(name=>{const p=players.get(_playerKey(name));if(p)p.mvps++;});
      matchMvps.push({round:round.name,match:mi+1,players:[...(match.result.mvps||[])]});
    }));
    const ranking=[...players.values()].sort((a,b)=>b.kills-a.kills||b.mvps-a.mvps||a.name.localeCompare(b.name,'pt-BR'));
    const maxKills=ranking[0]?.kills??0,maxMvps=Math.max(0,...ranking.map(p=>p.mvps));
    return {ranking,matchMvps,topKillers:ranking.filter(p=>p.kills===maxKills&&maxKills>0),overallMvps:ranking.filter(p=>p.mvps===maxMvps&&maxMvps>0)};
  };
  return {create,load,reset,setWinner,setResult,setDirectAdvance,setAvailability,updateNames,swapTeams,setRoundOrder,arrangeSmart,randomizeRound,render,getStats,getBracket:()=>bracket};
})();
