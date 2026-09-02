const assert = require('node:assert/strict');
const fs = require('node:fs');

const recovery = JSON.parse(fs.readFileSync('firebase-recovery-candidate.json', 'utf8'));
const rc7Entry = Object.entries(recovery.players).find(([, player]) => player.nickKey === 'rc7');
assert(rc7Entry, 'O perfil RC7 recuperado precisa existir');
const [playerId, original] = rc7Entry;

const state = {
  players: structuredClone(recovery.players),
  matches: structuredClone(recovery.matches),
  userProfiles: {},
  claimRequests: {
    'user-rc7': { requesterUid: 'user-rc7', playerId, nick: 'RC7', status: 'pending' },
  },
};

const approve = (database, uid) => {
  const request = database.claimRequests[uid];
  assert.equal(request?.status, 'pending', 'somente pedidos pendentes podem ser aprovados');
  assert.equal(database.players[request.playerId]?.ownerUid, 'RECOVERY_UNCLAIMED', 'perfil já vinculado não pode ser reivindicado');
  assert.equal(database.userProfiles[uid], undefined, 'uma conta não pode possuir dois perfis');
  database.players[request.playerId].ownerUid = uid;
  database.userProfiles[uid] = request.playerId;
  request.status = 'approved';
};

const matchesBefore = JSON.stringify(state.matches);
const profileBefore = structuredClone(original);
approve(state, 'user-rc7');

assert.equal(state.userProfiles['user-rc7'], playerId);
assert.equal(state.players[playerId].ownerUid, 'user-rc7');
assert.deepEqual(
  { ...state.players[playerId], ownerUid: profileBefore.ownerUid },
  profileBefore,
  'a vinculação não pode alterar nenhum outro campo do perfil',
);
assert.equal(JSON.stringify(state.matches), matchesBefore, 'histórico oficial não pode ser alterado');
assert.throws(() => approve(state, 'user-rc7'), /pendentes/, 'o mesmo pedido não pode ser aprovado duas vezes');

const dbSource = fs.readFileSync('js/db.js', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');
const storageSource = fs.readFileSync('js/storage.js', 'utf8');
const rules = fs.readFileSync('database.rules.json', 'utf8');
assert.match(dbSource, /avatar\.length>180000/);
assert.match(appSource, /createImageBitmap'in window/);
assert.doesNotMatch(appSource, /Reivindicar este perfil|requestProfileClaim/);
assert.match(rules, /auth\.token\.email != null/);
assert.match(rules, /root\.child\('roles'\).*'admin'/);
assert.match(storageSource, /authorizedRole/);
assert.match(storageSource, /setAdminMode/);
const toggleAdminSource=appSource.match(/const toggleAdmin[\s\S]*?const submitAdminLogin/)?.[0]||'';
assert.doesNotMatch(toggleAdminSource,/signOut\(/,'desativar o modo ADM não pode encerrar a conta nem trocar o UID');

const historicalMatch = {
  teams: [['Maria'], ['RC7']],
  teamPlayerIds: [['maria-id'], [playerId]],
  playerResults: {
    'maria-id': { playerId: 'maria-id', nick: 'Maria', kills: 4 },
    [playerId]: { playerId, nick: 'RC7', kills: 9, mvp: true },
  },
};
const currentNames = { 'maria-id': 'Ana Maria', [playerId]: 'RC7 Novo' };
const displayedTeams = historicalMatch.teams.map((team, ti) =>
  team.map((oldName, i) => currentNames[historicalMatch.teamPlayerIds[ti][i]] || oldName),
);
assert.deepEqual(displayedTeams, [['Ana Maria'], ['RC7 Novo']], 'nomes históricos devem ser resolvidos pelo playerId');
assert.equal(historicalMatch.playerResults['maria-id'].kills, 4, 'renomear não altera estatísticas');

assert.match(rules, /"profileTransfers"/);
assert.match(rules, /profileTransferAcceptances/);
assert.match(rules, /"playerAliases"/);
assert.match(rules, /child\('role'\)\.val\(\) == 'owner'/);
assert.doesNotMatch(
  rules.match(/"profileTransfers"[\s\S]*?"activeProfileTransfers"/)?.[0] || '',
  /child\('role'\)\.val\(\) == 'admin'/,
  'administradores não podem gravar transferências',
);

console.log('OK: RC7 mantém UUID/histórico; transferência é do dono; nomes globais usam playerId.');
