const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { Telegraf } = require('telegraf');
const express = require('express');
const QRCode = require('qrcode');

require('dotenv').config();

// === CONFIGURAZIONE PER NORTHFLANK ===
console.log('🔧 === CONFIGURAZIONE NORTHFLANK ===');
console.log('PORT:', process.env.PORT || 8080);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('TELEGRAM_BOT_TOKEN presente:', !!process.env.TELEGRAM_BOT_TOKEN);
console.log('TELEGRAM_CHANNEL_ID:', process.env.TELEGRAM_CHANNEL_ID || 'Auto-detect');
console.log('WHATSAPP_CHANNEL_ID:', process.env.WHATSAPP_CHANNEL_ID);
console.log('PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH);
console.log('PUPPETEER_SKIP_CHROMIUM_DOWNLOAD:', process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD);
console.log('=====================================\n');

// Configurazione
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const WHATSAPP_CHANNEL_ID = process.env.WHATSAPP_CHANNEL_ID || '120363402931610117@newsletter';
const PORT = process.env.PORT || 8080;

// Express server
const app = express();
let qrCodeData = null;
let isWhatsAppReady = false;
let whatsappClient = null;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// === ENDPOINTS ===

app.get('/', (req, res) => {
    if (isWhatsAppReady) {
        res.send(`
            <html>
                <head>
                    <title>Sistema Prezzi WOW - NorthFlank</title>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 20px; background: #f5f5f5; }
                        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .status { color: #28a745; font-weight: bold; font-size: 18px; }
                        .button { 
                            background: #25D366; color: white; padding: 12px 24px; 
                            text-decoration: none; border-radius: 5px; margin: 10px;
                            display: inline-block; transition: background 0.3s;
                        }
                        .button:hover { background: #1da851; }
                        .platform { background: #007bff; color: white; padding: 5px 10px; border-radius: 3px; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>🏷️ Sistema Prezzi WOW</h1>
                        <span class="platform">NorthFlank</span>
                        <p class="status">✅ WhatsApp connesso e sistema operativo</p>
                        
                        <h3>🔧 Strumenti:</h3>
                        <a href="/status" class="button">📊 Status JSON</a>
                        <a href="/channels" class="button">📺 Lista Canali</a>
                        <a href="/health" class="button">💚 Health Check</a>
                        
                        <h3>📱 Comandi Telegram Bot:</h3>
                        <p><strong>/status</strong> - Stato del sistema</p>
                        <p><strong>/channels</strong> - Aggiorna lista canali WhatsApp</p>
                        
                        <div style="margin-top: 30px; font-size: 12px; color: #666;">
                            Sistema attivo su NorthFlank - Monitoraggio @prezzi_wow → Canale WhatsApp
                        </div>
                    </div>
                </body>
            </html>
        `);
    } else if (qrCodeData) {
        res.send(`
            <html>
                <head>
                    <title>Connetti WhatsApp - NorthFlank</title>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                        .container { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .qr-code { max-width: 300px; margin: 20px 0; border: 1px solid #ddd; border-radius: 5px; }
                        .platform { background: #007bff; color: white; padding: 5px 10px; border-radius: 3px; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <span class="platform">NorthFlank</span>
                        <h1>📱 Connetti WhatsApp</h1>
                        <p>Usa WhatsApp per scansionare questo codice QR:</p>
                        <img src="${qrCodeData}" alt="QR Code" class="qr-code">
                        <p><small>La pagina si aggiornerà automaticamente tra 10 secondi</small></p>
                        <script>
                            setTimeout(() => location.reload(), 10000);
                        </script>
                    </div>
                </body>
            </html>
        `);
    } else {
        res.send(`
            <html>
                <head>
                    <title>Inizializzazione... - NorthFlank</title>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                        .container { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .platform { background: #007bff; color: white; padding: 5px 10px; border-radius: 3px; font-size: 12px; }
                        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 2s linear infinite; margin: 20px auto; }
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <span class="platform">NorthFlank</span>
                        <h1>🔄 Inizializzazione Sistema</h1>
                        <div class="spinner"></div>
                        <p>Il sistema si sta avviando, attendere...</p>
                        <p><small>Chrome loading e configurazione Puppeteer in corso...</small></p>
                        <script>
                            setTimeout(() => location.reload(), 5000);
                        </script>
                    </div>
                </body>
            </html>
        `);
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        platform: 'NorthFlank',
        whatsappReady: isWhatsAppReady,
        telegramBotConfigured: !!TELEGRAM_BOT_TOKEN,
        chromeExecutable: process.env.PUPPETEER_EXECUTABLE_PATH,
        chromeSkipDownload: process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD,
        timestamp: new Date().toISOString(),
    });
});

