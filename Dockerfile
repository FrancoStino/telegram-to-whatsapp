FROM node:current-alpine3.22

# Installa Chrome e dipendenze in un solo layer
RUN apt-get update && apt-get install -y \
    wget \
    gnupg2 \
    ca-certificates \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia e installa dipendenze
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copia codice
COPY . .
RUN mkdir -p whatsapp_session

# Setup utente
RUN groupadd -r nodeuser && useradd -r -g nodeuser nodeuser
RUN chown -R nodeuser:nodeuser /app
USER nodeuser

EXPOSE 8080
CMD ["npm", "start"]