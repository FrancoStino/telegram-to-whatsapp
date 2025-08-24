# Dockerfile ottimizzato per Northflank
FROM node:20-slim

# Installa dipendenze Chrome
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Crea directory di lavoro
WORKDIR /usr/src/app

# Imposta variabili d'ambiente per Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Copia package files
COPY package*.json ./

# Installa dipendenze Node.js
RUN npm ci --only=production && npm cache clean --force

# Copia codice applicazione
COPY . .

# Crea directory sessioni WhatsApp
RUN mkdir -p whatsapp_session

# Espone la porta (Northflank usa spesso 8080)
EXPOSE 8080

# Avvia applicazione
CMD ["npm", "start"]