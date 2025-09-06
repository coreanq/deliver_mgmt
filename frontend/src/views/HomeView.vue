<template>
  <div class="gamma-landing">
    <!-- Header Navigation -->
    <header class="header-nav">
      <div class="nav-links">
        <a href="#" class="nav-link">여기 클릭</a>
        <a href="#" class="nav-link">여기 클릭</a>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="hero-section">
      <div class="container">
        <div class="hero-content">
          <div class="hero-text">
            <h1 class="hero-title">스마트 배송 관리 솔루션</h1>
            <p class="hero-subtitle">
              구글 스프레드시트 기반으로 배송을 간편하게 관리하고, QR 코드로 배송 담당자가 쉽게 접근할 수 있는 시스템입니다.
            </p>
            <div class="hero-buttons">
              <a href="#demo" class="btn-primary" @click="handleDemoClick">데모 보기</a>
              <button class="btn-secondary" @click="navigateToAdmin">무료로 시작하기</button>
            </div>
          </div>
          <div class="hero-visual">
            <div class="hero-image">
              <img src="https://imgproxy.gamma.app/resize/quality:80/resizing_type:fit/width:2400/https://cdn.gamma.app/oat4vwqvx9caqtz/generated-images/2lTud6qyETDoQ8WlikFOw.png" alt="Smart Delivery Management" class="hero-main-image"/>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Why Our Solution Section -->
    <section class="solution-section">
      <div class="container">
        <h2 class="section-title">왜 우리 솔루션인가?</h2>
        <div class="features-grid">
          <div class="feature-item">
            <div class="feature-icon">
              <div class="feature-image-container">
                <img src="https://imgproxy.gamma.app/resize/quality:80/resizing_type:fit/width:1000/height:1000/https://cdn.gamma.app/oat4vwqvx9caqtz/generated-images/JpkVo6gXyKUrSiRvgSNSo.png" alt="설정 1분 완료" class="feature-image"/>
              </div>
            </div>
            <div class="feature-content">
              <h3>설정 1분 완료</h3>
              <p>구글 계정 연동만으로 즉시 시작. 복잡한 설치나 교육 불필요</p>
            </div>
          </div>
          
          <div class="feature-item">
            <div class="feature-icon">
              <div class="feature-image-container">
                <img src="https://imgproxy.gamma.app/resize/quality:80/resizing_type:fit/width:1000/height:1000/https://cdn.gamma.app/oat4vwqvx9caqtz/generated-images/TSb5tcf71ywduzpp02dtk.png" alt="QR 코드 인증" class="feature-image"/>
              </div>
            </div>
            <div class="feature-content">
              <h3>QR 코드 인증</h3>
              <p>배송 담당자는 QR 스캔으로 간편하게 본인 업무 확인 및 상태 변경</p>
            </div>
          </div>
          
          <div class="feature-item">
            <div class="feature-icon">
              <div class="feature-image-container">
                <v-icon size="48" color="#4caf50">mdi-cash-remove</v-icon>
              </div>
            </div>
            <div class="feature-content">
              <h3>중간 수수료 없음</h3>
              <p>별도 플랫폼 수수료 없이 본인의 Google과 SOLAPI 계정으로 직접 운영</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Demo Video Section -->
    <section id="demo" class="demo-section">
      <div class="container">
        <div class="demo-content">
          <h2 class="demo-title">사용자 데모 영상</h2>
          <p class="demo-subtitle">실제 배송 관리 워크플로우를 확인해보세요</p>
          <p class="demo-description">
            관리자가 구글 시트에 주문을 입력하고, 배송 담당자가 QR 코드로 접근하여 배송 상태를 업데이트하는 전체 과정을 보여드립니다. 
            SOLAPI 연동을 통한 자동 고객 알림까지 한 번에 확인 가능합니다.
          </p>
        </div>
      </div>
    </section>

    <!-- Workflow Section -->
    <section class="workflow-section">
      <div class="container">
        <h2 class="section-title">관리자 워크플로우</h2>
        <div class="workflow-grid">
          <div class="workflow-item">
            <div class="workflow-icon">
              <v-icon size="48">mdi-account-key</v-icon>
            </div>
            <div class="workflow-content">
              <h3>OAuth 인증 연동</h3>
              <p>구글 스프레드시트와 SOLAPI 계정을 간편하게 연결</p>
            </div>
          </div>
          
          <div class="workflow-item">
            <div class="workflow-icon">
              <v-icon size="48">mdi-qrcode-plus</v-icon>
            </div>
            <div class="workflow-content">
              <h3>QR 코드 생성</h3>
              <p>배송 담당자별 고유 QR 코드 자동 생성 및 배포</p>
            </div>
          </div>
          
          <div class="workflow-item">
            <div class="workflow-icon">
              <v-icon size="48">mdi-monitor-dashboard</v-icon>
            </div>
            <div class="workflow-content">
              <h3>실시간 모니터링</h3>
              <p>배송 진행 상황과 메시지 발송 현황을 대시보드에서 확인</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Staff Experience Section -->
    <section class="staff-section">
      <div class="container">
        <h2 class="section-title">배송 담당자 경험</h2>
        <div class="staff-steps">
          <div class="step-item">
            <div class="step-number">1</div>
            <div class="step-content">
              <h3>QR 스캔 접근</h3>
              <p>개인 QR 코드를 스캔하여 배송 관리 웹사이트에 즉시 접근합니다.</p>
            </div>
          </div>
          
          <div class="step-item">
            <div class="step-number">2</div>
            <div class="step-content">
              <h3>배송 목록 확인</h3>
              <p>자신에게 할당된 주문만 필터링된 깔끔한 배송 목록을 한눈에 확인합니다.</p>
            </div>
          </div>
          
          <div class="step-item">
            <div class="step-number">3</div>
            <div class="step-content">
              <h3>상태 업데이트</h3>
              <p>터치 친화적인 버튼으로 배송 단계를 쉽고 빠르게 업데이트합니다.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="gamma-footer">
      <div class="footer-content">
        <a href="https://gamma.app" class="gamma-link">
          Made with Gamma
        </a>
        <button class="report-btn">Report this page</button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
