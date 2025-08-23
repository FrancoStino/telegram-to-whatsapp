const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { Telegraf } = require('telegraf');
const express = require('express');
const QRCode = require('qrcode');

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
        console.log('📬 Nuovo messaggio dal canale Telegram:', ctx);
        console.log('📬Caption Entititeis:', ctx.channelPost.caption_entities);
        console.log('📬Reply Markup:', ctx.channelPost.reply_markup);

        const channelUsername = message.chat.username;

        console.log(`📨 Messaggio ricevuto dal canale: @${channelUsername || 'unknown'}`);

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

    bot.launch();
    console.log('🤖 Telegram Bot avviato');

    // Graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// Funzione avanzata per gestire entità sovrapposte e spoiler
function convertTelegramFormatting(text, entities) {
    if (!entities || entities.length === 0) {
        return text;
    }

    console.log('📝 Entità ricevute:', JSON.stringify(entities, null, 2));

    // Crea una mappa di posizioni con le formattazioni
    const formatMap = new Map();

    // Prima passa: identifica tutte le posizioni e i tipi di formattazione
    for (const entity of entities) {
        const start = entity.offset;
        const end = entity.offset + entity.length;

        for (let i = start; i < end; i++) {
            if (!formatMap.has(i)) {
                formatMap.set(i, new Set());
            }

            // Gestisci i tipi supportati
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
                // case 'underline':
                //     // Converti underline in italic per WhatsApp
                //     formatMap.get(i).add('italic');
                //     break;
                case 'spoiler':
                    // Mantieni spoiler come testo normale per ora
                    formatMap.get(i).add('spoiler');
                    break;
            }
        }
    }

    // Seconda passa: applica la formattazione
    let result = '';
    let currentFormats = new Set();
    let openTags = [];

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

            openTags = openTags.filter((tag) => tag !== format);
            currentFormats.delete(format);
        }

        // Apri i nuovi tag
        const toOpen = [...newFormats].filter((f) => !currentFormats.has(f) && f !== 'spoiler');
        for (const format of toOpen) {
            if (format === 'bold') result += '*';
            else if (format === 'italic') result += '_';
            else if (format === 'strikethrough') result += '~';
            else if (format === 'code') result += '`';

            openTags.push(format);
            currentFormats.add(format);
        }

        result += char;
    }

    // Chiudi tutti i tag rimasti aperti
    for (const format of openTags.reverse()) {
        if (format === 'bold') result += '*';
        else if (format === 'italic') result += '_';
        else if (format === 'strikethrough') result += '~';
        else if (format === 'code') result += '`';
    }

    console.log('📝 Testo formattato:', result);
    return result;
}

// Funzione per debug delle entità
function debugTelegramMessage(telegramMessage) {
    console.log('📬 Caption:', telegramMessage.caption);
    console.log('📬 Caption Entities:', JSON.stringify(telegramMessage.caption_entities, null, 2));

    if (telegramMessage.caption_entities) {
        console.log('📬 Analisi entità:');
        telegramMessage.caption_entities.forEach((entity, index) => {
            const text = telegramMessage.caption.substring(
                entity.offset,
                entity.offset + entity.length,
            );
            console.log(
                `  ${index + 1}. "${text}" → ${entity.type} (${entity.offset}-${
                    entity.offset + entity.length
                })`,
            );
        });
    }
}

// Modifica la funzione forwardToWhatsApp per utilizzare la formattazione
async function forwardToWhatsApp(telegramMessage) {
    if (!whatsappClient || !isWhatsAppReady) {
        throw new Error('WhatsApp client non pronto');
    }

    let content = '';
    let media = null;

    // Debug del messaggio ricevuto
    if (telegramMessage.caption || telegramMessage.text) {
        debugTelegramMessage(telegramMessage);
    }

    // Gestione testo con formattazione
    if (telegramMessage.text) {
        content = convertTelegramFormatting(telegramMessage.text, telegramMessage.entities);
    }

    // Gestione caption per media con formattazione
    if (telegramMessage.caption) {
        content = convertTelegramFormatting(
            telegramMessage.caption,
            telegramMessage.caption_entities,
        );
    }

    // Gestione foto - Debug per le immagini
    if (telegramMessage.photo) {
        console.log('📸 Immagine rilevata:', telegramMessage.photo);
        try {
            const photo = telegramMessage.photo[telegramMessage.photo.length - 1];
            console.log('📸 Foto selezionata:', photo);
            const fileUrl = await getFileUrl(photo.file_id);
            console.log('📸 URL file:', fileUrl);

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

    // Debug: mostra il testo formattato
    if (content) {
        console.log('📝 Testo con formattazione:', content);
    }

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
