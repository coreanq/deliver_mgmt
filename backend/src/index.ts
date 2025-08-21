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
import SyncService from './services/SyncService'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// 미들웨어 설정
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    message: '배달 관리 시스템 API 서버',
    version: '1.0.0',
    status: 'running'
  })
})

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`)
  console.log(`환경: ${process.env.NODE_ENV || 'development'}`)
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