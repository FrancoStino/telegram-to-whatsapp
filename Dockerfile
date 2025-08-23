FROM node:18-alpine

# Installa le dipendenze necessarie per Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Imposta la variabile per usare il Chromium installato
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Crea la directory dell'app
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa le dipendenze
RUN npm ci --only=production

# Copia il resto del codice
COPY . .

# Crea la directory per la sessione WhatsApp
RUN mkdir -p whatsapp_session

# Esponi la porta
EXPOSE 3000

# Comando di avvio
CMD ["npm", "start"]