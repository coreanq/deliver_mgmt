<template>
  <div class="gamma-landing">
    <!-- Header Navigation -->
    <header class="header-nav">
      <div class="nav-links">
        <a href="#" class="nav-link">여기 클릭</a>
        <router-link to="/privacy" class="nav-link">개인정보 처리방침</router-link>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="hero-section">
      <div class="container">
        <div class="hero-content">
          <div class="hero-text">
            <h1 class="hero-title">배민·쿠팡이츠 수수료 <br/>부담 없는<br/>당일 배송 관리</h1>
            <p class="hero-subtitle">
              <strong>배달의 민족</strong>, <strong>쿠팡이츠</strong> <br/>높은 수수료가 부담되시나요?<br/>
              <strong>템플릿</strong> → <strong>구글 시트</strong> → <strong>SMS 발송</strong>으로<br/>
              중간 수수료 없이 직접 운영하는 스마트한 당일 배송 솔루션
            </p>
            <div class="hero-buttons">
              <button class="btn-primary" @click="navigateToAdmin">무료로 시작하기</button>
              <a href="#getting-started" class="btn-secondary" @click="handleGettingStartedClick">3단계 가이드 보기</a>
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

    <!-- Getting Started 3 Steps Section -->
    <section id="getting-started" class="getting-started-section">
      <div class="container">
        <h2 class="section-title">배민·쿠팡이츠 수수료 탈출! 3분만에 완성</h2>
        <p class="section-subtitle">높은 플랫폼 수수료 대신 직접 운영하는 당일 배송 시스템을 3분 만에 구축하세요</p>
        
        <div class="steps-flow">
          <div class="step-card">
            <div class="step-header">
              <div class="step-number-circle">1</div>
              <div class="step-timing">예상 소요시간: 30초</div>
            </div>
            <div class="step-icon">
              <v-icon size="64" color="#10b981">mdi-file-document-plus</v-icon>
            </div>
            <div class="step-content">
              <h3>템플릿으로 구글 스프레드시트 만들기</h3>
              <p>미리 준비된 템플릿을 복사하여 나만의 배송 관리 시트를 즉시 생성. 배송지 주소, 고객명, 전화번호 등 필수 컴럼이 자동 설정됩니다.</p>
            </div>
            <div class="step-action">
              <a href="https://docs.google.com/spreadsheets/d/1jStufou_pvD1csax9EE7l3qqjUIAk0EIgyw67OhqWx8/edit?usp=sharing" target="_blank" class="step-btn step-btn-primary">템플릿 사용하기</a>
            </div>
            <div class="step-arrow">→</div>
          </div>
          
          <div class="step-card">
            <div class="step-header">
              <div class="step-number-circle">2</div>
              <div class="step-timing">예상 소요시간: 2분</div>
            </div>
            <div class="step-icon">
              <v-icon size="64" color="#3b82f6">mdi-message-text</v-icon>
            </div>
            <div class="step-content">
              <h3>SOLAPI 가입 및 SMS 전송 금액 충전</h3>
              <p>SOLAPI에 가입하고 SMS 발송을 위한 금액을 충전하세요. 장문 SMS 한 통당 약 45원으로 이용 가능합니다.</p>
            </div>
            <div class="step-action">
              <a href="https://solapi.com" target="_blank" class="step-btn step-btn-secondary">SOLAPI 가입하기</a>
            </div>
            <div class="step-arrow">→</div>
          </div>
          
          <div class="step-card">
            <div class="step-header">
              <div class="step-number-circle">3</div>
              <div class="step-timing">예상 소요시간: 30초</div>
            </div>
            <div class="step-icon">
              <v-icon size="64" color="#f59e0b">mdi-table-edit</v-icon>
            </div>
            <div class="step-content">
              <h3>당일 배송 관리 시스템 시작</h3>
              <p>이제 구글 시트에 당일 배송 주문을 입력하고, QR 코드로 배송기사들이 실시간 배송 상태를 업데이트. 배민·쿠팡이츠 수수료 없이 직접 운영하세요!</p>
            </div>
            <div class="step-action">
              <button class="step-btn step-btn-success" @click="navigateToAdmin">지금 시작하기</button>
            </div>
          </div>
        </div>
        
        <div class="getting-started-footer">
          <div class="total-time">
            <v-icon size="24" color="#10b981">mdi-clock-fast</v-icon>
            <span>전체 설정 시간: 약 3분</span>
          </div>
          <div class="support-note">
            <v-icon size="24" color="#6b7280">mdi-help-circle</v-icon>
            <span>설정 중 도움이 필요하시면 <a href="mailto:nybetty001@gmail.com" class="support-email-link">문의해 주세요</a></span>
          </div>
        </div>
      </div>
    </section>

    <!-- Why Our Solution Section -->
    <section class="solution-section">
      <div class="container">
        <h2 class="section-title">배민·쿠팡이츠 대신 우리 솔루션을 선택하는 이유</h2>
        <div class="features-grid">
          <div class="feature-item">
            <div class="feature-icon">
              <div class="feature-image-container">
                <v-icon size="48" color="#10b981">mdi-file-document-plus</v-icon>
              </div>
            </div>
            <div class="feature-content">
              <h3>템플릿 기반 즉시 시작</h3>
              <p>미리 준비된 템플릿을 복사하여 바로 시작. 복잡한 설정이나 디자인 작업 없이 30초 만에 완성</p>
            </div>
          </div>
          
          <div class="feature-item">
            <div class="feature-icon">
              <div class="feature-image-container">
                <v-icon size="48" color="#3b82f6">mdi-cash-remove</v-icon>
              </div>
            </div>
            <div class="feature-content">
              <h3>배민·쿠팡이츠 수수료 vs 직접 운영 비용</h3>
              <p>배달의 민족, 쿠팡이츠 수수료 대신, 사용한 SMS 건만 비용 지불.</p>
            </div>
          </div>
          
          <div class="feature-item">
            <div class="feature-icon">
              <div class="feature-image-container">
                <img src="https://imgproxy.gamma.app/resize/quality:80/resizing_type:fit/width:1000/height:1000/https://cdn.gamma.app/oat4vwqvx9caqtz/generated-images/TSb5tcf71ywduzpp02dtk.png" alt="QR 코드 인증" class="feature-image"/>
              </div>
            </div>
            <div class="feature-content">
              <h3>QR 코드로 스마트한 접근</h3>
              <p>배송 담당자는 어떤 기기에서든 QR 스캔으로 자신의 업무만 간편하게 확인하고 상태 업데이트</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Demo Video Section -->
    <section id="demo" class="demo-section">
      <div class="container">
        <div class="demo-content">
          <h2 class="demo-title">배민·쿠팡이츠 대신 직접 운영 데모</h2>
          <p class="demo-subtitle">수수료 없이 당일 배송 관리하는 실제 과정을 확인하세요</p>
          <p class="demo-description">
            배달의 민족, 쿠팡이츠 같은 플랫폼에 15~20% 수수료를 지불하는 대신, 직접 운영하는 당일 배송 시스템을 보여드립니다. 
            구글 시트로 주문 관리부터 QR 코드 배송기사 업데이트, SMS 자동 고객 알림까지 전 과정을 한 번에 확인 가능합니다.
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
        <h2 class="section-title">당일 배송기사 이용 경험</h2>
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

    <!-- Privacy Policy Section moved to dedicated /privacy page -->

    <!-- Floating Action Button -->
    <div class="floating-action-btn" @click="navigateToAdmin">
      <v-icon size="28" color="white">mdi-rocket-launch</v-icon>
      <span class="fab-text">수수료 탈출</span>
    </div>

    <!-- Footer -->
    <footer class="gamma-footer">
      <div class="footer-content">
        <span class="coupang-disclaimer">
          이 웹사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
        </span>
        <div class="footer-actions">
          <router-link to="/privacy" class="footer-link">개인정보 처리방침</router-link>
          <a href="mailto:nybetty001@gmail.com" class="footer-link">문의하기</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
