# 📱 Telegram to WhatsApp Forwarder

Sistema per inoltrare automaticamente messaggi da un canale Telegram a un gruppo/contatto WhatsApp, deployabile su Render.

## 🎯 Caratteristiche

-   ✅ Inoltra messaggi di testo, foto, video e documenti
-   ✅ Supporta canali Telegram pubblici e privati
-   ✅ Interfaccia web per scansionare il QR Code di WhatsApp
-   ✅ Deploy semplice su Render
-   ✅ Sessioni persistenti (non serve ri-scansionare il QR ad ogni riavvio)
-   ✅ Gestione errori e riconnessione automatica

## 🚀 Setup Rapido

### 1. Crea il Bot Telegram

1. Apri Telegram e cerca `@BotFather`
2. Invia `/newbot` e segui le istruzioni
3. Salva il **token** che ricevi
4. Aggiungi il bot al canale Telegram come amministratore

### 2. Ottieni gli ID necessari

**ID del Canale Telegram:**

```javascript
// Metodo 1: Usa questo bot per trovare l'ID
// Cerca @userinfobot su Telegram e inoltrale un messaggio dal canale

// Metodo 2: Controlla i log una volta deployato
// L'ID apparirà nei log quando il bot riceve messaggi
```

**ID del Gruppo WhatsApp:**

```javascript
// Si ottiene automaticamente dai log una volta che il sistema è attivo
// Basta inviare un messaggio al gruppo target e controllare i log
```

### 3. Deploy su Render

1. **Fork del repository su GitHub**
2. **Vai su [render.com](https://render.com) e crea un account**
3. **Clicca "New" → "Web Service"**
4. **Connetti il tuo repository GitHub**

**Configurazione Render:**

```
Build Command: npm install
Start Command: npm start
```

**Variabili d'ambiente da configurare:**

```
TELEGRAM_BOT_TOKEN=il_tuo_token_bot
TELEGRAM_CHANNEL_ID=-1001234567890  (opzionale)
WHATSAPP_GROUP_ID=120363...@g.us    (si configura dopo)
```

### 4. Primo Avvio

1. **Deploy completato** → Vai all'URL del tuo servizio
2. **Scansiona il QR Code** con WhatsApp
3. **Sistema attivato** ✅

## 📋 Configurazione Dettagliata

### Variabili d'Ambiente

| Variabile             | Obbligatoria | Descrizione                                                |
| --------------------- | ------------ | ---------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`  | ✅           | Token del bot da @BotFather                                |
| `TELEGRAM_CHANNEL_ID` | ❌           | ID del canale specifico (se non impostato, monitora tutti) |
| `WHATSAPP_GROUP_ID`   | ❌           | ID del gruppo WhatsApp destinazione                        |
| `PORT`                | ❌           | Porta del server (default: 3000)                           |

### Come ottenere l'ID del Gruppo WhatsApp

1. **Avvia il sistema** senza `WHATSAPP_GROUP_ID`
2. **Invia un messaggio** di test dal bot Telegram
3. **Controlla i log** - vedrai un errore con l'ID corretto del gruppo
4. **Copia l'ID** e aggiornalo nelle variabili d'ambiente

Esempio di log:

```
❌ Errore nell'inoltro: Chat 120363025343298765@g.us not found
```

### Struttura del Progetto

```
telegram-whatsapp-forwarder/
├── index.js              # Applicazione principale
├── package.json          # Dipendenze
├── .env.example          # Template variabili d'ambiente
├── render.yaml          # Configurazione Render
├── Dockerfile           # Container (alternativo)
├── README.md            # Questa guida
└── whatsapp_session/    # Sessione WhatsApp (auto-generata)
```

## 🔧 Funzionalità Avanzate

### Testing Locale

```bash
# Clona il repository
git clone <your-repo-url>
cd telegram-whatsapp-forwarder

# Installa dipendenze
npm install

# Crea file .env con le tue configurazioni
cp .env.example .env
# Modifica .env con i tuoi valori

# Avvia in modalità sviluppo
npm run dev
```

### Monitoraggio

-   **Status endpoint:** `https://your-app.onrender.com/status`
-   **Interface web:** `https://your-app.onrender.com/`
-   **Logs:** Visibili nel dashboard di Render

### Comandi Bot Telegram

-   `/status` - Mostra lo stato del sistema
-   Messaggi normali - Vengono inoltrati come test (solo in chat private)

## 🛠️ Risoluzione Problemi

### WhatsApp non si connette

1. **Controlla i log** per errori di autenticazione
2. **Elimina la sessione** e ri-scansiona il QR:
    - Su Render: redeploy del servizio
    - Localmente: elimina la cartella `whatsapp_session/`

### Bot Telegram non riceve messaggi

1. **Verifica il token** nelle variabili d'ambiente
2. **Controlla i permessi** del bot nel canale
3. **Assicurati** che il bot sia amministratore del canale

### Messaggi non vengono inoltrati

1. **Verifica l'ID del gruppo WhatsApp** nei log
2. **Controlla** che il numero sia aggiunto ai contatti
3. **Per i gruppi:** assicurati di essere membro del gruppo

### Deploy su Render fallisce

1. **Controlla le dipendenze** in `package.json`
2. **Verifica** che tutte le variabili d'ambiente siano configurate
3. **Pulisci la build cache** e rideploya

## ⚠️ Limitazioni e Avvertenze

-   WhatsApp non consente ufficialmente bot o client non autorizzati
-   Usa questo sistema a tuo rischio
-   Non garantiamo che non verrai bloccato da WhatsApp
-   Per uso personale/educativo solamente

## 📄 Licenza

Progetto open source per scopi educativi. WhatsApp Web JS è una libreria non ufficiale.

## 🔄 Aggiornamenti

Per aggiornare il sistema:

1. **Pull delle modifiche** dal repository
2. **Redeploy** su Render
3. **La sessione WhatsApp** viene mantenuta

## 💡 Suggerimenti

-   **Testa sempre** prima con messaggi privati al bot
-   **Monitora i log** per identificare problemi
-   **Mantieni backup** delle configurazioni importanti
-   **Usa gruppi di test** prima di configurare quelli principali

## 🆘 Supporto

Se hai problemi:

1. Controlla questa guida
2. Verifica i log di Render
3. Testa localmente per debug
4. Controlla che tutte le variabili siano configurate correttamente
