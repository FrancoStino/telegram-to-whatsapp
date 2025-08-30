const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { Telegraf } = require('telegraf');
const express = require('express');
const QRCode = require('qrcode');
const qrcode = require('qrcode-terminal');
const fs = require('fs-extra');
const path = require('path');

require('dotenv').config();

// === CONFIGURAZIONE ===
console.log('🔧 === CONFIGURAZIONE ===');
console.log('PORT:', process.env.PORT || 3000);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('TELEGRAM_BOT_TOKEN presente:', !!process.env.TELEGRAM_BOT_TOKEN);
console.log('TELEGRAM_CHANNEL_ID:', process.env.TELEGRAM_CHANNEL_ID || 'Auto-detect');
console.log('WHATSAPP_CHANNEL_ID:', process.env.WHATSAPP_CHANNEL_ID);
console.log('=============================\n');

// Configurazione
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const WHATSAPP_CHANNEL_ID = process.env.WHATSAPP_CHANNEL_ID || '120363402931610117@newsletter';
const PORT = process.env.PORT || 3000;

// Express server
const app = express();
let qrCodeData = null;
let isWhatsAppReady = false;
let whatsappClient = null;
let healthCheckInterval = null;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// === ENDPOINTS ===

app.get('/', (req, res) => {
    if (isWhatsAppReady) {
        res.send(`
        <html>
        <head>
        <title>Sistema Prezzi WOW</title>
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
        </style>
        </head>
        <body>
        <div class="container">
        <h1>🏷️ Sistema Prezzi WOW</h1>
        <p class="status">✅ WhatsApp connesso e sistema operativo</p>

        <h3>🔧 Strumenti:</h3>
        <a href="/status" class="button">📊 Status JSON</a>
        <a href="/channels" class="button">📺 Lista Canali</a>
        <a href="/health" class="button">💚 Health Check</a>
        <a href="/reset" class="button" style="background: #dc3545;">🔄 Reset Session</a>

        <h3>📱 Comandi Telegram Bot:</h3>
        <p><strong>/status</strong> - Stato del sistema</p>
        <p><strong>/channels</strong> - Aggiorna lista canali WhatsApp</p>

        <div style="margin-top: 30px; font-size: 12px; color: #666;">
        Sistema attivo - Monitoraggio @prezzi_wow → Canale WhatsApp
        </div>
        </div>
        </body>
        </html>
        `);
    } else if (qrCodeData) {
        res.send(`
        <html>
        <head>
        <title>Connetti WhatsApp</title>
        <meta charset="utf-8">
        <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .qr-code { max-width: 300px; margin: 20px 0; border: 1px solid #ddd; border-radius: 5px; }
        </style>
        </head>
        <body>
        <div class="container">
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
        <title>Inizializzazione...</title>
        <meta charset="utf-8">
        <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 2s linear infinite; margin: 20px auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .attempts { color: #666; font-size: 12px; margin-top: 10px; }
        </style>
        </head>
        <body>
        <div class="container">
        <h1>🔄 Inizializzazione Sistema</h1>
        <div class="spinner"></div>
        <p>Il sistema si sta avviando, attendere...</p>
        <div class="attempts">Tentativo: ${initializationAttempts}/${MAX_INIT_ATTEMPTS}</div>
        <p><small>Configurazione in corso...</small></p>
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
        whatsappReady: isWhatsAppReady,
        telegramBotConfigured: !!TELEGRAM_BOT_TOKEN,
        initAttempts: initializationAttempts,
        maxAttempts: MAX_INIT_ATTEMPTS,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
    });
});

app.get('/reset', async (req, res) => {
    try {
        console.log('🔄 Reset sessione richiesto via web...');
        await resetWhatsAppSession();
        res.json({ success: true, message: 'Reset avviato, ricarica la pagina tra 30 secondi' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.get('/ping', (req, res) => {
    res.send('pong');
});

app.get('/status', (req, res) => {
    res.json({
        whatsappReady: isWhatsAppReady,
        telegramBotConfigured: !!TELEGRAM_BOT_TOKEN,
        whatsappChannelId: WHATSAPP_CHANNEL_ID,
        telegramChannelId: TELEGRAM_CHANNEL_ID || 'Auto-detect',
        initAttempts: initializationAttempts,
        maxAttempts: MAX_INIT_ATTEMPTS,
        port: PORT,
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
    });
});

app.get('/channels', async (req, res) => {
    if (!isWhatsAppReady) {
        return res.json({ error: 'WhatsApp non connesso' });
    }

    try {
        const channels = await whatsappClient.getChannels();
        res.json({
            channels: channels.map((ch) => ({
                id: ch.id._serialized || ch.id,
                name: ch.name || 'N/A',
            })),
            count: channels.length,
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// === FUNZIONI DI UTILITÀ ===

async function resetWhatsAppSession() {
    console.log('🔄 === RESET SESSIONE WHATSAPP ===');

    isWhatsAppReady = false;
    qrCodeData = null;

    // Ferma health check
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
    }

    // Distruggi client esistente
    if (whatsappClient) {
        try {
            await whatsappClient.destroy();
            console.log('✅ Client esistente distrutto');
        } catch (error) {
            console.log('⚠️ Errore durante distruzione client:', error.message);
        }
        whatsappClient = null;
    }

    // Rimuovi file di sessione
    const sessionPaths = ['./whatsapp_session', './.wwebjs_auth', './.wwebjs_cache'];

    for (const sessionPath of sessionPaths) {
        try {
            if (await fs.pathExists(sessionPath)) {
                await fs.remove(sessionPath);
                console.log(`✅ Rimosso: ${sessionPath}`);
            }
        } catch (error) {
            console.log(`⚠️ Errore rimozione ${sessionPath}:`, error.message);
        }
    }

    // Reset contatore tentativi
    initializationAttempts = 0;

    console.log('🚀 Riavvio inizializzazione WhatsApp...');
    setTimeout(() => {
        initWhatsApp();
    }, 5000);
}

async function isWhatsAppClientHealthy() {
    if (!whatsappClient || !isWhatsAppReady) {
        return false;
    }

    try {
        const state = await whatsappClient.getState();
        console.log('💚 WhatsApp state:', state);
        return state === 'CONNECTED';
    } catch (error) {
        console.log('⚠️ Client WhatsApp non sano:', error.message);
        return false;
    }
}

function startWhatsAppHealthCheck() {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
    }

    healthCheckInterval = setInterval(async () => {
        if (isWhatsAppReady && whatsappClient) {
            try {
                const state = await whatsappClient.getState();
                if (state !== 'CONNECTED') {
                    throw new Error(`State non valido: ${state}`);
                }
                console.log('💚 WhatsApp health check OK');
            } catch (error) {
                console.log('❌ WhatsApp health check fallito:', error.message);

                if (
                    error.message.includes('Session closed') ||
                    error.message.includes('page has been closed') ||
                    error.message.includes('Target closed') ||
                    error.message.includes('UNPAIRED') ||
                    error.message.includes('State non valido')
                ) {
                    console.log('🔄 Forzando reinizializzazione per health check fallito');
                    await resetWhatsAppSession();
                }
            }
        }
    }, 90000); // Check ogni 90 secondi
}

// === CONFIGURAZIONE PUPPETEER MIGLIORATA ===

function getPuppeteerConfig() {
    console.log('🐳 === CONFIGURAZIONE PUPPETEER MIGLIORATA ===');

    const config = {
        headless: 'new', // Usa la nuova modalità headless
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-features=VizDisplayCompositor',
            '--disable-web-security',
            '--disable-features=site-per-process',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-blink-features=AutomationControlled',
            '--no-default-browser-check',
            '--disable-component-updates-ping',
            // Memoria e stabilità
            '--max_old_space_size=2048',
            '--memory-pressure-off',
            // Networking
            '--aggressive-cache-discard',
            '--disable-background-networking',
            '--disable-default-apps',
        ],
        defaultViewport: {
            width: 1366,
            height: 768,
        },
        timeout: 180000, // 3 minuti
        protocolTimeout: 180000,
        keepAlive: false, // Importante per la stabilità
    };

    if (process.env.NODE_ENV === 'production' && process.env.PUPPETEER_EXECUTABLE_PATH) {
        config.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        console.log('✅ Chrome executable configurato:', config.executablePath);
    } else {
        console.log('⚠️ Modalità sviluppo locale, usando Chrome di Puppeteer');
    }

    console.log('📋 Configurazione Puppeteer migliorata completata');
    return config;
}

// === INIZIALIZZAZIONE WHATSAPP MIGLIORATA ===

function initWhatsApp() {
    initializationAttempts++;
    console.log(
        `🚀 Inizializzazione WhatsApp Client (tentativo ${initializationAttempts}/${MAX_INIT_ATTEMPTS})...`,
    );

    if (initializationAttempts > MAX_INIT_ATTEMPTS) {
        console.error('❌ Raggiunto numero massimo di tentativi di inizializzazione');
        console.log('🔄 Eseguendo reset completo...');
        setTimeout(() => resetWhatsAppSession(), 10000);
        return;
    }

    const puppeteerConfig = getPuppeteerConfig();

    whatsappClient = new Client({
        authStrategy: new LocalAuth({
            dataPath: './whatsapp_session',
        }),
        puppeteer: puppeteerConfig,
        webVersionCache: {
            type: 'remote',
            remotePath:
                'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        },
        restartOnAuthFail: true,
        takeoverOnConflict: true,
        takeoverTimeoutMs: 60000,
    });

    // Timeout per inizializzazione
    const initTimeout = setTimeout(() => {
        console.log('⏰ Timeout inizializzazione WhatsApp (3 minuti)');
        whatsappClient.emit('disconnected', 'Initialization timeout');
    }, 180000); // 3 minuti

    // Event handlers migliorati
    whatsappClient.on('loading_screen', (percent, message) => {
        console.log(`🔄 Caricamento WhatsApp: ${percent}% - ${message}`);
    });

    whatsappClient.on('qr', async (qr) => {
        clearTimeout(initTimeout);
        console.log('📱 QR Code ricevuto!');

        console.log('\n=== QR CODE PER WHATSAPP ===');
        qrcode.generate(qr, { small: true });
        console.log('=== Scansiona con WhatsApp ===\n');

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
            console.log('✅ QR Code generato anche per interfaccia web');
        } catch (err) {
            console.error('❌ Errore nella generazione del QR Code per web:', err);
        }
    });

    whatsappClient.on('authenticated', (session) => {
        clearTimeout(initTimeout);
        console.log('🔐 WhatsApp autenticato');
        qrCodeData = null;
    });

    whatsappClient.on('auth_failure', (msg) => {
        clearTimeout(initTimeout);
        console.error('❌ Fallimento autenticazione:', msg);
        isWhatsAppReady = false;

        // Reset e riprova
        setTimeout(() => resetWhatsAppSession(), 10000);
    });

    whatsappClient.on('ready', async () => {
        clearTimeout(initTimeout);
        console.log('✅ WhatsApp Client è PRONTO!');
        console.log(`🎯 Canale target configurato: ${WHATSAPP_CHANNEL_ID}`);

        isWhatsAppReady = true;
        qrCodeData = null;
        initializationAttempts = 0; // Reset counter on success

        // Avvia health check periodico
        startWhatsAppHealthCheck();

        await logWhatsAppChannels();

        // Test di connettività
        try {
            const state = await whatsappClient.getState();
            console.log(`📡 Stato connessione WhatsApp: ${state}`);
        } catch (error) {
            console.log('⚠️ Errore nel check dello stato:', error.message);
        }
    });

    whatsappClient.on('disconnected', async (reason) => {
        clearTimeout(initTimeout);
        console.log('⚠️ WhatsApp disconnesso:', reason);
        isWhatsAppReady = false;
        qrCodeData = null;

        // Ferma health check
        if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
            healthCheckInterval = null;
        }

        try {
            await whatsappClient.destroy();
        } catch (error) {
            console.log('⚠️ Errore durante pulizia client:', error.message);
        }

        whatsappClient = null;

        // Strategia di reconnessione intelligente
        const reconnectDelay = initializationAttempts * 30000; // Aumenta delay per ogni tentativo
        console.log(`🔄 Riconnessione automatica tra ${reconnectDelay / 1000} secondi...`);

        setTimeout(() => {
            console.log('🔄 Tentativo di riconnessione automatica...');
            initWhatsApp();
        }, reconnectDelay);
    });

    whatsappClient.on('error', (error) => {
        clearTimeout(initTimeout);
        console.error('❌ Errore WhatsApp Client:', error);

        // Gestione errori critici
        if (
            error.message.includes('Navigation failed') ||
            error.message.includes('net::ERR_') ||
            error.message.includes('Protocol error')
        ) {
            console.log('🔄 Errore critico rilevato, reset sessione...');
            setTimeout(() => resetWhatsAppSession(), 5000);
        }
    });

    // Inizializza con timeout di sicurezza
    whatsappClient.initialize().catch((error) => {
        clearTimeout(initTimeout);
        console.error('❌ Errore fatale durante inizializzazione WhatsApp:', error);
        console.error('🔍 Debug info:');
        console.error('   Node version:', process.version);
        console.error('   Platform:', process.platform);
        console.error('   Architecture:', process.arch);
        console.error(
            '   Memory:',
            Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        );
        console.error('   Attempt:', initializationAttempts);

        if (initializationAttempts >= MAX_INIT_ATTEMPTS) {
            console.log('💥 Troppi tentativi falliti, reset completo...');
            setTimeout(() => resetWhatsAppSession(), 30000);
        } else {
            setTimeout(() => {
                console.log('🔄 Restart automatico dopo errore fatale...');
                initWhatsApp();
            }, 60000);
        }
    });
}

// === INIZIALIZZAZIONE TELEGRAM ===

function initTelegram() {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error('❌ TELEGRAM_BOT_TOKEN non configurato');
        return;
    }

    console.log('🤖 Inizializzazione Telegram Bot...');
    const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

    bot.command('status', (ctx) => {
        const status = {
            whatsapp: isWhatsAppReady ? '✅ Connesso' : '❌ Disconnesso',
            canaleTarget: WHATSAPP_CHANNEL_ID,
            tentativi: `${initializationAttempts}/${MAX_INIT_ATTEMPTS}`,
            uptime: Math.floor(process.uptime() / 60) + ' minuti',
            memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            timestamp: new Date().toLocaleString('it-IT'),
        };

        ctx.reply(
            `🤖 Status Sistema:\n\nWhatsApp: ${status.whatsapp}\nCanale Target: ${status.canaleTarget}\nTentativi: ${status.tentativi}\nUptime: ${status.uptime}\nMemoria: ${status.memory}\nAggiornato: ${status.timestamp}`,
        );
    });

    bot.command('reset', async (ctx) => {
        ctx.reply('🔄 Avvio reset sessione WhatsApp...');
        try {
            await resetWhatsAppSession();
            ctx.reply('✅ Reset avviato, il sistema si riavvierà automaticamente');
        } catch (error) {
            ctx.reply(`❌ Errore durante reset: ${error.message}`);
        }
    });

    bot.command('channels', async (ctx) => {
        if (!isWhatsAppReady) {
            return ctx.reply('❌ WhatsApp non connesso');
        }

        try {
            const channels = await whatsappClient.getChannels();
            let response = `📺 Canali WhatsApp disponibili (${channels.length}):\n\n`;

            channels.slice(0, 10).forEach((channel, index) => {
                response += `${index + 1}. ${channel.name || 'N/A'}\n   ID: \`${
                    channel.id._serialized || channel.id
                }\`\n\n`;
            });

            if (channels.length > 10) {
                response += `... e altri ${channels.length - 10} canali`;
            }

            ctx.reply(response, { parse_mode: 'Markdown' });
        } catch (error) {
            ctx.reply(`❌ Errore: ${error.message}`);
        }
    });

    bot.on('channel_post', async (ctx) => {
        if (!isWhatsAppReady) {
            console.log('⚠️ WhatsApp non ancora pronto, messaggio ignorato');
            return;
        }

        const message = ctx.channelPost;
        const channelUsername = message.chat.username;
        const channelId = message.chat.id;

        console.log(
            `📨 Messaggio ricevuto dal canale: @${channelUsername || 'unknown'} (ID: ${channelId})`,
        );

        if (TELEGRAM_CHANNEL_ID && channelId.toString() !== TELEGRAM_CHANNEL_ID) {
            console.log(
                `⚠️ Messaggio da canale non monitorato: ${channelId} (configurato: ${TELEGRAM_CHANNEL_ID})`,
            );
            return;
        }

        try {
            console.log(`🎯 Inoltrando messaggio da @${channelUsername} verso canale WhatsApp...`);
            await forwardToWhatsApp(message);
            console.log('✅ Messaggio inoltrato con successo su WhatsApp');
        } catch (error) {
            console.error("❌ Errore nell'inoltro del messaggio:", error.message);

            if (error.message && error.message.includes('@newsletter')) {
                console.log(
                    "💡 SUGGERIMENTO: L'ID nel messaggio di errore potrebbe essere quello corretto da usare come WHATSAPP_CHANNEL_ID",
                );
            }
        }
    });

    bot.launch({
        dropPendingUpdates: true,
    })
        .then(() => {
            console.log('✅ Telegram Bot avviato');
        })
        .catch((error) => {
            console.error('❌ Errore avvio Telegram bot:', error);
        });

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// === FUNZIONI DI SUPPORTO ===

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

        const toClose = [...currentFormats].filter((f) => !newFormats.has(f));
        for (const format of toClose.reverse()) {
            if (format === 'bold') result += '*';
            else if (format === 'italic') result += '_';
            else if (format === 'strikethrough') result += '~';
            else if (format === 'code') result += '`';
            currentFormats.delete(format);
        }

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

    for (const format of [...currentFormats].reverse()) {
        if (format === 'bold') result += '*';
        else if (format === 'italic') result += '_';
        else if (format === 'strikethrough') result += '~';
        else if (format === 'code') result += '`';
    }

    return result;
}

