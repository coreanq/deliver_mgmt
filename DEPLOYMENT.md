# 배달 관리 시스템 배포 가이드

## 개요
이 문서는 배달 관리 시스템의 배포 과정을 설명합니다. PM2를 사용한 프로덕션 배포와 Nginx를 통한 리버스 프록시 설정을 포함합니다.

## 사전 요구사항

### 시스템 요구사항
- **Node.js**: 18.x 이상
- **npm**: 9.x 이상
- **PM2**: 최신 버전 (자동 설치됨)
- **Nginx**: 1.18 이상 (선택사항)
- **메모리**: 최소 1GB RAM
- **디스크**: 최소 2GB 여유 공간

### 환경 변수 설정
배포하기 전에 다음 환경 변수 파일들을 적절히 수정해야 합니다:

```bash
backend/.env.production    # 프로덕션 백엔드 설정
backend/.env.staging       # 스테이징 백엔드 설정
frontend/.env.production   # 프로덕션 프론트엔드 설정
frontend/.env.staging      # 스테이징 프론트엔드 설정
```

## 배포 방법

### 1. 자동 배포 (권장)

```bash
# 프로덕션 배포
./deploy.sh production

# 스테이징 배포  
./deploy.sh staging

# 개발 환경 빌드
./deploy.sh development
```

배포 스크립트는 다음 작업을 자동으로 수행합니다:
- Node.js 버전 확인
- PM2 설치 확인 및 설치
- 의존성 설치
- 환경 변수 설정
- 코드 품질 검사 (린트, 타입 체크)
- 테스트 실행
- 프로젝트 빌드
- PM2 배포
- 헬스 체크

### 2. 수동 배포

#### 2.1 의존성 설치
```bash
# 루트 프로젝트
npm install

# 백엔드
cd backend && npm install

# 프론트엔드  
cd frontend && npm install
```

#### 2.2 환경 변수 설정
```bash
# 백엔드 환경 변수
cp backend/.env.production backend/.env

# 프론트엔드 환경 변수
cp frontend/.env.production frontend/.env
```

#### 2.3 빌드
```bash
# 백엔드 빌드
cd backend && npm run build

# 프론트엔드 빌드
cd frontend && npm run build
```

#### 2.4 PM2 배포
```bash
cd backend

# PM2 설치 (글로벌)
npm install -g pm2

# 애플리케이션 시작
pm2 start ecosystem.config.js --env production

# PM2 설정 저장
pm2 save

# 부팅 시 자동 시작 설정
pm2 startup
```

## Nginx 설정

### 1. Nginx 설치 (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install nginx
```

### 2. 사이트 설정
```bash
# 설정 파일 복사
sudo cp nginx.conf /etc/nginx/sites-available/delivery-mgmt

# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/delivery-mgmt /etc/nginx/sites-enabled/

# 기본 사이트 비활성화 (필요한 경우)
sudo rm /etc/nginx/sites-enabled/default
```

### 3. SSL 인증서 설정 (Let's Encrypt 권장)
```bash
# Certbot 설치
sudo apt install certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d your-domain.com

# 자동 갱신 설정
sudo crontab -e
# 다음 줄 추가: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 4. Nginx 재시작
```bash
# 설정 파일 문법 검사
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx

# 부팅 시 자동 시작 설정
sudo systemctl enable nginx
```

## 환경별 설정

### 프로덕션 환경
- **포트**: 백엔드 5001, 프론트엔드 80/443 (Nginx)
- **프로세스**: PM2 클러스터 모드 (CPU 코어 수만큼)
- **로그 레벨**: info
- **보안**: HTTPS 강제, 보안 쿠키 활성화
- **캐싱**: 정적 자원 1년, API 응답 캐시 없음

### 스테이징 환경
- **포트**: 백엔드 5001, 프론트엔드 80 (Nginx)
- **프로세스**: PM2 단일 인스턴스
- **로그 레벨**: debug
- **보안**: HTTP 허용, 기본 보안 설정
- **캐싱**: 정적 자원 1시간, API 응답 캐시 없음

## 모니터링 및 로그

