import express from 'express';
import { config } from './config/index';
import { setupMiddleware, errorHandler } from './middleware/index';
import { logger } from './utils/logger';
import './types/session';

// Import routes
import authRoutes from './routes/auth';
import sheetsRoutes from './routes/sheets';
import solapiRoutes from './routes/solapi';
import deliveryRoutes from './routes/delivery';

const app = express();

// Setup middleware
setupMiddleware(app);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '서버가 정상 작동 중입니다.',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/sheets', sheetsRoutes);
app.use('/api/solapi', solapiRoutes);
app.use('/api/delivery', deliveryRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '요청한 경로를 찾을 수 없습니다.',
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const server = app.listen(config.port, () => {
  logger.info(`서버가 포트 ${config.port}에서 시작되었습니다.`);
  logger.info(`환경: ${config.nodeEnv}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM 신호를 받았습니다. 서버를 종료합니다.');
  server.close(() => {
    logger.info('서버가 종료되었습니다.');
    process.exit(0);
  });
});

export default app; 
