#!/bin/bash

# 배달 관리 시스템 배포 스크립트
# Usage: ./deploy.sh [production|staging|development]

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로깅 함수
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 환경 변수 설정
ENVIRONMENT=${1:-development}
PROJECT_ROOT=$(pwd)
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BUILD_DIR="$PROJECT_ROOT/build"

# 지원되는 환경 확인
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development)$ ]]; then
    error "지원되지 않는 환경입니다. production, staging, development 중 하나를 선택하세요."
    exit 1
fi

log "🚀 배달 관리 시스템 배포 시작 - 환경: $ENVIRONMENT"

# Node.js 버전 확인
check_node_version() {
    log "Node.js 버전 확인 중..."
    
    if ! command -v node &> /dev/null; then
        error "Node.js가 설치되지 않았습니다."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -lt 18 ]]; then
        error "Node.js 18 이상이 필요합니다. 현재 버전: $(node -v)"
        exit 1
    fi
    
    success "Node.js 버전 확인 완료: $(node -v)"
}

# PM2 설치 확인
check_pm2() {
    log "PM2 설치 확인 중..."
    
    if ! command -v pm2 &> /dev/null; then
        warning "PM2가 설치되지 않았습니다. 설치 중..."
        npm install -g pm2
        success "PM2 설치 완료"
    else
        success "PM2 이미 설치됨: $(pm2 -v)"
    fi
}

# 의존성 설치
install_dependencies() {
    log "의존성 설치 중..."
    
    # 루트 의존성
    npm install
    
    # 백엔드 의존성
    cd "$BACKEND_DIR"
    npm install
    
    # 프론트엔드 의존성
    cd "$FRONTEND_DIR"
    npm install
    
    cd "$PROJECT_ROOT"
    success "의존성 설치 완료"
}

# 환경 변수 설정
setup_environment() {
    log "환경 변수 설정 중..."
    
    # 백엔드 환경 변수
    if [[ -f "$BACKEND_DIR/.env.$ENVIRONMENT" ]]; then
        cp "$BACKEND_DIR/.env.$ENVIRONMENT" "$BACKEND_DIR/.env"
        success "백엔드 환경 변수 설정 완료: .env.$ENVIRONMENT"
    else
        warning "백엔드 환경 변수 파일을 찾을 수 없습니다: .env.$ENVIRONMENT"
    fi
    
    # 프론트엔드 환경 변수
    if [[ -f "$FRONTEND_DIR/.env.$ENVIRONMENT" ]]; then
        cp "$FRONTEND_DIR/.env.$ENVIRONMENT" "$FRONTEND_DIR/.env"
        success "프론트엔드 환경 변수 설정 완료: .env.$ENVIRONMENT"
    else
        warning "프론트엔드 환경 변수 파일을 찾을 수 없습니다: .env.$ENVIRONMENT"
    fi
}

# 린트 및 타입 체크
run_quality_checks() {
    if [[ "$ENVIRONMENT" != "development" ]]; then
        log "코드 품질 검사 실행 중..."
        
        # 백엔드 린트
        cd "$BACKEND_DIR"
        if npm run lint --if-present; then
            success "백엔드 린트 검사 통과"
        else
            error "백엔드 린트 검사 실패"
            exit 1
        fi
        
        # 프론트엔드 린트 및 타입 체크
        cd "$FRONTEND_DIR"
        if npm run lint --if-present; then
            success "프론트엔드 린트 검사 통과"
        else
            error "프론트엔드 린트 검사 실패"
            exit 1
        fi
        
        if npm run type-check --if-present; then
            success "타입 체크 통과"
        else
            error "타입 체크 실패"
            exit 1
        fi
        
        cd "$PROJECT_ROOT"
    else
        log "개발 환경에서는 품질 검사를 생략합니다."
    fi
}

# 테스트 실행
run_tests() {
    if [[ "$ENVIRONMENT" != "development" ]]; then
        log "테스트 실행 중..."
        
        # 백엔드 테스트
        cd "$BACKEND_DIR"
        if npm test --if-present; then
            success "백엔드 테스트 통과"
        else
            warning "백엔드 테스트 실패 또는 테스트 스크립트 없음"
        fi
        
        # 프론트엔드 테스트
        cd "$FRONTEND_DIR"
        if npm run test:unit --if-present; then
            success "프론트엔드 단위 테스트 통과"
        else
            warning "프론트엔드 단위 테스트 실패 또는 테스트 스크립트 없음"
        fi
        
        cd "$PROJECT_ROOT"
    else
        log "개발 환경에서는 테스트를 생략합니다."
    fi
}

