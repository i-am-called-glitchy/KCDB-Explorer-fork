module.exports = {
    apps: [
        {
            name: 'kcdb-explorer',
            script: 'server.js',
            exec_mode: 'fork',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '256M',
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            env: {
                NODE_ENV: 'production',
                PORT: 2764,
            },
        },
    ],
};