// Home page component - Gamma-style landing page

import { useRouter } from 'vue-router'

const router = useRouter()

const handleGettingStartedClick = () => {
  document.getElementById('getting-started')?.scrollIntoView({ behavior: 'smooth' })
}

const navigateToAdmin = () => {
  router.push('/admin')
}

// 쿠팡 광고는 App.vue에서 처리됨
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

/* Footer minor layout */
.footer-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.footer-link {
  color: #666;
  text-decoration: none;
}

.footer-link:hover {
  color: #000;
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

/* Getting Started Section */
.getting-started-section {
  padding: 100px 0;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
}

.section-subtitle {
  font-size: 1.1rem;
  color: #6b7280;
  text-align: center;
  margin-bottom: 4rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.steps-flow {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 4rem;
  position: relative;
}

.step-card {
  background: white;
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(16, 185, 129, 0.1);
  transition: all 0.3s ease;
  position: relative;
  border: 2px solid transparent;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.step-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 16px 48px rgba(16, 185, 129, 0.2);
  border-color: #10b981;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.step-number-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
}

.step-timing {
  background: #f3f4f6;
  color: #6b7280;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.step-icon {
  text-align: center;
  margin-bottom: 1.5rem;
}

.step-content h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 1rem;
  line-height: 1.4;
}

.step-content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.step-content p {
  color: #4b5563;
  line-height: 1.6;
  margin-bottom: 2rem;
  flex-grow: 1;
}

.step-action {
  text-align: center;
  margin-bottom: 1rem;
}

.step-btn {
  padding: 0.875rem 2rem;
  border-radius: 12px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
  display: inline-block;
  width: 100%;
  max-width: 200px;
}

.step-btn-primary {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.step-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
}

.step-btn-secondary {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.step-btn-secondary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
}

.step-btn-success {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.step-btn-success:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(245, 158, 11, 0.4);
}

.step-arrow {
  position: absolute;
  top: 50%;
  right: -1rem;
  transform: translateY(-50%);
  font-size: 2rem;
  color: #10b981;
  font-weight: 700;
  z-index: 10;
}

.step-card:last-child .step-arrow {
  display: none;
}

.getting-started-footer {
  display: flex;
  justify-content: center;
  gap: 3rem;
  flex-wrap: wrap;
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid #e5e7eb;
}

.total-time, .support-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

.total-time {
  color: #10b981;
}

.support-note {
  color: #6b7280;
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

.support-email-link {
  color: #10b981;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.3s ease;
}

.support-email-link:hover {
  color: #059669;
  text-decoration: underline;
}

/* Floating Action Button */
.floating-action-btn {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 1000;
  background: linear-gradient(135deg, #ff3bbe 0%, #af41f0 100%);
  color: white;
  border-radius: 60px;
  padding: 1rem 2rem;
  box-shadow: 0 8px 32px rgba(215, 58, 215, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.3s ease;
  border: none;
  backdrop-filter: blur(10px);
  animation: pulse 2s infinite;
}

.floating-action-btn:hover {
  transform: translateY(-4px) scale(1.05);
  box-shadow: 0 16px 48px rgba(215, 58, 215, 0.6);
  animation: none;
}

.fab-text {
  font-weight: 600;
  letter-spacing: -0.025em;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 8px 32px rgba(215, 58, 215, 0.4);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 12px 40px rgba(215, 58, 215, 0.6);
  }
}

/* Hide FAB on small screens to avoid conflicts */
@media (max-width: 768px) {
  .floating-action-btn {
    display: none;
  }
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

.coupang-disclaimer {
  color: #6b7280;
  font-size: 0.875rem;
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
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .btn-primary,
  .btn-secondary {
    width: 100%;
    text-align: center;
    min-width: 280px;
  }
  
  .section-title {
    font-size: 2rem;
  }
  
  .section-subtitle {
    font-size: 1rem;
    margin-bottom: 3rem;
  }
  
  /* Getting Started Section Mobile */
  .steps-flow {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  
  .step-card {
    padding: 1.5rem;
  }
  
  .step-arrow {
    display: none; /* Hide arrows on mobile */
  }
  
  .step-btn {
    width: 100%;
    max-width: none;
  }
  
  .getting-started-footer {
    flex-direction: column;
    gap: 1.5rem;
    text-align: center;
  }
  
  .features-grid,
  .workflow-grid {
    grid-template-columns: 1fr;
  }
  
  .feature-item {
    flex-direction: column;
    text-align: center;
    padding: 1.5rem;
  }
  
  .step-item {
    flex-direction: column;
    text-align: center;
  }
  
  .footer-content {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  
  .container {
    padding: 0 1rem;
  }
  
  /* Adjust padding for mobile */
  .getting-started-section,
  .solution-section,
  .demo-section,
  .workflow-section,
  .staff-section {
    padding: 60px 0;
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