app.get('/ping', (req, res) => {
    res.send('pong');
});

app.get('/status', (req, res) => {
    res.json({
        platform: 'NorthFlank',
        whatsappReady: isWhatsAppReady,
        telegramBotConfigured: !!TELEGRAM_BOT_TOKEN,
        whatsappChannelId: WHATSAPP_CHANNEL_ID,
        telegramChannelId: TELEGRAM_CHANNEL_ID || 'Auto-detect',
        chromeExecutable: process.env.PUPPETEER_EXECUTABLE_PATH,
        port: PORT,
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});

// === CONFIGURAZIONE PUPPETEER OTTIMIZZATA PER NORTHFLANK ===

function getNorthFlankPuppeteerConfig() {
    console.log('🐳 === CONFIGURAZIONE PUPPETEER NORTHFLANK ===');

    const config = {
        headless: true, // OBBLIGATORIO in ambiente container
        args: [
            // Sicurezza container
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',

            // Ottimizzazioni performance
            '--disable-accelerated-2d-canvas',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-features=VizDisplayCompositor',
            '--disable-ipc-flooding-protection',

            // Gestione memoria
            '--memory-pressure-off',
            '--max_old_space_size=4096',

            // Ottimizzazioni network
            '--aggressive-cache-discard',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-extensions',
            '--disable-sync',

            // Stabilità
            '--disable-web-security',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Importante per NorthFlank
        ],
        defaultViewport: {
            width: 1280,
            height: 720,
        },
        timeout: 90000, // Timeout generoso per NorthFlank
        protocolTimeout: 90000,
    };

    // Verifica se abbiamo il path di Chrome dal Docker
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        config.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        console.log('✅ Chrome executable configurato:', process.env.PUPPETEER_EXECUTABLE_PATH);
    } else {
        console.log('⚠️ PUPPETEER_EXECUTABLE_PATH non impostato, usando Chrome di default');
    }

    console.log('📋 Configurazione Puppeteer finale:');
    console.log('   Headless:', config.headless);
    console.log('   Args:', config.args.length, 'parametri');
    console.log('   Timeout:', config.timeout + 'ms');
    console.log('   Executable:', config.executablePath || 'Default Puppeteer Chrome');
    console.log('=============================================\n');

    return config;
}

// === INIZIALIZZAZIONE WHATSAPP ===

function initWhatsApp() {
    console.log('🚀 Inizializzazione WhatsApp Client per NorthFlank...');

    const puppeteerConfig = getNorthFlankPuppeteerConfig();

    whatsappClient = new Client({
        authStrategy: new LocalAuth({
            dataPath: './whatsapp_session',
        }),
        puppeteer: puppeteerConfig,
    });

    // Event handlers
    whatsappClient.on('qr', async (qr) => {
        console.log('📱 QR Code ricevuto, generando immagine...');
        try {
            qrCodeData = await QRCode.toDataURL(qr, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF',
                },
            });
            console.log('✅ QR Code generato per NorthFlank UI');
        } catch (err) {
            console.error('❌ Errore nella generazione del QR Code:', err);
        }
    });

    whatsappClient.on('ready', async () => {
        console.log('✅ WhatsApp Client è pronto su NorthFlank!');
        console.log(`🎯 Canale target configurato: ${WHATSAPP_CHANNEL_ID}`);
        isWhatsAppReady = true;
        qrCodeData = null;

        // Verifica rapida del canale target
        await logWhatsAppChannels();
    });

    whatsappClient.on('authenticated', () => {
        console.log('🔐 WhatsApp autenticato su NorthFlank');
    });

    whatsappClient.on('auth_failure', (msg) => {
        console.error('❌ Fallimento autenticazione:', msg);
        isWhatsAppReady = false;
    });

    whatsappClient.on('disconnected', (reason) => {
        console.log('⚠️ WhatsApp disconnesso:', reason);
        isWhatsAppReady = false;

        // Riconnessione automatica dopo 45 secondi (NorthFlank friendly)
        setTimeout(() => {
            console.log('🔄 Tentativo di riconnessione automatica...');
            initWhatsApp();
        }, 45000);
    });

    whatsappClient.on('error', (error) => {
        console.error('❌ Errore WhatsApp Client:', error);

        if (error.message.includes('Failed to launch') || error.message.includes('Chrome')) {
            console.error('💡 SUGGERIMENTI NORTHFLANK:');
            console.error("   1. Verifica che il Dockerfile usi l'immagine Puppeteer corretta");
            console.error("   2. Controlla le variabili d'ambiente PUPPETEER_*");
            console.error('   3. Assicurati che Chrome sia installato nel container');
        }
    });

    // Inizializza con gestione errori robusta
    whatsappClient.initialize().catch((error) => {
        console.error('❌ Errore fatale durante inizializzazione WhatsApp:', error);

        // Log dettagliato per debugging su NorthFlank
        console.error('🔍 Debug info:');
        console.error('   Node version:', process.version);
        console.error('   Platform:', process.platform);
        console.error('   Architecture:', process.arch);
        console.error(
            '   Memory:',
            Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        );

        // Tentativo di restart dopo 60 secondi
        setTimeout(() => {
            console.log('🔄 Restart automatico dopo errore fatale...');
            process.exit(1); // NorthFlank riavvierà automaticamente
        }, 60000);
    });
}

