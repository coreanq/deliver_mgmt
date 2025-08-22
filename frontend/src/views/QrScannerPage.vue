<template>
  <v-container fluid class="qr-scanner-page">
    <v-row justify="center" align="center" class="fill-height">
      <v-col cols="12" sm="10" md="8" lg="6">
        <!-- 앱 로고/제목 -->
        <div class="text-center mb-6">
          <v-icon
            icon="mdi-truck-delivery"
            size="64"
            color="primary"
            class="mb-4"
          ></v-icon>
          <h1 class="text-h4 font-weight-bold text-primary mb-2">
            배달 관리 시스템
          </h1>
          <p class="text-body-1 text-grey-600">
            QR 코드를 스캔하여 배송 업무를 시작하세요
          </p>
        </div>

        <!-- QR 스캐너 컴포넌트 -->
        <QrCodeScanner />

        <!-- 도움말 -->
        <v-card class="mt-6" variant="outlined">
          <v-card-title class="text-h6">
            <v-icon icon="mdi-help-circle" class="me-2"></v-icon>
            사용 방법
          </v-card-title>
          <v-card-text>
            <v-timeline density="compact" align="start">
              <v-timeline-item
                dot-color="primary"
                size="small"
              >
                <div class="mb-4">
                  <div class="text-body-1 font-weight-medium">
                    1. QR 코드 스캔
                  </div>
                  <div class="text-body-2 text-grey-600">
                    관리자가 발급한 배송자 QR 코드를 스캔하세요
                  </div>
                </div>
              </v-timeline-item>

              <v-timeline-item
                dot-color="success"
                size="small"
              >
                <div class="mb-4">
                  <div class="text-body-1 font-weight-medium">
                    2. 자동 인증
                  </div>
                  <div class="text-body-2 text-grey-600">
                    배송자 정보와 작업 날짜가 자동으로 확인됩니다
                  </div>
                </div>
              </v-timeline-item>

              <v-timeline-item
                dot-color="info"
                size="small"
              >
                <div>
                  <div class="text-body-1 font-weight-medium">
                    3. 배송 관리 시작
                  </div>
                  <div class="text-body-2 text-grey-600">
                    인증 완료 후 배송 대시보드에서 주문을 관리하세요
                  </div>
                </div>
              </v-timeline-item>
            </v-timeline>
          </v-card-text>
        </v-card>

        <!-- 문제해결 -->
        <v-expansion-panels class="mt-6" variant="accordion">
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon icon="mdi-tools" class="me-2"></v-icon>
              문제가 발생했나요?
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div class="problem-solutions">
                <div class="mb-4">
                  <h4 class="text-h6 mb-2">QR 코드 스캔이 안 되는 경우</h4>
                  <ul>
                    <li>QR 코드가 화면에 명확히 보이는지 확인하세요</li>
                    <li>조명이 충분한 곳에서 스캔하세요</li>
                    <li>QR 코드가 손상되지 않았는지 확인하세요</li>
                    <li>카메라 권한이 허용되었는지 확인하세요</li>
                  </ul>
                </div>

                <div class="mb-4">
                  <h4 class="text-h6 mb-2">로그인이 안 되는 경우</h4>
                  <ul>
                    <li>관리자에게 배송자 등록을 확인하세요</li>
                    <li>해당 날짜의 스프레드시트 연결을 확인하세요</li>
                    <li>QR 코드가 최신 버전인지 확인하세요</li>
                  </ul>
                </div>

                <div>
                  <h4 class="text-h6 mb-2">기타 문제</h4>
                  <ul>
                    <li>인터넷 연결을 확인하세요</li>
                    <li>브라우저를 새로고침해보세요</li>
                    <li>문제가 지속되면 관리자에게 문의하세요</li>
                  </ul>
                </div>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

        <!-- 연락처 정보 -->
        <v-card class="mt-6" color="grey-lighten-4" variant="flat">
          <v-card-text class="text-center">
            <v-icon icon="mdi-phone" class="me-2"></v-icon>
            <span class="text-body-2">
              기술적 문제나 도움이 필요하시면 관리자에게 문의하세요
            </span>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import QrCodeScanner from '@/components/QrCodeScanner.vue'
import axios from 'axios'

const router = useRouter()

// 컴포넌트 마운트시 인증 상태 확인
onMounted(async () => {
  try {
    // 이미 로그인된 사용자인지 확인
    const response = await axios.get('/api/delivery/current-work')
    if (response.data.success) {
      // 이미 로그인된 상태면 대시보드로 리다이렉트
      router.push('/delivery-dashboard')
    }
  } catch (error) {
    // 인증되지 않은 상태는 정상 (스캐너 페이지에 머물러야 함)
  }
})
</script>

<style scoped>
.qr-scanner-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px 0;
}

.fill-height {
  min-height: 100vh;
}

.problem-solutions h4 {
  color: #1976d2;
  font-weight: 600;
}

.problem-solutions ul {
  margin-left: 20px;
}

.problem-solutions li {
  margin-bottom: 4px;
  color: #666;
}

/* 타임라인 스타일 조정 */
.v-timeline-item {
  padding-bottom: 0;
}
</style>