module.exports = {
    apps: [{
        name: 'telegram-whatsapp-forwarder',
        script: 'index.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'development',
            PORT: 3000
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        // Logging
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        out_file: './logs/out.log',
        error_file: './logs/error.log',
        log_file: './logs/combined.log',
        time: true,

        // Restart strategies
        min_uptime: '10s',
        max_restarts: 5,
        restart_delay: 4000,

        // Advanced PM2 features
        kill_timeout: 5000,
        listen_timeout: 3000,

        // Node.js options
        node_args: '--max-old-space-size=1024',

        // Cron restart (opzionale - restart ogni giorno alle 3:00)
        cron_restart: '0 3 * * *',

        // Ignore watch
        ignore_watch: [
            'node_modules',
            'logs',
            'whatsapp_session',
            '.wwebjs*'
        ]
    }]
};