// === INIZIALIZZAZIONE TELEGRAM ===

function initTelegram() {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error('❌ TELEGRAM_BOT_TOKEN non configurato');
        return;
    }

    console.log('🤖 Inizializzazione Telegram Bot per NorthFlank...');
    const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

    // Gestione messaggi dal canale Telegram
    bot.on('channel_post', async (ctx) => {
        if (!isWhatsAppReady) {
            console.log('⚠️ WhatsApp non ancora pronto, messaggio ignorato');
            return;
        }

        const message = ctx.channelPost;
        const channelUsername = message.chat.username;

        console.log(
            `📨 [NorthFlank] Messaggio ricevuto dal canale: @${channelUsername || 'unknown'}`,
        );

        try {
            console.log(`🎯 Inoltrando messaggio da @${channelUsername} verso canale WhatsApp...`);
            await forwardToWhatsApp(message);
            console.log('✅ Messaggio inoltrato con successo su WhatsApp');
        } catch (error) {
            console.error("❌ Errore nell'inoltro del messaggio:", error);

            if (error.message && error.message.includes('@newsletter')) {
                console.log(
                    "💡 SUGGERIMENTO: L'ID nel messaggio di errore potrebbe essere quello corretto da usare come WHATSAPP_CHANNEL_ID",
                );
            }
        }
    });

    bot.launch({
        dropPendingUpdates: true, // Ignora messaggi pendenti al riavvio
    })
        .then(() => {
            console.log('✅ Telegram Bot avviato su NorthFlank');
        })
        .catch((error) => {
            console.error('❌ Errore avvio Telegram bot:', error);
        });

    // Graceful shutdown per NorthFlank
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// === FUNZIONI DI SUPPORTO ===

// Funzione per gestire entità Telegram (mantieni quella esistente)
function convertTelegramFormatting(text, entities) {
    if (!entities || entities.length === 0) {
        return text;
    }

    const formatMap = new Map();

    for (const entity of entities) {
        const start = entity.offset;
        const end = entity.offset + entity.length;

        for (let i = start; i < end; i++) {
            if (!formatMap.has(i)) {
                formatMap.set(i, new Set());
            }

            switch (entity.type) {
                case 'bold':
                    formatMap.get(i).add('bold');
                    break;
                case 'italic':
                    formatMap.get(i).add('italic');
                    break;
                case 'strikethrough':
                    formatMap.get(i).add('strikethrough');
                    break;
                case 'code':
                    formatMap.get(i).add('code');
                    break;
                case 'spoiler':
                    formatMap.get(i).add('spoiler');
                    break;
            }
        }
    }

    let result = '';
    let currentFormats = new Set();

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const newFormats = formatMap.get(i) || new Set();

        // Chiudi i tag che non sono più attivi
        const toClose = [...currentFormats].filter((f) => !newFormats.has(f));
        for (const format of toClose.reverse()) {
            if (format === 'bold') result += '*';
            else if (format === 'italic') result += '_';
            else if (format === 'strikethrough') result += '~';
            else if (format === 'code') result += '`';
            currentFormats.delete(format);
        }

        // Apri i nuovi tag
        const toOpen = [...newFormats].filter((f) => !currentFormats.has(f) && f !== 'spoiler');
        for (const format of toOpen) {
            if (format === 'bold') result += '*';
            else if (format === 'italic') result += '_';
            else if (format === 'strikethrough') result += '~';
            else if (format === 'code') result += '`';
            currentFormats.add(format);
        }

        result += char;
    }

    // Chiudi tutti i tag rimasti aperti
    for (const format of [...currentFormats].reverse()) {
        if (format === 'bold') result += '*';
        else if (format === 'italic') result += '_';
        else if (format === 'strikethrough') result += '~';
        else if (format === 'code') result += '`';
    }

    return result;
}

