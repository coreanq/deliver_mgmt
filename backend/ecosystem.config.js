module.exports = {
  apps: [
    {
      name: 'delivery-backend',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 5001,
        LOG_LEVEL: 'debug'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5001,
        LOG_LEVEL: 'info'
      },
      // 로그 설정
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      combine_logs: true,
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_file: './logs/pm2-combined.log',
      
      // 재시작 정책
      watch: false,
      ignore_watch: ['node_modules', 'logs', '*.log'],
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      
      // 헬스체크
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      
      // 클러스터 설정
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 8000,
      
      // 환경별 인스턴스 수
      instances_logs: false,
      merge_logs: true,
      
      // 자동 재시작 설정
      restart_delay: 4000,
      autorestart: true,
      
      // 시간대 설정
      time: true,
      
      // 소스맵 지원
      source_map_support: true,
      
      // 노드 인수
      node_args: '--max-old-space-size=1024'
    }
  ],
  
  deploy: {
    production: {
      user: 'deploy',
      host: ['production-server'],
      ref: 'origin/main',
      repo: 'https://github.com/your-repo/delivery-mgmt.git',
      path: '/var/www/delivery-mgmt',
      'pre-deploy': 'git fetch --all',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production && pm2 save'
    },
    staging: {
      user: 'deploy',
      host: ['staging-server'],
      ref: 'origin/develop',
      repo: 'https://github.com/your-repo/delivery-mgmt.git',
      path: '/var/www/staging/delivery-mgmt',
      'pre-deploy': 'git fetch --all',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging && pm2 save'
    }
  }
}