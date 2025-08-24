# === DOCKERFILE OTTIMIZZATO PER NORTHFLANK + PUPPETEER ===
# Basato sulla documentazione ufficiale Puppeteer e best practices Docker

# Usa l'immagine ufficiale Puppeteer che include Chrome for Testing
FROM ghcr.io/puppeteer/puppeteer:22.6.0

# Imposta variabili d'ambiente per ottimizzare Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_ENV=production

# Crea directory di lavoro
WORKDIR /usr/src/app

# Passa a root per installazioni di sistema
USER root

# Aggiorna il sistema e installa dipendenze aggiuntive se necessarie
RUN apt-get update && apt-get install -y \
    # Dipendenze per font e rendering
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    # Utilità di sistema
    curl \
    wget \
    # Pulisci cache
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copia i file di configurazione delle dipendenze
COPY package*.json ./

# Installa le dipendenze Node.js come root per evitare problemi di permessi
RUN npm ci --only=production && npm cache clean --force

# Copia tutto il codice dell'applicazione
COPY . .

# Crea la directory per le sessioni WhatsApp
RUN mkdir -p whatsapp_session

# Imposta i permessi corretti per l'utente pptruser
RUN chown -R pptruser:pptruser /usr/src/app

# Torna all'utente pptruser per l'esecuzione (sicurezza)
USER pptruser

# Espone la porta (NorthFlank usa di solito 8080)
EXPOSE 8080

# Comando di avvio
CMD ["npm", "start"]