# FF Squad Manager 🎮

Gerenciador de salas, sorteios, perfis, estatísticas e torneios de Free Fire com Firebase Authentication e Realtime Database.

## Segurança

Este projeto é hospedado no GitHub Pages. Portanto, todo HTML, CSS, JavaScript e `firebaseConfig` enviado ao navegador é público e deve ser tratado como público.

O `firebaseConfig` web — inclusive `apiKey`, `projectId` e `databaseURL` — identifica o projeto Firebase, mas não é uma credencial administrativa. A proteção real é feita por:

- Firebase Authentication;
- Firebase Authentication para ações administrativas;
- regras de segurança de [database.rules.json](database.rules.json);
- validação de propriedade por `auth.uid`;
- resultados oficiais imutáveis e vinculados a uma sala.

Nunca coloque senhas, service accounts, chaves privadas ou tokens administrativos neste repositório.

## Configuração obrigatória do Firebase

### 1. Authentication

No Firebase Console, ative:

- **Anônimo**, usado pelos jogadores;
- **E-mail/senha**, usado pela conta principal do DONO. ADMs comuns podem receber o cargo diretamente no UID anônimo persistente do dispositivo.

Jogadores são identificados pelo UID anônimo persistente do Firebase. O nick é apenas nome de exibição. `localStorage` não é autenticação e não guarda estatísticas oficiais.

### 2. Realtime Database

Crie o Realtime Database e publique imediatamente o arquivo `database.rules.json` deste repositório:

```bash
firebase deploy --only database
```

Não use modo de teste em produção e nunca permita escrita pública. O modo de teste serve apenas para desenvolvimento isolado e temporário.

### 3. Primeiro DONO

Crie a conta do proprietário em **Authentication > Users**. Copie o UID dessa conta e, pelo console administrativo do Realtime Database (nunca pelo frontend), crie uma única vez:

```json
"roles": {
  "UID_DA_CONTA_DO_DONO": {
    "role": "owner",
    "label": "Dono",
    "updatedAt": 0
  }
}
```

Depois disso, o DONO concede e remove o cargo `admin` pela aba Jogadores. Um jogador pode copiar o código do próprio dispositivo (seu `auth.uid`) e enviá-lo ao DONO; o cargo passa a aparecer em tempo real, sem senha. As regras impedem que um ADM promova usuários, altere cargos ou modifique o registro do DONO. O acesso do ADM fica vinculado à credencial anônima daquele navegador, portanto limpar os dados do site remove o acesso local e exige nova autorização.

O botão administrativo separa autorização e modo ativo. Desativar o modo ADM apenas oculta temporariamente as funções administrativas naquele navegador; não encerra a autenticação, não troca o UID e não remove `/roles/{uid}`. O próprio ADM autorizado pode reativar o modo. Somente o DONO pode remover definitivamente o cargo no banco.

### 4. Configuração web

Preencha [js/firebase-config.js](js/firebase-config.js) com a configuração web exibida pelo Firebase Console:

```js
window.FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "seu-projeto.firebaseapp.com",
  databaseURL: "https://seu-projeto-default-rtdb.firebaseio.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "...",
  appId: "...",
  syncStats: true,
};
```

Esses valores podem ficar no frontend. Não adicione senhas ou service accounts a esse arquivo.

## Modelo de dados protegido

- `/players/{playerId}`: metadados do perfil; `playerId` é UUID e `ownerUid` é imutável.
- `/userProfiles/{uid}`: associa um UID a um único perfil.
- `/nickClaims/{nickNormalizado}`: reserva atômica que impede nicks duplicados.
- `/sessions/{sessionId}`: salas; criação e gerenciamento exigem autenticação administrativa.
- `/matches/{matchId}`: resultados oficiais imutáveis; somente administradores podem criar.
- `/roles/{uid}`: autorização `owner`/`admin`; apenas o DONO gerencia ADMs.
- `/auditLog`: trilha imutável das ações sensíveis, visível ao DONO.
- `/seasons` e `/seasonResets`: temporada atual, arquivos e marcos de reset sem apagar histórico.

