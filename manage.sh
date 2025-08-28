#!/bin/bash

# =============================================================================
# SCRIPT DI GESTIONE TELEGRAM TO WHATSAPP FORWARDER
# =============================================================================

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/home/ubuntu/telegram-to-whatsapp"
SERVICE_NAME="telegram-whatsapp"
LOG_DIR="$PROJECT_DIR/logs"

# Funzione per stampare con colori
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# INSTALLAZIONE PM2 (opzione 1)
# =============================================================================

install_pm2() {
    print_status "Installazione PM2..."

    # Installa PM2 globalmente
    npm install -g pm2

    # Crea directory log se non esiste
    mkdir -p "$LOG_DIR"

    print_success "PM2 installato con successo"
}

start_pm2() {
    print_status "Avvio con PM2..."

    cd "$PROJECT_DIR"

    # Ferma processo esistente se presente
    pm2 stop telegram-whatsapp-forwarder 2>/dev/null || true
    pm2 delete telegram-whatsapp-forwarder 2>/dev/null || true

    # Avvia con ecosystem config
    pm2 start ecosystem.config.js

    # Salva configurazione PM2
    pm2 save

    # Genera startup script
    pm2 startup

    print_success "Sistema avviato con PM2"
    print_status "Usa 'pm2 status' per controllare lo stato"
    print_status "Usa 'pm2 logs' per vedere i log"
    print_status "Usa 'pm2 monit' per il monitoraggio"
}

# =============================================================================
# INSTALLAZIONE SYSTEMD (opzione 2)
# =============================================================================

install_systemd() {
    print_status "Configurazione servizio systemd..."

    # Crea directory log
    mkdir -p "$LOG_DIR"

    # Copia il file di servizio
    sudo cp telegram-whatsapp.service /etc/systemd/system/

    # Ricarica systemd
    sudo systemctl daemon-reload

    # Abilita servizio all'avvio
    sudo systemctl enable telegram-whatsapp.service

    print_success "Servizio systemd configurato"
}

start_systemd() {
    print_status "Avvio con systemd..."

    # Avvia il servizio
    sudo systemctl start telegram-whatsapp.service

    print_success "Sistema avviato con systemd"
    print_status "Usa 'sudo systemctl status telegram-whatsapp' per controllare lo stato"
    print_status "Usa 'journalctl -u telegram-whatsapp -f' per vedere i log"
}

# =============================================================================
# SCRIPT NOHUP SEMPLICE (opzione 3)
# =============================================================================

start_nohup() {
    print_status "Avvio con nohup..."

    cd "$PROJECT_DIR"
    mkdir -p "$LOG_DIR"

    # Ferma processo esistente
    pkill -f "node index.js" 2>/dev/null || true

    # Avvia con nohup
    nohup node index.js > "$LOG_DIR/output.log" 2>&1 &

    # Salva PID
    echo $! > "$PROJECT_DIR/app.pid"

    print_success "Sistema avviato con nohup (PID: $!)"
    print_status "Usa 'tail -f $LOG_DIR/output.log' per vedere i log"
    print_status "Usa './manage.sh stop_nohup' per fermare"
}

stop_nohup() {
    print_status "Fermando processo nohup..."

    if [ -f "$PROJECT_DIR/app.pid" ]; then
        PID=$(cat "$PROJECT_DIR/app.pid")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            rm "$PROJECT_DIR/app.pid"
            print_success "Processo fermato (PID: $PID)"
        else
            print_warning "Processo non attivo"
            rm "$PROJECT_DIR/app.pid"
        fi
    else
        print_warning "File PID non trovato"
        pkill -f "node index.js" 2>/dev/null || true
    fi
}

# =============================================================================
# FUNZIONI DI UTILITÀ
# =============================================================================