// === FUNZIONE FORWARD MIGLIORATA CON RETRY ===

async function forwardToWhatsApp(telegramMessage) {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const isHealthy = await isWhatsAppClientHealthy();
            if (!isHealthy) {
                throw new Error('WhatsApp client non sano - richiesta reinizializzazione');
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

            // Gestione media
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

            const channelId = WHATSAPP_CHANNEL_ID;

            const sendPromise = media
                ? whatsappClient.sendMessage(channelId, media, {
                      caption: content || undefined,
                      sendMediaAsDocument: false,
                  })
                : whatsappClient.sendMessage(channelId, content);

            await Promise.race([
                sendPromise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout invio messaggio')), 45000),
                ),
            ]);

            return; // Successo
        } catch (error) {
            attempt++;
            console.log(`❌ Tentativo ${attempt}/${maxRetries} fallito:`, error.message);

            if (
                error.message.includes('Session closed') ||
                error.message.includes('page has been closed') ||
                error.message.includes('Target closed') ||
                error.message.includes('non sano') ||
                error.message.includes('UNPAIRED')
            ) {
                console.log('🔄 Errore di sessione rilevato, reinizializzazione in corso...');
                await resetWhatsAppSession();
                throw new Error(
                    `Sessione WhatsApp chiusa, reinizializzazione avviata. Riprova tra qualche minuto.`,
                );
            }

            if (attempt < maxRetries) {
                const waitTime = attempt * 3000; // Aumentato wait time
                console.log(`⏰ Attesa ${waitTime / 1000}s prima del prossimo tentativo...`);
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            }
        }
    }

    throw new Error(`Fallimento invio dopo ${maxRetries} tentativi`);
}

