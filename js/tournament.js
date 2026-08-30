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
    bracket={teams:teams.map(t=>({...t,members:[...t.members]})),rounds:[],champion:null,format:options.format||'Livre',teamSize:options.teamSize||1,createdAt:Date.now(),version:3};
    bracket.rounds.push(_makeRound(_shuffle(bracket.teams))); return bracket;
  };
  const load = () => { const saved=DB.getTournament(); bracket=saved?.version===3?saved:null; return bracket; };
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
  const render = () => {
    if(!bracket)return '<p style="color:var(--muted);text-align:center;padding:40px">Nenhum torneio ativo.</p>';
    let html='<div class="bracket-scroll"><div class="bracket-wrap bracket-wrap-dynamic">';
    bracket.rounds.forEach((r,ri)=>{
      html+=`<div class="bracket-col"><div class="bracket-round-label">${r.name}</div><div class="bracket-round-body">`;
      const renderMatch=(m,mi)=>{const w1=m.winner?.id===m.t1.id,w2=m.winner?.id===m.t2.id;const result=m.result;return `<div class="match-card ${result?'match-card-result':''}">
        <div class="match-slot ${w1?'match-winner':m.winner?'match-loser':''}"><span class="match-seed">${mi*2+1}</span><span class="match-team-name" title="${_escape(_roster(m.t1))}">${_escape(_label(m.t1))}</span>${w1?'<span class="match-crown">✓</span>':''}</div>
        <div class="match-slot ${w2?'match-winner':m.winner?'match-loser':''}"><span class="match-seed">${mi*2+2}</span><span class="match-team-name" title="${_escape(_roster(m.t2))}">${_escape(_label(m.t2))}</span>${w2?'<span class="match-crown">✓</span>':''}</div>
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
  return {create,load,reset,setWinner,setResult,setDirectAdvance,render,getStats,getBracket:()=>bracket};
})();
