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
        console.log('🔄 Tentativo di riconnessione in corso...');
        isWhatsAppReady = false;

        // Tentativo di riconnessione dopo 10 secondi
        setTimeout(() => {
            if (!isWhatsAppReady) {
                console.log('🔄 Riinizializzo WhatsApp Client...');
                whatsappClient.initialize();
            }
        }, 10000);
    });

    whatsappClient.initialize();
}

// Inizializza Telegram Bot con configurazione più aggressiva
function initTelegram() {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error('❌ TELEGRAM_BOT_TOKEN non configurato');
        return;
    }

    const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

    // CATTURA QUALSIASI TIPO DI AGGIORNAMENTO - FOCUS SU WP TELEGRAM PRO
    bot.use(async (ctx, next) => {
        console.log('🔍 === AGGIORNAMENTO RICEVUTO ===');
        console.log('Timestamp:', new Date().toISOString());
        console.log('Update type:', ctx.updateType);

        // Log specifico per WP Telegram Pro
        if (ctx.update.message) {
            console.log('📱 MESSAGE detected (possibile WP Telegram Pro)');
            console.log('Chat type:', ctx.update.message.chat.type);
            console.log('Chat ID:', ctx.update.message.chat.id);
            console.log('From bot:', ctx.update.message.from?.is_bot);
            console.log('From username:', ctx.update.message.from?.username);
        }

        if (ctx.update.channel_post) {
            console.log('📺 CHANNEL_POST detected');
        }

        // Log completo solo se necessario per debug
        if (process.env.DEBUG_FULL) {
            console.log('Raw update:', JSON.stringify(ctx.update, null, 2));
        }

        console.log('=====================================');
        return next();
    });

    // Gestione channel_post (messaggi normali del canale)
    bot.on('channel_post', async (ctx) => {
        console.log('📨 CHANNEL_POST ricevuto');
        await handleChannelMessage(ctx, ctx.channelPost, 'channel_post');
    });

    // Gestione edited_channel_post (messaggi modificati)
    bot.on('edited_channel_post', async (ctx) => {
        console.log('📝 EDITED_CHANNEL_POST ricevuto');
        await handleChannelMessage(ctx, ctx.editedChannelPost, 'edited_channel_post');
    });

    // *** NUOVO *** Gestione messaggi da WP Telegram Pro
    bot.on('message', async (ctx) => {
        const message = ctx.message;
        const chatType = message.chat.type;
        const chatId = message.chat.id.toString();
        const isBot = message.from?.is_bot;
        const fromUsername = message.from?.username;

        console.log('💬 MESSAGE ricevuto');
        console.log(`   Chat type: ${chatType}`);
        console.log(`   Chat ID: ${chatId}`);
        console.log(`   From bot: ${isBot}`);
        console.log(`   From username: ${fromUsername}`);

        // WP Telegram Pro spesso invia come 'supergroup' o 'channel' ma tramite 'message'
        if (chatType === 'channel' || chatType === 'supergroup') {
            console.log(
                '🎯 Possibile messaggio da WP Telegram Pro (channel/supergroup via message)',
            );

            // Verifica se è dal canale giusto
            const shouldProcess =
                !TELEGRAM_CHANNEL_ID ||
                chatId === TELEGRAM_CHANNEL_ID ||
                message.chat.username === 'prezzi_wow';

            if (shouldProcess) {
                console.log('✅ Processando messaggio come channel_post da WP Telegram Pro');
                await handleChannelMessage(ctx, message, 'wp_telegram_message');
            } else {
                console.log('❌ Messaggio ignorato - canale non corrispondente');
            }
        } else if (chatType === 'private') {
            // Messaggio privato per testing
            await handlePrivateMessage(ctx);
        } else {
            console.log(`📝 Messaggio di tipo ${chatType} ignorato`);
        }
    });

    // Funzione per messaggi privati (testing)
    async function handlePrivateMessage(ctx) {
        if (!isWhatsAppReady) {
            ctx.reply('⚠️ WhatsApp non ancora connesso');
            return;
        }

        if (ctx.message.text === '/status') {
            const statusMsg = `📊 Status Sistema:
WhatsApp: ${isWhatsAppReady ? '✅ Connesso' : '❌ Disconnesso'}
Canale monitorato: ${TELEGRAM_CHANNEL_ID || 'Auto-detect'}
Canale WhatsApp: ${WHATSAPP_CHANNEL_ID}

🔧 Modalità: Compatibile WP Telegram Pro`;
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
    }

    // Funzione per gestire i messaggi del canale
    async function handleChannelMessage(ctx, message, updateType) {
        console.log(`🔄 === ${updateType.toUpperCase()} DAL CANALE ===`);
        console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

        if (!message) {
            console.log('❌ Messaggio undefined/null');
            console.log('=====================================');
            return;
        }

        if (!isWhatsAppReady) {
            console.log('⚠️ WhatsApp non ancora pronto, messaggio ignorato');
            console.log('=====================================');
            return;
        }

        const channelId = message.chat?.id?.toString();
        const channelUsername = message.chat?.username;
        const messageId = message.message_id;

        console.log(`📨 Dettagli messaggio:`);
        console.log(`   - Canale: @${channelUsername || 'unknown'} (ID: ${channelId})`);
        console.log(`   - Message ID: ${messageId}`);
        console.log(
            `   - Da: ${
                message.from
                    ? message.from.first_name || message.from.username || message.from.is_bot
                        ? 'Bot'
                        : 'User'
                    : 'Sistema'
            }`,
        );
        console.log(`   - Tipo: ${getMessageType(message)}`);
        console.log(`   - Update Type: ${updateType}`);

        // Log extra per WP Telegram Pro
        if (updateType === 'wp_telegram_message') {
            console.log(`   🚀 RILEVATO: Messaggio da WP Telegram Pro!`);
            console.log(`   - Chat Type: ${message.chat?.type}`);
            console.log(`   - Is Bot: ${message.from?.is_bot}`);
        }

        // Verifica canale autorizzato - ACCETTA TUTTO SE NON SPECIFICATO
        if (TELEGRAM_CHANNEL_ID && channelId && channelId !== TELEGRAM_CHANNEL_ID) {
            console.log(`⚠️ Messaggio ignorato - canale non autorizzato`);
            console.log(`   - Atteso: ${TELEGRAM_CHANNEL_ID}`);
            console.log(`   - Ricevuto: ${channelId}`);
            console.log('=====================================');
            return;
        }

        // Se non è configurato un canale specifico E abbiamo username, verifica @prezzi_wow
        if (!TELEGRAM_CHANNEL_ID && channelUsername && channelUsername !== 'prezzi_wow') {
            console.log(`⚠️ Messaggio ignorato - non proviene da @prezzi_wow`);
            console.log(`   - Username: @${channelUsername}`);
            console.log('=====================================');
            return;
        }

        // Se non abbiamo né TELEGRAM_CHANNEL_ID né username, accetta tutto (modalità debug)
        if (!TELEGRAM_CHANNEL_ID && !channelUsername) {
            console.log(`⚠️ MODALITA DEBUG - Accetto messaggio senza verifica canale`);
        }

        // Log dell'ID del canale per configurazione futura
        if (!TELEGRAM_CHANNEL_ID && channelId) {
            console.log(`💡 ID del canale: ${channelId}`);
            console.log('   Puoi aggiungerlo come TELEGRAM_CHANNEL_ID per maggiore sicurezza');
        }

        try {
            console.log(`🎯 INOLTRO IN CORSO...`);
            console.log(`   - Testo: ${message.text ? 'SI' : 'NO'}`);
            console.log(`   - Caption: ${message.caption ? 'SI' : 'NO'}`);
            console.log(`   - Foto: ${message.photo ? 'SI' : 'NO'}`);
            console.log(`   - Video: ${message.video ? 'SI' : 'NO'}`);
            console.log(`   - Documento: ${message.document ? 'SI' : 'NO'}`);

            await forwardToWhatsApp(message);
            console.log('✅ MESSAGGIO INOLTRATO CON SUCCESSO');
        } catch (error) {
            console.error("❌ ERRORE NELL'INOLTRO:", error.message);
            console.error('Stack trace:', error.stack);

            if (error.message && error.message.includes('@newsletter')) {
                console.log("💡 Verifica l'ID del canale WhatsApp nelle variabili d'ambiente");
            }
        }

        console.log('=====================================');
    }

    // Funzione per determinare il tipo di messaggio
    function getMessageType(message) {
        if (message.photo) return 'Foto';
        if (message.video) return 'Video';
        if (message.document) return 'Documento';
        if (message.text) return 'Testo';
        if (message.caption) return 'Media con caption';
        if (message.sticker) return 'Sticker';
        if (message.animation) return 'GIF';
        if (message.voice) return 'Messaggio vocale';
        if (message.audio) return 'Audio';
        if (message.location) return 'Posizione';
        if (message.contact) return 'Contatto';
        if (message.poll) return 'Sondaggio';
        return 'Altro';
    }

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

    bot.launch({
        allowedUpdates: [], // ACCETTA TUTTI gli aggiornamenti possibili
    });
    console.log('🤖 Telegram Bot avviato in MODALITA COMPLETA');
    console.log('🔄 Bot configurato per ricevere TUTTI i tipi di aggiornamento');
    console.log('🎯 Monitorando qualsiasi attività sul canale...');

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
