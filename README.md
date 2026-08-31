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
- **E-mail/senha**, usado somente pelas contas administrativas.

Jogadores são identificados pelo UID anônimo persistente do Firebase. O nick é apenas nome de exibição. `localStorage` não é autenticação e não guarda estatísticas oficiais.

### 2. Realtime Database

Crie o Realtime Database e publique imediatamente o arquivo `database.rules.json` deste repositório:

```bash
firebase deploy --only database
```

Não use modo de teste em produção e nunca permita escrita pública. O modo de teste serve apenas para desenvolvimento isolado e temporário.

### 3. Configuração web

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

Kills, vitórias, derrotas, MVPs, pontos e rank não são aceitos em `/players`. Essas estatísticas são derivadas exclusivamente de `/matches` oficiais.

## Limitações importantes

- Sem login tradicional, a identidade do jogador depende da credencial anônima mantida pelo Firebase no navegador. Limpar todos os dados do site ou trocar de navegador cria outra identidade.
- Copiar apenas `localStorage` não copia a autenticação e não transfere o perfil.
- Perfis criados pelo sistema antigo não têm prova confiável de propriedade. A associação desses perfis precisa ser tratada manualmente pelo administrador.
- Limitação e detecção de abuso por IP/dispositivo exigem infraestrutura adicional, como Firebase App Check e uma Cloud Function ou backend confiável. Regras do Realtime Database não são um rate limiter completo.

## Desenvolvimento local

Use preferencialmente o Firebase Emulator Suite. Nunca aponte testes destrutivos para o banco de produção.

Antes de publicar:

1. valide as regras no Emulator Suite;
2. confirme que o provedor Anônimo está ativo;
3. publique `database.rules.json`;
4. teste criação de perfil, reserva de nick, confirmação e finalização de partida.

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
