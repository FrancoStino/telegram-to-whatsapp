# Usa un'immagine che già include Chrome e le dipendenze necessarie
FROM ghcr.io/puppeteer/puppeteer:24.17.0

# Cambia alla directory di lavoro
WORKDIR /usr/src/app

# Copia i file package
COPY --chown=pptruser:pptruser package*.json ./

# Installa solo le dipendenze di produzione
RUN npm ci --only=production && npm cache clean --force

# Copia il resto del codice
COPY --chown=pptruser:pptruser . .

# Crea la directory per WhatsApp session
RUN mkdir -p whatsapp_session && chown pptruser:pptruser whatsapp_session

# Imposta le variabili d'ambiente
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Espone la porta
EXPOSE 3000

# Avvia come utente non-root
USER pptruser

CMD ["npm", "start"]