const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { Telegraf } = require('telegraf');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

// Configurazione
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const WHATSAPP_CHANNEL_ID = process.env.WHATSAPP_CHANNEL_ID || '120363402931610117@newsletter';
const PORT = process.env.PORT || 3000;

// Express server per mantenere attivo il servizio su Render
const app = express();
let qrCodeData = null;
let isWhatsAppReady = false;
let whatsappClient = null;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Endpoint per visualizzare il QR code
app.get('/', (req, res) => {
    if (isWhatsAppReady) {
        res.send(`
            <html>
                <head>
                    <title>Sistema Prezzi WOW</title>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                        .container { max-width: 800px; margin: 0 auto; }
                        .status { color: green; font-weight: bold; }
                        .button { 
                            background: #25D366; color: white; padding: 10px 20px; 
                            text-decoration: none; border-radius: 5px; margin: 10px;
                            display: inline-block;
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
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .container { max-width: 400px; margin: 0 auto; }
                        .qr-code { max-width: 300px; margin: 20px 0; }
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
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    </style>
                </head>
                <body>
                    <h1>🔄 Inizializzazione Sistema</h1>
                    <p>Il sistema si sta avviando, attendere...</p>
                    <script>
                        setTimeout(() => location.reload(), 5000);
                    </script>
                </body>
            </html>
        `);
    }
});

// Endpoint per visualizzare solo i canali WhatsApp
app.get('/channels', async (req, res) => {
    if (!isWhatsAppReady) {
        res.json({
            error: 'WhatsApp non è ancora connesso',
            channels: [],
        });
        return;
    }

    try {
        const channels = await whatsappClient.getChannels();

        const channelList = await Promise.all(
            channels.map(async (channel, index) => {
                let subscribers = null;
                try {
                    const subs = await channel.getSubscribers(5);
                    subscribers = subs ? subs.length : null;
                } catch (error) {
                    subscribers = 'Non accessibile';
                }

                return {
                    type: 'channel',
                    index: index + 1,
                    name: channel.name || 'N/A',
                    id: channel.id._serialized || channel.id,
                    description: channel.description || 'Nessuna descrizione',
                    unreadCount: channel.unreadCount || 0,
                    lastActivity: channel.timestamp
                        ? new Date(channel.timestamp * 1000).toLocaleString('it-IT')
                        : 'N/A',
                    isMuted: channel.isMuted,
                    isReadOnly: channel.isReadOnly,
                    subscribers: subscribers,
                    lastMessagePreview:
                        channel.lastMessage?.body?.substring(0, 100) ||
                        '[Nessun messaggio o media]',
                    isTarget:
                        (channel.id._serialized || channel.id) === WHATSAPP_CHANNEL_ID ||
                        (channel.name || '').toLowerCase().includes('prezzi') ||
                        (channel.name || '').toLowerCase().includes('offerte') ||
                        (channel.name || '').toLowerCase().includes('sconti'),
                };
            }),
        );

        res.json({
            totalChannels: channelList.length,
            targetChannelId: WHATSAPP_CHANNEL_ID,
            channels: channelList,
            targetChannel: channelList.find((c) => c.isTarget),
        });
    } catch (error) {
        res.json({
            error: error.message,
            channels: [],
        });
    }
});

// Endpoint status aggiornato
app.get('/status', (req, res) => {
    res.json({
        whatsappReady: isWhatsAppReady,
        telegramBotConfigured: !!TELEGRAM_BOT_TOKEN,
        whatsappChannelId: WHATSAPP_CHANNEL_ID,
        telegramChannelId: TELEGRAM_CHANNEL_ID || 'Auto-detect',
        timestamp: new Date().toISOString(),
    });
});

