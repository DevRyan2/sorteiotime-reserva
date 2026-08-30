// ═══════════════════════════════════════════════════════════════
//  CONFIGURAÇÃO DO FIREBASE
//  Siga o README.md para obter esses valores
//  Cole aqui as credenciais do seu projeto Firebase
// ═══════════════════════════════════════════════════════════════

// the object must be exposed on the global scope so that `db.js` can
// read it via `window.FIREBASE_CONFIG`. Top‑level `const`/`let` declarations
// are *not* added to `window`, which was causing the fallback message even
// though the values were filled in correctly.
window.FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAZQSprWAqNSlD9QGN0tWvM2Kl2YVxHqzY",
  authDomain:        "ff-squad-manager.firebaseapp.com",
  databaseURL:       "https://ff-squad-manager-default-rtdb.firebaseio.com",   // <- o mais importante: termina com .firebaseio.com
  projectId:         "ff-squad-manager",
  storageBucket:     "ff-squad-manager.firebasestorage.app",
  messagingSenderId: "567128938029",
  appId:             "1:567128938029:web:8480c809603289d9094aa4",
  adminEmail:        "painel@sorteiotime.app",
  syncStats:         true,
};

// Se databaseURL estiver como "COLE_AQUI", o app usa localStorage como fallback
// e mostra um aviso pedindo pra configurar o Firebase.