### PM2 명령어
```bash
# 상태 확인
pm2 status

# 로그 확인
pm2 logs delivery-backend

# 실시간 모니터링
pm2 monit

# 애플리케이션 재시작
pm2 restart delivery-backend

# 애플리케이션 중지
pm2 stop delivery-backend

# 메모리 사용량 확인
pm2 show delivery-backend
```

### 로그 파일 위치
```bash
# PM2 로그
~/.pm2/logs/delivery-backend-out.log     # 표준 출력
~/.pm2/logs/delivery-backend-error.log   # 에러 로그

# 애플리케이션 로그 (backend/logs/)
backend/logs/application-YYYY-MM-DD.log  # 일별 로그
backend/logs/error.log                   # 에러만
backend/logs/http.log                    # HTTP 요청

# Nginx 로그
/var/log/nginx/delivery-mgmt-access.log  # 액세스 로그
/var/log/nginx/delivery-mgmt-error.log   # 에러 로그
```

## 보안 고려사항

### 1. 환경 변수 보안
```bash
# 환경 변수 파일 권한 설정
chmod 600 backend/.env*
chmod 600 frontend/.env*

# 민감한 정보 확인
grep -r "password\|secret\|key" backend/.env*
```

### 2. 방화벽 설정
```bash
# UFW 설정 (Ubuntu)
sudo ufw allow 22      # SSH
sudo ufw allow 80      # HTTP
sudo ufw allow 443     # HTTPS
sudo ufw --force enable

# 백엔드 포트는 내부에서만 접근
sudo ufw deny 5001
```

### 3. Nginx 보안 헤더
nginx.conf 파일에 이미 포함된 보안 헤더:
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options`
- `X-Frame-Options`
- `X-XSS-Protection`

## 백업 전략

### 1. 데이터 백업
```bash
# Google Sheets는 자동으로 클라우드에 백업됨
# 추가로 로컬 백업이 필요한 경우:

# 설정 파일 백업
tar -czf backup-$(date +%Y%m%d).tar.gz \
  backend/.env* \
  frontend/.env* \
  backend/logs/ \
  .pm2/
```

### 2. 복구 절차
```bash
# 백업에서 복구
tar -xzf backup-YYYYMMDD.tar.gz

# 애플리케이션 재배포
./deploy.sh production
```

## 트러블슈팅

### 1. 일반적인 문제들

#### PM2 애플리케이션이 시작되지 않는 경우
```bash
# 로그 확인
pm2 logs delivery-backend

# 설정 파일 확인
pm2 show delivery-backend

# 포트 충돌 확인
lsof -ti:5001 | xargs kill -9
```

#### Nginx 502 Bad Gateway
```bash
# 백엔드 상태 확인
pm2 status

# Nginx 에러 로그 확인
sudo tail -f /var/log/nginx/delivery-mgmt-error.log

# 백엔드 재시작
pm2 restart delivery-backend
```

#### 환경 변수 문제
```bash
# 환경 변수 확인
pm2 env delivery-backend

# 환경 변수 파일 문법 확인
cat backend/.env | grep -v '^#' | grep '='
```

### 2. 성능 모니터링

#### 시스템 리소스 확인
```bash
# CPU 및 메모리 사용량
htop

# 디스크 사용량
df -h

# 네트워크 연결 상태
netstat -tlnp
```

#### 애플리케이션 성능
```bash
# PM2 메트릭
pm2 monit

# 로그 분석
tail -f backend/logs/application-$(date +%Y-%m-%d).log | grep "responseTime"
```

## 업데이트 절차

### 1. 무중단 배포
```bash
# 현재 버전 백업
pm2 save

# 새 코드 배포
git pull origin main
./deploy.sh production

# 문제 발생시 롤백
pm2 resurrect
```

### 2. 데이터베이스 마이그레이션
현재 Google Sheets 기반이므로 별도 마이그레이션 불필요.
향후 MongoDB 도입 시 마이그레이션 스크립트 추가 예정.

## 지원 및 문의
- 기술 문서: README.md
- 개발 가이드: CLAUDE.md
- 이슈 트래킹: Git repository issues
- 로그 분석: `pm2 logs` 및 `backend/logs/` 디렉토리 참조