// Inizializza WhatsApp Client
function initWhatsApp() {
    whatsappClient = new Client({
        authStrategy: new LocalAuth({
            dataPath: './whatsapp_session',
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
            ],
        },
    });

    whatsappClient.on('qr', async (qr) => {
        console.log('📱 QR Code ricevuto, generando immagine...');
        try {
            qrCodeData = await QRCode.toDataURL(qr);
            console.log('✅ QR Code generato, visitare il sito per scansionarlo');
        } catch (err) {
            console.error('❌ Errore nella generazione del QR Code:', err);
        }
    });

    whatsappClient.on('ready', async () => {
        console.log('✅ WhatsApp Client è pronto!');
        console.log(`🎯 Canale target configurato: ${WHATSAPP_CHANNEL_ID}`);
        isWhatsAppReady = true;
        qrCodeData = null;

        // Verifica rapida del canale target
        await logWhatsAppChannels();
    });

    whatsappClient.on('authenticated', () => {
        console.log('🔐 WhatsApp autenticato');
    });

    whatsappClient.on('auth_failure', (msg) => {
        console.error('❌ Fallimento autenticazione:', msg);
        isWhatsAppReady = false;
    });

    whatsappClient.on('disconnected', (reason) => {
        console.log('⚠️ WhatsApp disconnesso:', reason);
        isWhatsAppReady = false;
    });

    whatsappClient.initialize();
}

// Inizializza Telegram Bot
function initTelegram() {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error('❌ TELEGRAM_BOT_TOKEN non configurato');
        return;
    }

    const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

    // Gestione messaggi dal canale Telegram
    bot.on('channel_post', async (ctx) => {
        if (!isWhatsAppReady) {
            console.log('⚠️ WhatsApp non ancora pronto, messaggio ignorato');
            return;
        }

        const message = ctx.channelPost;
        const channelId = message.chat.id.toString();
        const channelUsername = message.chat.username;

        console.log(
            `📨 Messaggio ricevuto dal canale: @${channelUsername || 'unknown'} (ID: ${channelId})`,
        );

        // Verifica se il messaggio proviene dal canale @prezzi_wow
        if (
            channelUsername !== 'prezzi_wow' &&
            TELEGRAM_CHANNEL_ID &&
            channelId !== TELEGRAM_CHANNEL_ID
        ) {
            console.log(`⚠️ Messaggio ignorato - non proviene da @prezzi_wow`);
            return;
        }

        // Log dell'ID del canale per configurazione futura se necessario
        if (!TELEGRAM_CHANNEL_ID) {
            console.log(
                `💡 ID del canale @prezzi_wow: ${channelId} - Puoi aggiungerlo come TELEGRAM_CHANNEL_ID se vuoi essere più specifico`,
            );
        }

        try {
            console.log(`🎯 Inoltrando messaggio da @${channelUsername} verso canale WhatsApp...`);
            await forwardToWhatsApp(message);
            console.log('✅ Messaggio inoltrato con successo su WhatsApp');
        } catch (error) {
            console.error("❌ Errore nell'inoltro del messaggio:", error);

            // Se l'errore contiene un ID, probabilmente è quello del canale giusto
            if (error.message && error.message.includes('@newsletter')) {
                console.log(
                    "💡 SUGGERIMENTO: L'ID nel messaggio di errore potrebbe essere quello corretto da usare come WHATSAPP_CHANNEL_ID",
                );
            }
        }
    });

    // Gestione messaggi privati (per testing)
    bot.on('text', async (ctx) => {
        if (!isWhatsAppReady) {
            ctx.reply('⚠️ WhatsApp non ancora connesso');
            return;
        }

        if (ctx.message.text === '/status') {
            const statusMsg = `📊 Status Sistema Prezzi WOW:
WhatsApp: ${isWhatsAppReady ? '✅ Connesso' : '❌ Disconnesso'}
Canale monitorato: @prezzi_wow ${
                TELEGRAM_CHANNEL_ID ? `(ID: ${TELEGRAM_CHANNEL_ID})` : '(Auto-detect)'
            }
Canale WhatsApp: ${WHATSAPP_CHANNEL_ID}

🔧 Per testare il sistema:
1. Invia un messaggio di test
2. Controlla i logs per conferma invio`;
            ctx.reply(statusMsg);
            return;
        }

        if (ctx.message.text === '/channels') {
            if (!isWhatsAppReady) {
                ctx.reply('⚠️ WhatsApp non ancora connesso. Attendere...');
                return;
            }

            ctx.reply('🔍 Recuperando lista canali WhatsApp...');
            await logWhatsAppChannels();
            ctx.reply("✅ Lista canali disponibile all'endpoint /channels");
            return;
        }

        // Test di inoltro per messaggi privati
        try {
            await forwardToWhatsApp(ctx.message);
            ctx.reply('✅ Messaggio inoltrato sul canale WhatsApp');
        } catch (error) {
            ctx.reply("❌ Errore nell'inoltro: " + error.message);
        }
    });

    bot.launch();
    console.log('🤖 Telegram Bot avviato');

    // Graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// Funzione per inoltrare messaggi al canale WhatsApp
