import express from 'express';
import cors from 'cors';
import session from 'express-session';
import helmet from 'helmet';
import { config } from '../config/index';
import { logger } from '../utils/logger';

export const setupMiddleware = (app: express.Application): void => {
  // Security middleware
  app.use(helmet());
  
  // CORS configuration
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  
  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Session configuration
  app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.nodeEnv === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));
  
  // Request logging middleware
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} - ${req.ip}`);
    next();
  });
};

// Error handling middleware
export const errorHandler = (
  err: Error,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  logger.error('Unhandled error:', err);
  
  res.status(500).json({
    success: false,
    message: '서버 오류가 발생했습니다.',
    error: config.nodeEnv === 'development' ? err.message : undefined,
  });
};