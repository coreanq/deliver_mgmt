import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Session configuration
  sessionSecret: process.env.SESSION_SECRET || 'default-session-secret',
  
  // JWT configuration
  jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret',
  
  // Google OAuth2
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUrl: process.env.GOOGLE_REDIRECT_URL || 'http://localhost:3000/api/auth/google/callback',
  },
  
  // SOLAPI OAuth2
  solapi: {
    clientId: process.env.SOLAPI_CLIENT_ID || '',
    clientSecret: process.env.SOLAPI_CLIENT_SECRET || '',
    redirectUrl: process.env.SOLAPI_REDIRECT_URL || 'http://localhost:3000/api/auth/solapi/callback',
    apiBaseUrl: process.env.SOLAPI_API_BASE_URL || 'https://api.solapi.com',
  },
  
  // QR Code security
  qrSecretKey: process.env.QR_SECRET_KEY || 'default-qr-secret',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  
  // Frontend URL
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};