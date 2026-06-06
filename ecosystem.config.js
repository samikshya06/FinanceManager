module.exports = {
  apps: [
    {
      name: 'finance-manager-api',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/finance-manager-error.log',
      out_file: '/var/log/pm2/finance-manager-out.log',
      log_file: '/var/log/pm2/finance-manager.log',
      time: true,
      // Restart app if it crashes
      min_uptime: '10s',
      max_restarts: 5,
      // Wait 4000ms before restarting after a crash
      restart_delay: 4000
    },
    {
      name: 'finance-manager-worker',
      script: 'worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/pm2/finance-worker-error.log',
      out_file: '/var/log/pm2/finance-worker-out.log',
      log_file: '/var/log/pm2/finance-worker.log',
      time: true,
      min_uptime: '10s',
      max_restarts: 3,
      restart_delay: 5000
    }
  ],

  deploy: {
    production: {
      user: 'ec2-user',
      host: 'YOUR_EC2_PUBLIC_IP',
      ref: 'origin/main',
      repo: 'https://github.com/yourusername/finance-manager.git',
      path: '/var/app/finance-manager',
      'pre-deploy-local': '',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};