Kills, vitórias, derrotas, MVPs, pontos e rank não são aceitos em `/players`. Essas estatísticas são derivadas exclusivamente de `/matches` oficiais.

## Matriz de permissões

| Ação | Jogador | ADM | DONO |
|---|---:|---:|---:|
| Ver salas, perfis e ranking | Sim | Sim | Sim |
| Alterar o próprio nick | Sim | — | — |
| Criar/operar sala aberta e finalizar uma vez | Não | Sim | Sim |
| Alterar ou apagar resultado finalizado | Não | Não | Sim |
| Corrigir/apagar perfil e zerar métricas | Não | Não | Sim |
| Iniciar temporada e arquivar ranking | Não | Não | Sim |
| Conceder/remover ADM e ver auditoria | Não | Não | Sim |

Esta matriz é aplicada em `database.rules.json`; ocultar controles na interface é apenas uma melhoria visual.

## Limitações importantes

- Sem login tradicional, a identidade do jogador depende da credencial anônima mantida pelo Firebase no navegador. Limpar todos os dados do site ou trocar de navegador cria outra identidade.
- Copiar apenas `localStorage` não copia a autenticação e não transfere o perfil.
- Perfis criados pelo sistema antigo não têm prova confiável de propriedade. A associação desses perfis precisa ser tratada manualmente pelo administrador.

### Contas e reivindicação de perfis antigos

Ative o provedor **E-mail/senha** em Authentication > Sign-in method. O jogador pode criar a conta sem perder um perfil anônimo já vinculado: o Firebase converte a credencial anônima mantendo o mesmo UID. Perfis recuperados com `ownerUid: "RECOVERY_UNCLAIMED"` não podem ser reivindicados por membros; somente o DONO inicia uma transferência e envia o link seguro ao destinatário.

A aprovação preserva o UUID do jogador e altera atomicamente apenas `ownerUid`, `userProfiles/{uid}` e o status do pedido. Partidas, estatísticas, ajustes e histórico não são copiados nem recriados. Publique `database.rules.json` antes de liberar o recurso.

### Transferência por link

Somente `role: "owner"` pode gerar, renovar ou cancelar um link de transferência. O token possui 256 bits aleatórios, uso único e validade de sete dias. O destinatário precisa estar em uma conta comum, mas não precisa confirmar o e-mail. Contas com `role: "admin"` são bloqueadas tanto na interface quanto nas regras do Realtime Database.

Partidas novas armazenam `teamPlayerIds`, `mvpPlayerId` e resultados indexados por `playerId`. Torneios versão 5 armazenam `memberIds` e IDs nos resultados. Registros antigos continuam compatíveis e recebem IDs quando carregados/editados; a exibição sempre procura o nome atual em `/players/{playerId}`. `/playerAliases` mantém a associação segura dos nicks anteriores ao mesmo ID e impede que um nome histórico seja reutilizado por outro perfil.

As fotos são comprimidas no navegador e persistidas no campo `avatar` do perfil (JPG em Data URL, até 180.000 caracteres). Arquivos aceitos: JPEG, PNG e WebP de até 10 MB.
- Limitação e detecção de abuso por IP/dispositivo exigem infraestrutura adicional, como Firebase App Check e uma Cloud Function ou backend confiável. Regras do Realtime Database não são um rate limiter completo.

## Desenvolvimento local

Use preferencialmente o Firebase Emulator Suite. Nunca aponte testes destrutivos para o banco de produção.

Antes de publicar:

1. valide as regras no Emulator Suite;
2. confirme que o provedor Anônimo está ativo;
3. publique `database.rules.json`;
4. teste criação de perfil, reserva de nick, confirmação e finalização de partida.
5. execute `node tests/regression.js` e teste a criação/login da conta, solicitação e aprovação de um perfil recuperado.

## Estrutura

```text
├── index.html
├── database.rules.json
├── firebase.json
├── css/style.css
└── js/
    ├── firebase-config.js
    ├── db.js
    ├── storage.js
    ├── players.js
    ├── sorteio.js
    ├── tournament.js
    └── app.js
```
