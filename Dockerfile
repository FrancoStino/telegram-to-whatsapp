# Usa l'immagine Puppeteer ufficiale che ha già tutto configurato
FROM ghcr.io/puppeteer/puppeteer:21.3.6

# Passa alla directory di lavoro
WORKDIR /usr/src/app

# Copia package.json come utente root per evitare errori
USER root
COPY package*.json ./
RUN chown pptruser:pptruser package*.json

# Torna all'utente pptruser per installare dipendenze
USER pptruser

# Installa le dipendenze Node.js
RUN npm ci --only=production && npm cache clean --force

# Copia il resto del codice (come root per evitare problemi)
USER root
COPY . .
RUN chown -R pptruser:pptruser /usr/src/app
RUN mkdir -p whatsapp_session && chown pptruser:pptruser whatsapp_session

# Torna all'utente non-root per l'esecuzione
USER pptruser

# Espone la porta
EXPOSE 8080

# Avvia l'applicazione
CMD ["npm", "start"]