// Home page component - Gamma-style landing page

import { useRouter } from 'vue-router'

const router = useRouter()

const handleDemoClick = () => {
  document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })
}

const handleContact = () => {
  // Contact functionality
  alert('문의 기능은 준비 중입니다.')
}

const navigateToAdmin = () => {
  router.push('/admin')
}

const navigateToDelivery = () => {
  router.push('/delivery/auth')
}
</script>

<style scoped>
/* Gamma-style Landing Page */
.gamma-landing {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #fff;
}

/* Header Navigation */
.header-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #eee;
  padding: 1rem 0;
}

.nav-links {
  display: flex;
  justify-content: flex-end;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.nav-link {
  color: #666;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s ease;
}

.nav-link:hover {
  color: #000;
}

/* Container */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* Hero Section */
.hero-section {
  padding: 120px 0 80px;
  background: url('https://imgproxy.gamma.app/resize/quality:80/resizing_type:fit/width:2400/https://cdn.gamma.app/theme_images/atmosphere-background.a041341a.png?w=2666&q=70');
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  position: relative;
  overflow: hidden;
}

.hero-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(235, 208, 251, 0.9) 10%, rgba(255, 204, 239, 0.9) 90%);
  z-index: 1;
}

.hero-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
  min-height: 60vh;
  position: relative;
  z-index: 2;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 1.5rem;
  color: #1a202c;
  background: linear-gradient(135deg, #1a202c 0%, #4a5568 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-subtitle {
  font-size: 1.25rem;
  line-height: 1.7;
  color: #4a5568;
  margin-bottom: 2.5rem;
}

.hero-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.hero-visual {
  display: flex;
  justify-content: center;
  align-items: center;
}

.hero-image {
  width: 100%;
  display: flex;
  justify-content: center;
}

.hero-main-image {
  width: 100%;
  max-width: 500px;
  height: auto;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(215, 58, 215, 0.2);
}

.btn-primary {
  background: linear-gradient(68deg, rgb(255, 51, 190) 10%, rgb(175, 65, 240) 90%);
  color: white;
  padding: 1rem 2rem;
  border-radius: 12px;
  text-decoration: none;
  font-weight: 600;
  font-size: 1.1rem;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(215, 58, 215, 0.3);
  border: none;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(215, 58, 215, 0.4);
  background: linear-gradient(68deg, rgb(235, 71, 210) 10%, rgb(195, 85, 260) 90%);
}