status() {
    print_status "Controllo stato del sistema..."

    echo ""
    echo "=== PM2 ==="
    pm2 list 2>/dev/null || echo "PM2 non installato o nessun processo attivo"

    echo ""
    echo "=== SYSTEMD ==="
    sudo systemctl is-active telegram-whatsapp.service 2>/dev/null || echo "Servizio systemd non attivo"

    echo ""
    echo "=== NOHUP ==="
    if [ -f "$PROJECT_DIR/app.pid" ]; then
        PID=$(cat "$PROJECT_DIR/app.pid")
        if kill -0 "$PID" 2>/dev/null; then
            echo "Processo nohup attivo (PID: $PID)"
        else
            echo "Processo nohup non attivo (PID stale)"
        fi
    else
        echo "Nessun processo nohup"
    fi

    echo ""
    echo "=== PORTE APERTE ==="
    netstat -tlnp | grep :3000 || echo "Porta 3000 non in ascolto"
}

logs() {
    print_status "Visualizzazione log..."

    if [ -f "$LOG_DIR/output.log" ]; then
        tail -f "$LOG_DIR/output.log"
    elif [ -f "$LOG_DIR/combined.log" ]; then
        tail -f "$LOG_DIR/combined.log"
    else
        print_error "Nessun file di log trovato"
        journalctl -u telegram-whatsapp -f
    fi
}

restart() {
    print_status "Riavvio sistema..."

    # Ferma tutti i servizi
    pm2 stop telegram-whatsapp-forwarder 2>/dev/null || true
    sudo systemctl stop telegram-whatsapp.service 2>/dev/null || true
    stop_nohup

    sleep 2

    # Riavvia con l'ultimo metodo usato
    if pm2 list | grep -q telegram-whatsapp-forwarder; then
        pm2 start telegram-whatsapp-forwarder
        print_success "Riavviato con PM2"
    elif sudo systemctl is-enabled telegram-whatsapp.service >/dev/null 2>&1; then
        sudo systemctl start telegram-whatsapp.service
        print_success "Riavviato con systemd"
    else
        start_nohup
    fi
}

cleanup() {
    print_status "Pulizia log e file temporanei..."

    # Pulisci log vecchi (più di 7 giorni)
    find "$LOG_DIR" -name "*.log" -mtime +7 -delete 2>/dev/null || true

    # Pulisci sessione WhatsApp se corrotta
    if [ "$1" = "--full" ]; then
        print_warning "Rimozione sessione WhatsApp..."
        rm -rf "$PROJECT_DIR/whatsapp_session" "$PROJECT_DIR/.wwebjs*"
    fi

    print_success "Pulizia completata"
}

# =============================================================================
# MENU PRINCIPALE
# =============================================================================

show_help() {
    echo "Gestione Telegram to WhatsApp Forwarder"
    echo ""
    echo "INSTALLAZIONE:"
    echo "  install_pm2      - Installa e configura PM2"
    echo "  install_systemd  - Configura servizio systemd"
    echo ""
    echo "AVVIO:"
    echo "  start_pm2        - Avvia con PM2"
    echo "  start_systemd    - Avvia con systemd"
    echo "  start_nohup      - Avvia con nohup"
    echo ""
    echo "GESTIONE:"
    echo "  status           - Mostra stato di tutti i servizi"
    echo "  logs             - Mostra log in tempo reale"
    echo "  restart          - Riavvia il sistema"
    echo "  stop_nohup       - Ferma processo nohup"
    echo ""
    echo "MANUTENZIONE:"
    echo "  cleanup          - Pulisce log vecchi"
    echo "  cleanup --full   - Pulisce tutto inclusa sessione WhatsApp"
    echo ""
    echo "Esempio: ./manage.sh start_pm2"
}

# =============================================================================
# ESECUZIONE
# =============================================================================

case "${1:-help}" in
    "install_pm2")
        install_pm2
        ;;
    "install_systemd")
        install_systemd
        ;;
    "start_pm2")
        start_pm2
        ;;
    "start_systemd")
        start_systemd
        ;;
    "start_nohup")
        start_nohup
        ;;
    "stop_nohup")
        stop_nohup
        ;;
    "status")
        status
        ;;
    "logs")
        logs
        ;;
    "restart")
        restart
        ;;
    "cleanup")
        cleanup $2
        ;;
    "help"|*)
        show_help
        ;;
esac