# 빌드
build_project() {
    log "프로젝트 빌드 중..."
    
    # 빌드 디렉토리 생성
    mkdir -p "$BUILD_DIR"
    
    # 백엔드 빌드
    cd "$BACKEND_DIR"
    npm run build
    success "백엔드 빌드 완료"
    
    # 프론트엔드 빌드
    cd "$FRONTEND_DIR"
    npm run build
    success "프론트엔드 빌드 완료"
    
    cd "$PROJECT_ROOT"
}

# PM2로 애플리케이션 배포
deploy_with_pm2() {
    log "PM2로 애플리케이션 배포 중..."
    
    cd "$BACKEND_DIR"
    
    # 기존 앱 중지 (에러 무시)
    pm2 stop delivery-backend 2>/dev/null || true
    pm2 delete delivery-backend 2>/dev/null || true
    
    # 환경에 따른 PM2 시작
    if [[ "$ENVIRONMENT" == "production" ]]; then
        pm2 start ecosystem.config.js --env production
    elif [[ "$ENVIRONMENT" == "staging" ]]; then
        pm2 start ecosystem.config.js --env staging
    else
        pm2 start ecosystem.config.js --env development
    fi
    
    # PM2 상태 저장
    pm2 save
    
    success "PM2 배포 완료"
    
    # 애플리케이션 상태 확인
    sleep 3
    pm2 status delivery-backend
    
    cd "$PROJECT_ROOT"
}

# Nginx 설정 (선택사항)
setup_nginx() {
    if [[ "$ENVIRONMENT" != "development" ]] && command -v nginx &> /dev/null; then
        log "Nginx 설정 확인 중..."
        
        if [[ -f "/etc/nginx/sites-available/delivery-mgmt" ]]; then
            warning "기존 Nginx 설정이 있습니다. 수동으로 확인하세요."
        else
            warning "Nginx 설정 파일을 수동으로 복사하세요:"
            warning "sudo cp nginx.conf /etc/nginx/sites-available/delivery-mgmt"
            warning "sudo ln -s /etc/nginx/sites-available/delivery-mgmt /etc/nginx/sites-enabled/"
            warning "sudo nginx -t && sudo systemctl reload nginx"
        fi
    else
        log "Nginx 설정을 건너뜁니다."
    fi
}

# 배포 후 헬스 체크
health_check() {
    log "헬스 체크 실행 중..."
    
    sleep 5
    
    # 백엔드 헬스 체크
    BACKEND_URL="http://localhost:5001/api/logging/health"
    
    for i in {1..5}; do
        if curl -f -s "$BACKEND_URL" > /dev/null; then
            success "백엔드 헬스 체크 통과"
            break
        else
            warning "백엔드 헬스 체크 실패 ($i/5). 5초 후 재시도..."
            sleep 5
        fi
        
        if [[ $i -eq 5 ]]; then
            error "백엔드 헬스 체크 최종 실패"
            exit 1
        fi
    done
}

# 배포 정보 출력
print_deployment_info() {
    log "🎉 배포 완료!"
    echo
    echo "=== 배포 정보 ==="
    echo "환경: $ENVIRONMENT"
    echo "시간: $(date)"
    echo "Git 커밋: $(git rev-parse --short HEAD 2>/dev/null || echo 'N/A')"
    echo
    echo "=== 서비스 정보 ==="
    if [[ "$ENVIRONMENT" == "development" ]]; then
        echo "백엔드: http://localhost:5001"
        echo "프론트엔드: http://localhost:3000"
    else
        echo "애플리케이션: PM2로 실행 중"
        echo "상태 확인: pm2 status"
        echo "로그 확인: pm2 logs delivery-backend"
    fi
    echo
    echo "=== 유용한 명령어 ==="
    echo "PM2 상태: pm2 status"
    echo "PM2 로그: pm2 logs delivery-backend"
    echo "PM2 재시작: pm2 restart delivery-backend"
    echo "PM2 중지: pm2 stop delivery-backend"
}

# 메인 배포 프로세스
main() {
    check_node_version
    
    if [[ "$ENVIRONMENT" != "development" ]]; then
        check_pm2
    fi
    
    install_dependencies
    setup_environment
    run_quality_checks
    run_tests
    build_project
    
    if [[ "$ENVIRONMENT" != "development" ]]; then
        deploy_with_pm2
        setup_nginx
        health_check
    fi
    
    print_deployment_info
}

# 스크립트 실행
main "$@"