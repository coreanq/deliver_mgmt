<template>
  <div class="privacy-page">
    <section class="privacy-hero">
      <div class="container">
        <h1>개인정보 처리방침</h1>
        <p class="subtitle">본 서비스는 최소한의 개인정보만을 처리하며, 관련 법령과 내부 규정을 준수합니다.</p>
      </div>
    </section>

    <section class="privacy-section">
      <div class="container">
        <div class="privacy-card">
          <div class="privacy-grid">
            <div class="privacy-item">
              <h3>수집 항목</h3>
              <ul>
                <li>관리자: 구글 계정 이메일, Google/SOLAPI 액세스 토큰(암호화 저장)</li>
                <li>배송담당자: 성명(시트 내 표기), QR 토큰(만료 24시간)</li>
                <li>업무 데이터: 구글 스프레드시트 내 주문/배송 정보(사용자 소유)</li>
              </ul>
            </div>

            <div class="privacy-item">
              <h3>수집 목적</h3>
              <ul>
                <li>관리자 인증 및 세션 관리</li>
                <li>배송 담당자 본인 확인 및 업무 접근</li>
                <li>배송 상태 업데이트 및 고객 알림(SMS) 자동화</li>
              </ul>
            </div>

            <div class="privacy-item">
              <h3>보관 기간</h3>
              <ul>
                <li>세션: 최대 1일</li>
                <li>통합 사용자 데이터(토큰/설정): 최대 1년</li>
                <li>QR 토큰: 24시간 후 자동 만료</li>
              </ul>
            </div>

            <div class="privacy-item">
              <h3>제공 및 위탁</h3>
              <ul>
                <li>제3자 제공 없음(법령상 요청 제외)</li>
                <li>전송·보관 인프라: Cloudflare(KV/Workers), Google APIs, SOLAPI</li>
              </ul>
            </div>

            <div class="privacy-item">
              <h3>보안 조치</h3>
              <ul>
                <li>세션 쿠키: HttpOnly, Secure, SameSite=None</li>
                <li>민감정보 마스킹 로깅 및 최소 수집 원칙 준수</li>
                <li>토큰 만료 전 자동 갱신 및 폐기 정책</li>
              </ul>
            </div>

            <div class="privacy-item">
              <h3>이용자 권리</h3>
              <ul>
                <li>접근, 정정, 삭제, 처리정지 요청 가능</li>
                <li>문의 시 합리적 기간 내 조치 및 회신</li>
              </ul>
            </div>
          </div>

          <div class="privacy-contact">
            <p>문의: nybettybar001@gmail.com · 정책 개정 시 홈페이지 공지</p>
            <p class="privacy-updated">시행일: 2025-09-01</p>
          </div>

          <div class="back-link">
            <router-link to="/home">홈으로 돌아가기</router-link>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// PrivacyPolicyView
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.privacy-hero {
  padding: 72px 0 24px;
  background: #f8f8ff;
  border-bottom: 1px solid #eee;
}

.privacy-hero h1 {
  margin: 0 0 8px;
}

.subtitle {
  color: #666;
  margin: 0;
}

.privacy-section {
  padding: 32px 0 64px;
  background: #fafafa;
}

.privacy-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.privacy-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.privacy-item h3 {
  font-size: 18px;
  margin: 0 0 8px;
}

.privacy-item ul {
  margin: 0;
  padding-left: 18px;
  color: #444;
}

.privacy-contact {
  margin-top: 16px;
  font-size: 14px;
  color: #666;
}

.privacy-updated {
  margin-top: 4px;
}

.back-link {
  margin-top: 16px;
}

@media (max-width: 960px) {
  .privacy-grid {
    grid-template-columns: 1fr;
  }
}
</style>

