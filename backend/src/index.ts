import express from 'express'
import cors from 'cors'
import session from 'express-session'
import path from 'path'
import dotenv from 'dotenv'
import helmet from 'helmet'

// UTF-8 환경 설정
process.env.LANG = 'ko_KR.UTF-8'
process.env.LC_ALL = 'ko_KR.UTF-8'
import authRoutes from './routes/auth'
import sheetsRoutes from './routes/sheets'
import deliveryRoutes from './routes/delivery'
import syncRoutes from './routes/sync'
import solapiRoutes from './routes/solapi'
import qrRoutes from './routes/qr'
import adminRoutes from './routes/admin'
import SyncService from './services/SyncService'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { sanitizeInputs, setSecurityHeaders } from './middleware/validation'
import { generalRateLimit, authRateLimit } from './middleware/rateLimiter'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const HOST = process.env.HOST || '0.0.0.0'

// CORS 오리진 설정 - 환경변수에서 동적 생성 및 보안 강화
const getFrontendUrls = () => {
  const serverIp = process.env.SERVER_IP || 'localhost'
  const frontendPort = process.env.FRONTEND_PORT || '3000'
  
  // 프로덕션 환경에서는 명시적 허용만
  if (process.env.NODE_ENV === 'production') {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || []
    if (allowedOrigins.length > 0) {
      return allowedOrigins
    }
  }
  
  // 개발 환경에서만 포트 범위 허용
  const baseUrls = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005'
  ]
  
  if (serverIp !== 'localhost') {
    baseUrls.push(
      `http://${serverIp}:3000`,
      `http://${serverIp}:3001`,
      `http://${serverIp}:3002`,
      `http://${serverIp}:3003`,
      `http://${serverIp}:3004`,
      `http://${serverIp}:3005`
    )
  }
  
  return baseUrls
}

// 보안 헤더 설정 (helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://sheets.googleapis.com", "https://www.googleapis.com", "https://oauth2.googleapis.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false // QR 코드 이미지 표시를 위해
}))

// 개발 환경에서 CORS를 좀 더 관대하게 설정
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = getFrontendUrls()
    
    console.log(`요청 Origin: ${origin}, URL: ${arguments[2]?.originalUrl || 'N/A'}`)
    
    // 개발 환경에서는 origin이 undefined인 경우 허용
    if (!origin) {
      console.log('Origin이 없는 요청 (리다이렉트/직접 접근) - 허용')
      return callback(null, true)
    }
    
    if (allowedOrigins.includes(origin)) {
      console.log('허용된 Origin - 허용')
      return callback(null, true)
    }
    
    console.warn(`CORS 정책 위반: 허용되지 않은 origin - ${origin}`)
    return callback(new Error('CORS 정책에 의해 차단되었습니다.'), false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400
}))

// 보안 헤더 설정
app.use(setSecurityHeaders)

// 일반적인 입력값 새니타이제이션
app.use(sanitizeInputs)

// 전역 Rate Limiting
app.use('/api', generalRateLimit)

// 인증 관련 엔드포인트에 특별한 Rate Limiting
app.use('/api/auth', authRateLimit)

// UTF-8 인코딩 설정
app.use((req, res, next) => {
  res.charset = 'utf-8'
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  next()
})

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// URL 쿼리 파라미터 파싱 설정
app.set('query parser', 'simple')

// 세션 보안 강화 설정
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-this-in-production',
  name: 'sessionId', // 기본 세션 쿠키명 변경
  resave: false,
  saveUninitialized: false,
  rolling: true, // 활동시마다 세션 만료시간 연장
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS에서만 전송
    httpOnly: true, // XSS 방지
    maxAge: 2 * 60 * 60 * 1000, // 2시간으로 단축 (보안 강화)
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' // CSRF 방지
  }
}))

// 정적 파일 서빙 (테스트 페이지용)
app.use('/test', express.static(path.join(__dirname, '../public')))

// 라우트 설정
app.use('/api/auth', authRoutes)
app.use('/api/sheets', sheetsRoutes)
app.use('/api/delivery', deliveryRoutes)
app.use('/api/sync', syncRoutes)
app.use('/api/solapi', solapiRoutes)
app.use('/api/qr', qrRoutes)
app.use('/api/admin', adminRoutes)

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    message: '배달 관리 시스템 API 서버',
    version: '1.0.0',
    status: 'running'
  })
})

// 404 핸들러 (모든 라우트 다음에 위치)
app.use(notFoundHandler)

// 에러 핸들링 미들웨어 (맨 마지막에 위치)
app.use(errorHandler)

// 서버 시작
app.listen(Number(PORT), HOST, () => {
  console.log(`서버가 ${HOST}:${PORT}에서 실행 중입니다.`)
  console.log(`환경: ${process.env.NODE_ENV || 'development'}`)
  console.log(`허용된 프론트엔드 URLs:`, getFrontendUrls())
})

// 서버 종료 시 정리 작업
process.on('SIGINT', () => {
  console.log('\n서버 종료 중...')
  SyncService.stopAllSyncs()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n서버 종료 중...')
  SyncService.stopAllSyncs()
  process.exit(0)
})

export default app