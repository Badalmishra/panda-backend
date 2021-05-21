module.exports = {

    /**
     * Application configuration section
     * http://pm2.keymetrics.io/docs/usage/application-declaration/
     * pm2 deploy ecosystem.config.js development setup
     * pm2 deploy ecosystem.config.js development update
     * pm2 deploy development update
     * pm2 deploy development exec "pm2 restart all"
     */

    apps: [
        {
            name: 'mediasoup-server',
            script: 'server.js',
            instances: 1,
            autorestart: true,
            max_memory_restart: '256M',
            env: {
                NODE_ENV: 'development'
            }
        }
    ],

    /**
     * Deployment section
     * http://pm2.keymetrics.io/docs/usage/deployment/
     */
    deploy: {

        development: {
            name: 'mediasoup-server',
            user: 'ubuntu',
            host: ['65.1.37.85'],
            ref: 'origin/main',
            repo: 'git@github.com:Badalmishra/mediasoup.git',
            path: '/home/ubuntu/workspace/mediasoup-server',
            'post-deploy': 'node --max_old_space_size=4096 && npm install && pm2 startOrRestart ecosystem.config.js --only mediasoup-server',
            ssh_options: 'StrictHostKeyChecking=no',
            env: {
                "NODE_ENV": "development"
            },
        },
        phase2: {
            name: 'mediasoup-server',
            user: 'ubuntu',
            host: ['65.1.37.85'],
            ref: 'origin/streamer_details',
            repo: 'git@github.com:Badalmishra/mediasoup.git',
            path: '/home/ubuntu/workspace/mediasoup-server',
            'post-deploy': 'node --max_old_space_size=4096 && npm install && pm2 startOrRestart ecosystem.config.js --only mediasoup-server',
            ssh_options: 'StrictHostKeyChecking=no',
            env: {
                "NODE_ENV": "development"
            },
        },
    }
};