.btn-secondary {
  background: white;
  color: #374151;
  padding: 1rem 2rem;
  border-radius: 12px;
  text-decoration: none;
  font-weight: 600;
  font-size: 1.1rem;
  transition: all 0.3s ease;
  border: 2px solid #e5e7eb;
  cursor: pointer;
}

.btn-secondary:hover {
  border-color: rgb(215, 58, 215);
  color: rgb(215, 58, 215);
  transform: translateY(-2px);
}

/* Solution Section */
.solution-section {
  padding: 100px 0;
  background: white;
}

.section-title {
  font-size: 2.5rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 4rem;
  color: #1a202c;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 3rem;
  margin-top: 3rem;
}

.feature-item {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
  padding: 2rem;
  border-radius: 16px;
  background: #f8fafc;
  transition: all 0.3s ease;
}

.feature-item:hover {
  background: white;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  transform: translateY(-4px);
}

.feature-icon {
  flex-shrink: 0;
}

.feature-image-container {
  width: 80px;
  height: 80px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(215, 58, 215, 0.2);
}

.feature-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feature-content h3 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: #1a202c;
}

.feature-content p {
  color: #6b7280;
  line-height: 1.6;
}

/* Demo Section */
.demo-section {
  padding: 100px 0;
  background: linear-gradient(135deg, rgba(244, 212, 247, 0.3) 0%, rgba(255, 204, 239, 0.3) 100%);
  text-align: center;
}

.demo-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: #1a202c;
}

.demo-subtitle {
  font-size: 1.25rem;
  color: #6b7280;
  margin-bottom: 2rem;
}

.demo-description {
  max-width: 800px;
  margin: 0 auto;
  font-size: 1.1rem;
  line-height: 1.7;
  color: #4b5563;
}

/* Workflow Section */
.workflow-section {
  padding: 100px 0;
  background: white;
}

.workflow-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 3rem;
  margin-top: 3rem;
}

.workflow-item {
  text-align: center;
  padding: 2rem;
  border-radius: 16px;
  background: #f8fafc;
  transition: all 0.3s ease;
}

.workflow-item:hover {
  background: white;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  transform: translateY(-4px);
}

.workflow-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
}

.workflow-content h3 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: #1a202c;
}

.workflow-content p {
  color: #6b7280;
  line-height: 1.6;
}

/* Staff Section */
.staff-section {
  padding: 100px 0;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
}

.staff-steps {
  display: grid;
  gap: 2rem;
  margin-top: 3rem;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.step-item {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
  padding: 2rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.step-number {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.step-content h3 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: #1a202c;
}

.step-content p {
  color: #6b7280;
  line-height: 1.6;
}

/* Footer */
.gamma-footer {
  padding: 2rem 0;
  background: #f8fafc;
  border-top: 1px solid #e5e7eb;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.gamma-link {
  color: #6b7280;
  text-decoration: none;
  font-size: 0.875rem;
}

.gamma-link:hover {
  color: #374151;
}

.report-btn {
  background: none;
  border: 1px solid #e5e7eb;
  color: #6b7280;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.report-btn:hover {
  border-color: #374151;
  color: #374151;
}

/* Responsive Design */
@media (max-width: 768px) {
  .hero-content {
    grid-template-columns: 1fr;
    gap: 2rem;
    text-align: center;
  }
  
  .hero-title {
    font-size: 2.5rem;
  }
  
  .hero-buttons {
    justify-content: center;
  }
  
  .btn-primary,
  .btn-secondary {
    width: 100%;
    text-align: center;
  }
  
  .section-title {
    font-size: 2rem;
  }
  
  .features-grid,
  .workflow-grid {
    grid-template-columns: 1fr;
  }
  
  .feature-item {
    flex-direction: column;
    text-align: center;
  }
  
  .step-item {
    flex-direction: column;
    text-align: center;
  }
  
  .footer-content {
    flex-direction: column;
    gap: 1rem;
  }
  
  .container {
    padding: 0 1rem;
  }
}

@media (max-width: 480px) {
  .hero-title {
    font-size: 2rem;
  }
  
  .demo-title {
    font-size: 2rem;
  }
}
</style>