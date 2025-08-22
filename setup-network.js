#!/usr/bin/env node
/**
 * 네트워크 설정 자동화 스크립트
 * 사용법: node setup-network.js [IP주소]
 * 예: node setup-network.js 192.168.1.100
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

// 명령행 인자에서 IP 가져오기 또는 자동 감지
const getServerIP = () => {
  if (process.argv[2]) {
    return process.argv[2]
  }
  
  // 자동 IP 감지
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address
      }
    }
  }
  
  return 'localhost'
}

const serverIP = getServerIP()
const serverPort = '5000'
const frontendPort = '3000'

console.log(`🔧 네트워크 설정 중... IP: ${serverIP}`)

// Backend .env 업데이트
const backendEnvPath = path.join(__dirname, 'backend', '.env')
let backendEnv = fs.readFileSync(backendEnvPath, 'utf8')

backendEnv = backendEnv.replace(/SERVER_IP=.*/g, `SERVER_IP=${serverIP}`)
backendEnv = backendEnv.replace(/SERVER_PORT=.*/g, `SERVER_PORT=${serverPort}`)

fs.writeFileSync(backendEnvPath, backendEnv)
console.log('✅ Backend .env 업데이트 완료')

// Frontend .env 업데이트
const frontendEnvPath = path.join(__dirname, 'frontend', '.env')
let frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8')

frontendEnv = frontendEnv.replace(/VITE_SERVER_IP=.*/g, `VITE_SERVER_IP=${serverIP}`)
frontendEnv = frontendEnv.replace(/VITE_SERVER_PORT=.*/g, `VITE_SERVER_PORT=${serverPort}`)

fs.writeFileSync(frontendEnvPath, frontendEnv)
console.log('✅ Frontend .env 업데이트 완료')

console.log('\n📋 설정 완료:')
console.log(`- 백엔드: http://${serverIP}:${serverPort}`)
console.log(`- 프론트엔드: http://${serverIP}:${frontendPort}`)
console.log(`- 관리자 대시보드: http://${serverIP}:${frontendPort}/admin`)
console.log('\n🔄 서버를 재시작하세요!')