// Le altre funzioni rimangono uguali (forwardToWhatsApp, getFileUrl, logWhatsAppChannels)
async function forwardToWhatsApp(telegramMessage) {
    if (!whatsappClient || !isWhatsAppReady) {
        throw new Error('WhatsApp client non pronto');
    }

    let content = '';
    let media = null;

    if (telegramMessage.text) {
        content = convertTelegramFormatting(telegramMessage.text, telegramMessage.entities);
    }

    if (telegramMessage.caption) {
        content = convertTelegramFormatting(
            telegramMessage.caption,
            telegramMessage.caption_entities,
        );
    }

    // Gestione media (foto, video, documenti)
    if (telegramMessage.photo) {
        const photo = telegramMessage.photo[telegramMessage.photo.length - 1];
        const fileUrl = await getFileUrl(photo.file_id);
        media = await MessageMedia.fromUrl(fileUrl, {
            unsafeMime: true,
            filename: `image_${Date.now()}.jpg`,
        });
    }

    if (telegramMessage.video) {
        const fileUrl = await getFileUrl(telegramMessage.video.file_id);
        media = await MessageMedia.fromUrl(fileUrl, {
            unsafeMime: true,
            filename: telegramMessage.video.file_name || `video_${Date.now()}.mp4`,
        });
    }

    if (telegramMessage.document) {
        const fileUrl = await getFileUrl(telegramMessage.document.file_id);
        media = await MessageMedia.fromUrl(fileUrl, {
            filename: telegramMessage.document.file_name,
            unsafeMime: true,
        });
    }

    // Invia al canale WhatsApp
    const channelId = WHATSAPP_CHANNEL_ID;

    if (media) {
        await whatsappClient.sendMessage(channelId, media, {
            caption: content || undefined,
            sendMediaAsDocument: false,
        });
    } else if (content) {
        await whatsappClient.sendMessage(channelId, content);
    }
}

async function getFileUrl(fileId) {
    const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
    const file = await bot.telegram.getFile(fileId);
    return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;
}

// Funzione semplificata per loggare solo il canale target
async function logWhatsAppChannels() {
    try {
        console.log('\n📺 === VERIFICA CANALE TARGET ===');

        const channels = await whatsappClient.getChannels();
        const targetChannel = channels.find(
            (ch) => (ch.id._serialized || ch.id) === WHATSAPP_CHANNEL_ID,
        );

        if (targetChannel) {
            console.log('✅ Canale target trovato:');
            console.log(`   Nome: ${targetChannel.name || 'N/A'}`);
            console.log(`   ID: ${WHATSAPP_CHANNEL_ID}`);
            console.log(`   Status: Configurato correttamente`);
        } else {
            console.log('❌ Canale target NON trovato');
            console.log(`   ID cercato: ${WHATSAPP_CHANNEL_ID}`);
            console.log(`   Canali disponibili: ${channels.length}`);
            console.log("   Verifica l'ID del canale nelle variabili d'ambiente");
        }

        console.log('═══════════════════════════════════════\n');
    } catch (error) {
        console.error('❌ Errore nella verifica del canale:', error);
    }
}

// Avvia il sistema
console.log('🚀 Avviando il sistema...');
console.log(`🎯 Canale WhatsApp target: ${WHATSAPP_CHANNEL_ID}`);

// Avvia Express server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server HTTP avviato sulla porta ${PORT}`);
    console.log(`🌐 Indirizzo: 0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
    console.error('❌ Errore server:', err);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Ricevuto SIGTERM, spegnimento graceful...');
    server.close(() => {
        console.log('✅ Server chiuso');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Ricevuto SIGINT, spegnimento graceful...');
    server.close(() => {
        console.log('✅ Server chiuso');
        process.exit(0);
    });
});

// Inizializza i client
initWhatsApp();
setTimeout(() => {
    initTelegram();
}, 5000); // Aspetta 5 secondi per l'inizializzazione di WhatsApp

// Gestione errori non catturati
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
});
