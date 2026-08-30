# FF Squad Manager 🎮

Gerenciador completo de partidas de Free Fire com **confirmações em tempo real via Firebase**.

---

## 🚀 Como colocar no ar (GitHub Pages + Firebase)

### Passo 1 — Criar o projeto no Firebase

1. Acesse **https://console.firebase.google.com**
2. Clique em **"Adicionar projeto"**
3. Dê um nome (ex: `ff-squad-manager`) → avançar → desativar Google Analytics → **Criar projeto**
4. Quando terminar, clique em **"Continuar"**

---

### Passo 2 — Ativar o Realtime Database

1. No menu lateral esquerdo, clique em **"Build" → "Realtime Database"**
2. Clique em **"Criar banco de dados"**
3. Escolha a região mais próxima (ex: `us-central1` é padrão)
4. Em "Regras de segurança" → selecione **"Iniciar no modo de teste"** → **Ativar**

   > Isso permite leitura e escrita públicas por 30 dias — suficiente pra usar normalmente.
   > Depois desse prazo você pode renovar ou usar as regras abaixo.

**Regras recomendadas** (vão em "Regras" dentro do Realtime Database):
```json
{
  "rules": {
    "sessions": {
      ".read": true,
      ".write": true
    }
  }
}
```

---

### Passo 3 — Pegar as credenciais do Firebase

1. No menu lateral, clique no ícone de engrenagem ⚙️ → **"Configurações do projeto"**
2. Role para baixo até **"Seus aplicativos"**
3. Clique em **"</ >" (Web)**
4. Dê um apelido (ex: `ff-web`) → clique **"Registrar app"**
5. Vai aparecer um código assim:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "ff-squad-manager.firebaseapp.com",
  databaseURL: "https://ff-squad-manager-default-rtdb.firebaseio.com",
  projectId: "ff-squad-manager",
  storageBucket: "ff-squad-manager.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

6. **Copie esses valores** e cole no arquivo `js/firebase-config.js` do projeto

---

### Passo 4 — Configurar o firebase-config.js

Abra o arquivo `js/firebase-config.js` e substitua os `"COLE_AQUI"` pelos valores do passo anterior:

```js
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "ff-squad-manager.firebaseapp.com",
  databaseURL:       "https://ff-squad-manager-default-rtdb.firebaseio.com",  // <- obrigatório
  projectId:         "ff-squad-manager",
  storageBucket:     "ff-squad-manager.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123",
  adminEmail:        "painel@sorteiotime.app",
  syncStats:         true,
};
```

Salas, confirmações, perfis e histórico podem ser compartilhados. Para impedir alterações públicas, ative Firebase Authentication e publique o arquivo `database.rules.json` incluído neste projeto.

### Ativar o painel seguro

1. No Firebase Console, abra **Authentication → Sign-in method**.
2. Ative os provedores **E-mail/senha** e **Anônimo**.
3. Em **Authentication → Users**, crie o usuário `painel@sorteiotime.app` com a senha `PAINELRC`.
4. Em **Realtime Database → Regras**, cole o conteúdo de `database.rules.json` e clique em **Publicar**.

Se usar a Firebase CLI, os arquivos `.firebaserc` e `firebase.json` já estão preparados:

```bash
firebase deploy --only database
```

---

### Passo 5 — Subir no GitHub Pages

1. Crie um repositório no GitHub (pode ser público ou privado)
2. Faça upload de todos os arquivos:
   ```
   ff-sorteio/
   ├── index.html
   ├── css/style.css
   └── js/
       ├── firebase-config.js  ← com suas credenciais
       ├── db.js
       ├── storage.js
       ├── players.js
       ├── sorteio.js
       ├── tournament.js
       └── app.js
   ```
3. Vá em **Settings → Pages → Source: "Deploy from branch" → main → / (root)**
4. Aguarde 1-2 minutos → seu site estará em `https://seunome.github.io/ff-sorteio`

---

## 🔑 Senha de admin

A senha de admin configurada é: **`PAINELRC`**

Clique em "🔒 Admin" no canto superior direito e digite a senha.
O login dura enquanto a aba estiver aberta (fecha a aba → precisa logar de novo). A senha não é armazenada em texto puro no frontend; o cliente compara somente seu hash. Como este repositório não possui backend, ações administrativas só terão proteção forte quando forem combinadas com Firebase Authentication e Security Rules.

---

## ✨ Funcionalidades

| Feature | Descrição |
|---|---|
| 🎲 **Sorteio** | Cola nomes, configura times, gera mensagem pro WhatsApp |
| 📅 **Salas (admin)** | Cria sala com formato 1v1/2v2/3v3/4v4, copia link e manda pro grupo |
| 📤 **Compartilhar sala** | Botão para enviar o link direto pelo WhatsApp |
| 🔒 **Limite automático** | Só permite confirmações até a capacidade do formato; mostra "Sala cheia" e bloqueia entrada |
| 🕒 **Data/hora padrão** | Campos de agendamento já vêm preenchidos com a hora atual no desktop |
| ✅ **Confirmação** | Membro abre o link → digita o nick → aparece pra você em tempo real |
| 🔒 **Anti-spam** | Cada dispositivo confirma uma única vez; pode corrigir o nick 1x |
| 🎲 **Sorteio da sala** | Admin clica "Sortear times" com os confirmados e manda no WhatsApp |
| 👤 **Perfis** | Stats de cada jogador: WR, MVPs, sequência, melhor dupla |
| 🏅 **Conquistas** | Badges automáticos desbloqueados por desempenho |
| 🏆 **Torneio** | Chaveamento automático tipo copa |

---

## 📁 Estrutura de arquivos

```
ff-sorteio/
├── index.html              ← página principal
├── README.md
├── css/
│   └── style.css           ← todos os estilos
└── js/
    ├── firebase-config.js  ← VOCÊ EDITA ESSE ← credenciais Firebase
    ├── db.js               ← integração Firebase (tempo real)
    ├── storage.js          ← dados locais (jogadores, partidas, torneio)
    ├── players.js          ← perfis, stats, conquistas
    ├── sorteio.js          ← lógica de sorteio
    ├── tournament.js       ← chaveamento tipo copa
    └── app.js              ← controlador da UI
```
