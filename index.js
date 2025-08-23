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
const WHATSAPP_GROUP_ID = process.env.WHATSAPP_GROUP_ID;
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
                            Sistema attivo - Monitoraggio @prezzi_wow → WhatsApp
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

// Endpoint per visualizzare i canali WhatsApp
app.get('/channels', async (req, res) => {
    if (!isWhatsAppReady) {
        res.json({
            error: 'WhatsApp non è ancora connesso',
            channels: [],
            groups: [],
        });
        return;
    }

    try {
        const channels = await whatsappClient.getChannels();
        const chats = await whatsappClient.getChats();
        const groups = chats.filter((chat) => chat.isGroup);

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
                        (channel.name || '').toLowerCase().includes('prezzi') ||
                        (channel.name || '').toLowerCase().includes('offerte') ||
                        (channel.name || '').toLowerCase().includes('sconti'),
                };
            }),
        );

        const groupList = groups.slice(0, 10).map((group, index) => ({
            type: 'group',
            index: index + 1,
            name: group.name || 'N/A',
            id: group.id._serialized || group.id,
            unreadCount: group.unreadCount || 0,
            lastActivity: group.timestamp
                ? new Date(group.timestamp * 1000).toLocaleString('it-IT')
                : 'N/A',
            isMuted: group.isMuted,
            lastMessagePreview:
                group.lastMessage?.body?.substring(0, 100) || '[Nessun messaggio o media]',
            isTarget:
                (group.name || '').toLowerCase().includes('prezzi') ||
                (group.name || '').toLowerCase().includes('offerte') ||
                (group.name || '').toLowerCase().includes('sconti'),
        }));

        res.json({
            totalChannels: channelList.length,
            totalGroups: groups.length,
            channels: channelList,
            groups: groupList,
            note:
                groups.length > 10 ? `Showing first 10 groups out of ${groups.length} total` : null,
            targetSuggestions: {
                channels: channelList.filter((c) => c.isTarget),
                groups: groupList.filter((g) => g.isTarget),
            },
        });
    } catch (error) {
        res.json({
            error: error.message,
            channels: [],
            groups: [],
        });
    }
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
        isWhatsAppReady = true;
        qrCodeData = null;

        // Log di tutti i canali WhatsApp disponibili
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
        // Dato che stiamo usando il bot @prezzi_wow_bot che è già nel canale,
        // dovremmo ricevere solo messaggi da quel canale
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
            if (error.message && error.message.includes('@g.us')) {
                console.log(
                    "💡 SUGGERIMENTO: L'ID nel messaggio di errore potrebbe essere quello corretto da usare come WHATSAPP_GROUP_ID",
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
Gruppo WhatsApp: ${WHATSAPP_GROUP_ID || '❌ Non configurato'}

🔧 Per configurare il gruppo WhatsApp:
1. Invia un messaggio di test
2. Controlla i logs per l'ID del gruppo
3. Aggiorna la variabile WHATSAPP_GROUP_ID`;
            ctx.reply(statusMsg);
            return;
        }

        if (ctx.message.text === '/channels') {
            if (!isWhatsAppReady) {
                ctx.reply('⚠️ WhatsApp non ancora connesso. Attendere...');
                return;
            }

            ctx.reply('🔍 Recuperando lista canali WhatsApp... (controlla i logs per dettagli)');
            await logWhatsAppChannels();
            ctx.reply(
                '✅ Lista canali stampata nei logs del server. Visita /channels endpoint per la versione JSON.',
            );
            return;
        }

        // Test di inoltro per messaggi privati
        try {
            await forwardToWhatsApp(ctx.message);
            ctx.reply('✅ Messaggio inoltrato su WhatsApp');
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

// Funzione per inoltrare messaggi a WhatsApp
async function forwardToWhatsApp(telegramMessage) {
    if (!whatsappClient || !isWhatsAppReady) {
        throw new Error('WhatsApp client non pronto');
    }

    let content = '';
    let media = null;

    // Gestione testo
    if (telegramMessage.text) {
        content = `🏷️ *PREZZI WOW*\n\n${telegramMessage.text}`;
    }

    // Gestione caption per media
    if (telegramMessage.caption) {
        content = `🏷️ *PREZZI WOW*\n\n${telegramMessage.caption}`;
    }

    // Gestione foto
    if (telegramMessage.photo) {
        // Prendi la foto con la risoluzione più alta
        const photo = telegramMessage.photo[telegramMessage.photo.length - 1];
        const fileUrl = await getFileUrl(photo.file_id);
        media = await MessageMedia.fromUrl(fileUrl);
    }

    // Gestione video
    if (telegramMessage.video) {
        const fileUrl = await getFileUrl(telegramMessage.video.file_id);
        media = await MessageMedia.fromUrl(fileUrl);
    }

    // Gestione documento
    if (telegramMessage.document) {
        const fileUrl = await getFileUrl(telegramMessage.document.file_id);
        media = await MessageMedia.fromUrl(fileUrl, {
            filename: telegramMessage.document.file_name,
        });
    }

    // Determina la destinazione - cerca il canale specifico se non configurato
    let chatId = WHATSAPP_GROUP_ID;

    // Se non è configurato, cerca il canale nei logs
    if (!chatId) {
        console.log(
            "⚠️ WHATSAPP_GROUP_ID non configurato. Controlla i logs per trovare l'ID del canale target.",
        );
        console.log('🎯 Cerca un canale con nome simile a "prezzi" o "offerte" nei logs');
        // Usa un placeholder - il messaggio fallirà ma mostrerà l'errore con l'ID corretto
        chatId = 'PLACEHOLDER_CHANNEL_ID';
    }

    // Invia il messaggio
    if (media) {
        await whatsappClient.sendMessage(chatId, media, { caption: content });
        console.log('📤 Media inviato su WhatsApp');
    } else if (content) {
        await whatsappClient.sendMessage(chatId, content);
        console.log('📤 Messaggio testuale inviato su WhatsApp');
    }
}

// Funzione per ottenere URL del file da Telegram
async function getFileUrl(fileId) {
    const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
    const file = await bot.telegram.getFile(fileId);
    return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;
}

// Funzione per loggare tutti i canali e gruppi WhatsApp
async function logWhatsAppChannels() {
    try {
        console.log('\n📺 === LOG CANALI E GRUPPI WHATSAPP ===');

        // Ottieni tutti i canali e tutte le chat
        const channels = await whatsappClient.getChannels();
        const chats = await whatsappClient.getChats();

        // Filtra i gruppi dalle chat
        const groups = chats.filter((chat) => chat.isGroup);

        console.log(`🔍 Trovati ${channels.length} canali e ${groups.length} gruppi WhatsApp:`);
        console.log('═══════════════════════════════════════');

        // Log dei canali
        if (channels.length > 0) {
            console.log('\n📺 CANALI WHATSAPP:');
            for (let i = 0; i < channels.length; i++) {
                const channel = channels[i];

                console.log(`\n📺 CANALE ${i + 1}:`);
                console.log(`   Nome: ${channel.name || 'N/A'}`);
                console.log(`   ID: ${channel.id._serialized || channel.id}`);
                console.log(`   Descrizione: ${channel.description || 'Nessuna descrizione'}`);
                console.log(`   Messaggi non letti: ${channel.unreadCount || 0}`);
                console.log(
                    `   Ultimo messaggio: ${
                        channel.timestamp
                            ? new Date(channel.timestamp * 1000).toLocaleString('it-IT')
                            : 'N/A'
                    }`,
                );
                console.log(`   Mutato: ${channel.isMuted ? 'Sì' : 'No'}`);
                console.log(`   Solo lettura: ${channel.isReadOnly ? 'Sì' : 'No'}`);

                // Controllo specifico per canali con nomi relativi a prezzi/offerte
                const channelName = (channel.name || '').toLowerCase();
                if (
                    channelName.includes('prezzi') ||
                    channelName.includes('offerte') ||
                    channelName.includes('sconti')
                ) {
                    console.log(`   🎯 CANALE TARGET POTENZIALE! (contiene parole chiave)`);
                }

                // Tenta di ottenere i subscriber (solo quelli nei contatti)
                try {
                    const subscribers = await channel.getSubscribers(10);
                    console.log(
                        `   Subscribers (primi 10): ${subscribers ? subscribers.length : 'N/A'}`,
                    );
                } catch (error) {
                    console.log(`   Subscribers: Non accessibili`);
                }

                // Mostra ultimo messaggio se disponibile
                if (channel.lastMessage) {
                    const lastMsg = channel.lastMessage;
                    const preview = lastMsg.body
                        ? lastMsg.body.substring(0, 50) + '...'
                        : '[Media o messaggio vuoto]';
                    console.log(`   Ultimo contenuto: "${preview}"`);
                }

                console.log('   ───────────────────────────');
            }
        } else {
            console.log('\n❌ Nessun canale trovato.');
        }

        // Log dei gruppi
        if (groups.length > 0) {
            console.log('\n👥 GRUPPI WHATSAPP:');
            for (let i = 0; i < Math.min(groups.length, 10); i++) {
                // Limita a primi 10 gruppi
                const group = groups[i];

                console.log(`\n👥 GRUPPO ${i + 1}:`);
                console.log(`   Nome: ${group.name || 'N/A'}`);
                console.log(`   ID: ${group.id._serialized || group.id}`);
                console.log(`   Messaggi non letti: ${group.unreadCount || 0}`);
                console.log(
                    `   Ultimo messaggio: ${
                        group.timestamp
                            ? new Date(group.timestamp * 1000).toLocaleString('it-IT')
                            : 'N/A'
                    }`,
                );
                console.log(`   Mutato: ${group.isMuted ? 'Sì' : 'No'}`);

                // Controllo specifico per gruppi con nomi relativi a prezzi/offerte
                const groupName = (group.name || '').toLowerCase();
                if (
                    groupName.includes('prezzi') ||
                    groupName.includes('offerte') ||
                    groupName.includes('sconti')
                ) {
                    console.log(`   🎯 GRUPPO TARGET POTENZIALE! (contiene parole chiave)`);
                }

                console.log('   ───────────────────────────');
            }

            if (groups.length > 10) {
                console.log(`\n... e altri ${groups.length - 10} gruppi`);
            }
        } else {
            console.log('\n❌ Nessun gruppo trovato.');
        }

        console.log('\n🎯 CONFIGURAZIONE PER PREZZI WOW:');
        console.log('Per il canale: https://whatsapp.com/channel/0029VbB3yxmCRs1wf42e1Q2J');
        console.log('1. Trova il canale/gruppo corretto nella lista sopra');
        console.log("2. Copia l'ID completo (es: 120363...@g.us)");
        console.log('3. Aggiungi come: WHATSAPP_GROUP_ID=120363...@g.us');
        console.log('4. IMPORTANTE: Per i canali devi essere PROPRIETARIO per inviare messaggi!');
        console.log('\n💡 ALTERNATIVE:');
        console.log('- Usa un GRUPPO WhatsApp invece di un canale (più flessibile)');
        console.log('- Crea un nuovo gruppo "Prezzi WOW" se non trovi quello giusto');
        console.log('- Usa la tua chat personale: numero@c.us (es: 393123456789@c.us)');
        console.log('═══════════════════════════════════════\n');
    } catch (error) {
        console.error('❌ Errore nel recupero dei canali e gruppi WhatsApp:', error);
    }
}

// Avvia il sistema
console.log('🚀 Avviando il sistema...');

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