async function getFileUrl(fileId) {
    const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
    const file = await bot.telegram.getFile(fileId);
    return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;
}

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
            console.log('   💡 Usa il comando /channels del bot per vedere tutti i canali');

            // Mostra primi 5 canali come suggerimento
            if (channels.length > 0) {
                console.log('   🔍 Primi canali disponibili:');
                channels.slice(0, 5).forEach((ch, idx) => {
                    console.log(
                        `   ${idx + 1}. ${ch.name || 'N/A'} - ${ch.id._serialized || ch.id}`,
                    );
                });
            }
        }

        console.log('═══════════════════════════════════════\n');
    } catch (error) {
        console.error('❌ Errore nella verifica del canale:', error);
    }
}

// === MONITORAGGIO MEMORIA E PERFORMANCE ===

function startMemoryMonitoring() {
    setInterval(() => {
        const memUsage = process.memoryUsage();
        const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);

        if (memMB > 800) {
            // Alert se supera 800MB
            console.log(`⚠️ Uso memoria elevato: ${memMB}MB`);

            // Garbage collection manuale se disponibile
            if (global.gc) {
                console.log('🧹 Eseguendo garbage collection...');
                global.gc();
            }
        }
    }, 300000); // Check ogni 5 minuti
}

// === AVVIO SISTEMA ===

