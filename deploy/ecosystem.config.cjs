/**
 * PM2 config example
 *
 * Usage on server:
 *   cd /path/to/project/backend
 *   npm ci && npm run build
 *   cd ..
 *   npm ci && npm run build
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save
 */

module.exports = {
  apps: [
    {
      name: 'aqm-backend',
      cwd: __dirname + '/../backend',
      script: 'dist/index.js',
      node_args: '--enable-source-maps',
      env: {
        NODE_ENV: 'production',
        API_PORT: 8080,
        WS_PATH: '/ws',
      },
    },
  ],
};
