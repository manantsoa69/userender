module.exports = {
  apps: [
    {
      name: 'your-app-name',
      script: 'index.js', // Replace 'app.js' with the actual name of your main server file
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
