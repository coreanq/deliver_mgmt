import express from 'express'
import cors from 'cors'
import session from 'express-session'
import path from 'path'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import sheetsRoutes from './routes/sheets'
import deliveryRoutes from './routes/delivery'
import syncRoutes from './routes/sync'
import solapiRoutes from './routes/solapi'
import qrRoutes from './routes/qr'
import adminRoutes from './routes/admin'
import SyncService from './services/SyncService'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const HOST = process.env.HOST || '0.0.0.0'

// CORS 오리진 설정 - 환경변수에서 동적 생성
const getFrontendUrls = () => {
  const serverIp = process.env.SERVER_IP || 'localhost'
  const frontendPort = process.env.FRONTEND_PORT || '3000'
  
  // 기본 localhost URLs + 설정된 IP URLs
  const baseUrls = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:3002'
  ]
  
  if (serverIp !== 'localhost') {
    baseUrls.push(
      `http://${serverIp}:3000`,
      `http://${serverIp}:3001`,
      `http://${serverIp}:3002`
    )
  }
  
  return baseUrls
}

// 미들웨어 설정
app.use(cors({
  origin: getFrontendUrls(),
  credentials: true
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 세션 설정
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24시간
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