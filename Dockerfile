FROM ghcr.io/puppeteer/puppeteer:24.17.0

WORKDIR /usr/src/app

COPY --chown=pptruser:pptruser package*.json ./

RUN npm ci --only=production && npm cache clean --force

COPY --chown=pptruser:pptruser . .

# Crea la directory per la sessione di WhatsApp
RUN mkdir -p whatsapp_session && chown pptruser:pptruser whatsapp_session

# Rileva automaticamente il binario del browser (chromium o chrome)
RUN BROWSER_PATH=$(which chromium || which google-chrome || which google-chrome-stable) \
    && echo "export PUPPETEER_EXECUTABLE_PATH=$BROWSER_PATH" >> /etc/profile.d/puppeteer.sh

# Espone la porta
EXPOSE 3000

USER pptruser

# Carica la variabile al runtime
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PATH=$PATH:/usr/src/app

CMD ["/bin/bash", "-lc", "npm start"]