console.log('🚀 Avviando il sistema migliorato...');
console.log(`🎯 Canale WhatsApp target: ${WHATSAPP_CHANNEL_ID}`);

const server = app.listen(PORT, () => {
    console.log(`🌐 Server HTTP avviato sulla porta ${PORT}`);
    console.log(`🔗 Interfaccia web: http://localhost:${PORT}`);
    console.log(`🔄 Reset disponibile su: http://localhost:${PORT}/reset`);
});

server.on('error', (err) => {
    console.error('❌ Errore server:', err);
});

server.timeout = 120000; // Timeout di 2 minuti per le richieste

// Graceful shutdown migliorato
const gracefulShutdown = async (signal) => {
    console.log(`🛑 Ricevuto ${signal}, spegnimento graceful...`);

    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        console.log('✅ Health check fermato');
    }

    if (whatsappClient) {
        try {
            await whatsappClient.destroy();
            console.log('✅ Client WhatsApp chiuso');
        } catch (error) {
            console.log('⚠️ Errore chiusura client:', error.message);
        }
    }

    server.close(() => {
        console.log('✅ Server HTTP chiuso');
        process.exit(0);
    });

    // Force exit dopo 10 secondi
    setTimeout(() => {
        console.log('⏰ Force exit dopo timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Avvia monitoraggio memoria
startMemoryMonitoring();

// Inizializza i client con delay
console.log('⏰ Avvio WhatsApp tra 3 secondi...');
setTimeout(() => {
    initWhatsApp();
}, 3000);

console.log('⏰ Avvio Telegram Bot tra 10 secondi...');
setTimeout(() => {
    initTelegram();
}, 10000);

// Gestione errori non catturati migliorata
process.on('unhandledRejection', (error, promise) => {
    console.error('❌ Unhandled rejection at:', promise, 'reason:', error);

    // Se l'errore è critico, riavvia il sistema
    if (
        error.message &&
        (error.message.includes('Protocol error') ||
            error.message.includes('Navigation failed') ||
            error.message.includes('Target closed'))
    ) {
        console.log('🔄 Errore critico rilevato, reset sistema...');
        setTimeout(() => resetWhatsAppSession(), 5000);
    }
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);

    // Log dell'errore e tentativo di graceful shutdown
    console.log('🔄 Tentativo di recupero...');
    setTimeout(() => {
        if (!isWhatsAppReady) {
            console.log('🚀 Sistema non operativo, reset automatico...');
            resetWhatsAppSession();
        }
    }, 10000);
});

// Heartbeat per mantenere il processo attivo
setInterval(() => {
    console.log(
        `💓 Heartbeat - Uptime: ${Math.floor(process.uptime() / 60)}min - Memory: ${Math.round(
            process.memoryUsage().heapUsed / 1024 / 1024,
        )}MB - WhatsApp: ${isWhatsAppReady ? 'OK' : 'DOWN'}`,
    );
}, 600000); // Ogni 10 minuti

console.log('🎉 Sistema inizializzato con successo!');
