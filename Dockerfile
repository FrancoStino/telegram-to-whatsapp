# Usa un'immagine Node.js con supporto per Puppeteer
FROM ghcr.io/puppeteer/puppeteer:22.0.0

# Imposta la directory di lavoro
WORKDIR /usr/src/app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa le dipendenze
RUN npm ci --only=production

# Copia il codice dell'applicazione
COPY . .

# Crea la directory per le sessioni WhatsApp
RUN mkdir -p whatsapp_session && chown -R pptruser:pptruser whatsapp_session

# Cambia utente per motivi di sicurezza
USER pptruser

# Espone la porta
EXPOSE 3000

# Avvia l'applicazione
CMD ["npm", "start"]