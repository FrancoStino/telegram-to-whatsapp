// server.js
const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const app = express();
app.use(express.json());

// Avvia il client WhatsApp con sessione salvata
const client = new Client({
  authStrategy: new LocalAuth(), // salva la sessione
});

client.on("qr", (qr) => {
  console.log("QR Code ricevuto, scansiona con WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Bot WhatsApp pronto!");
});

// Endpoint REST per inviare messaggi
app.post("/send-message", async (req, res) => {
  const { number, message } = req.body;

  try {
    await client.sendMessage(`${number}@c.us`, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Avvia server Express
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server attivo su porta ${PORT}`);
});

client.initialize();