async function forwardToWhatsApp(telegramMessage) {
    if (!whatsappClient || !isWhatsAppReady) {
        throw new Error('WhatsApp client non pronto');
    }

    let content = '';
    let media = null;

    // Gestione testo
    if (telegramMessage.text) {
        content = telegramMessage.text;
    }

    // Gestione caption per media
    if (telegramMessage.caption) {
        content = telegramMessage.caption;
    }

    // Gestione foto - Debug per le immagini
    if (telegramMessage.photo) {
        console.log('📸 Immagine rilevata:', telegramMessage.photo);
        try {
            // Prendi la foto con la risoluzione più alta
            const photo = telegramMessage.photo[telegramMessage.photo.length - 1];
            console.log('📸 Foto selezionata:', photo);
            const fileUrl = await getFileUrl(photo.file_id);
            console.log('📸 URL file:', fileUrl);

            // Prova diversi metodi per caricare l'immagine
            console.log('📸 Tentativo di creazione MessageMedia...');
            media = await MessageMedia.fromUrl(fileUrl, {
                unsafeMime: true,
                filename: `image_${Date.now()}.jpg`,
            });
            console.log('📸 MessageMedia creato:', media ? 'SUCCESS' : 'FAILED');
        } catch (error) {
            console.error("❌ Errore nel processare l'immagine:", error);
            throw error;
        }
    }

    // Gestione video - Debug
    if (telegramMessage.video) {
        console.log('🎥 Video rilevato:', telegramMessage.video);
        try {
            const fileUrl = await getFileUrl(telegramMessage.video.file_id);
            console.log('🎥 URL file:', fileUrl);
            media = await MessageMedia.fromUrl(fileUrl, {
                unsafeMime: true,
                filename: telegramMessage.video.file_name || `video_${Date.now()}.mp4`,
            });
            console.log('🎥 MessageMedia creato:', media ? 'SUCCESS' : 'FAILED');
        } catch (error) {
            console.error('❌ Errore nel processare il video:', error);
            throw error;
        }
    }

    // Gestione documento - Debug
    if (telegramMessage.document) {
        console.log('📄 Documento rilevato:', telegramMessage.document);
        try {
            const fileUrl = await getFileUrl(telegramMessage.document.file_id);
            console.log('📄 URL file:', fileUrl);
            media = await MessageMedia.fromUrl(fileUrl, {
                filename: telegramMessage.document.file_name,
                unsafeMime: true,
            });
            console.log('📄 MessageMedia creato:', media ? 'SUCCESS' : 'FAILED');
        } catch (error) {
            console.error('❌ Errore nel processare il documento:', error);
            throw error;
        }
    }

    // Invia al canale WhatsApp configurato
    const channelId = WHATSAPP_CHANNEL_ID;
    console.log(`📤 Invio a canale: ${channelId}`);

    try {
        // Invia il messaggio
        if (media) {
            console.log('📤 Invio media con caption...');
            await whatsappClient.sendMessage(channelId, media, {
                caption: content || undefined,
                sendMediaAsDocument: false,
            });
            console.log('✅ Media inviato sul canale WhatsApp');
        } else if (content) {
            console.log('📤 Invio messaggio testuale...');
            await whatsappClient.sendMessage(channelId, content);
            console.log('✅ Messaggio testuale inviato sul canale WhatsApp');
        } else {
            console.log('⚠️ Nessun contenuto da inviare');
        }
    } catch (error) {
        console.error("❌ Errore specifico nell'invio:", error);
        throw error;
    }
}

// Funzione per ottenere URL del file da Telegram - con debug
async function getFileUrl(fileId) {
    try {
        console.log('🔗 Ottenendo URL per file ID:', fileId);
        const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
        const file = await bot.telegram.getFile(fileId);
        const url = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        console.log('🔗 URL generato:', url);
        return url;
    } catch (error) {
        console.error("❌ Errore nell'ottenere URL del file:", error);
        throw error;
    }
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
app.listen(PORT, () => {
    console.log(`🌐 Server HTTP avviato sulla porta ${PORT}`);
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
