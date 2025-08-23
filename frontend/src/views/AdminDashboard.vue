<template>
  <v-container fluid>
    <!-- 헤더 -->
    <div class="d-flex justify-space-between align-center mb-6">
      <div>
        <h1 class="text-h4 mb-2">관리자 설정</h1>
        <p class="text-subtitle-1 text-grey">배달 관리 시스템의 모든 설정을 관리합니다</p>
      </div>
      <div class="d-flex gap-2">
        <v-chip
          :color="adminStore.isGoogleAuthenticated ? 'success' : 'error'"
          size="small"
        >
          <v-icon start>
            {{ adminStore.isGoogleAuthenticated ? 'mdi-check-circle' : 'mdi-alert-circle' }}
          </v-icon>
          {{ adminStore.isGoogleAuthenticated ? 'Google 연결됨' : 'Google 미연결' }}
        </v-chip>
        <v-chip
          :color="adminStore.isSolapiConnected ? 'success' : 'error'"
          size="small"
        >
          <v-icon start>
            {{ adminStore.isSolapiConnected ? 'mdi-check-circle' : 'mdi-alert-circle' }}
          </v-icon>
          {{ adminStore.isSolapiConnected ? 'SOLAPI 연결됨' : 'SOLAPI 미연결' }}
        </v-chip>
      </div>
    </div>

    <!-- 빠른 상태 카드 -->
    <v-row class="mb-6">
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="d-flex align-center">
            <v-avatar color="primary" class="me-3">
              <v-icon>mdi-account-group</v-icon>
            </v-avatar>
            <div>
              <div class="text-h6">0</div>
              <div class="text-caption text-grey">활성 배달기사</div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="d-flex align-center">
            <v-avatar color="success" class="me-3">
              <v-icon>mdi-file-table</v-icon>
            </v-avatar>
            <div>
              <div class="text-h6">{{ adminStore.connectedSheetConnections.length }}</div>
              <div class="text-caption text-grey">연결된 시트</div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="d-flex align-center">
            <v-avatar color="info" class="me-3">
              <v-icon>mdi-message-text</v-icon>
            </v-avatar>
            <div>
              <div class="text-h6">{{ adminStore.successfulMessages.length }}</div>
              <div class="text-caption text-grey">발송 성공 메시지</div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="d-flex align-center">
            <v-avatar color="warning" class="me-3">
              <v-icon>mdi-qrcode</v-icon>
            </v-avatar>
            <div>
              <div class="text-h6">{{ qrCodeCount }}</div>
              <div class="text-caption text-grey">생성된 QR 코드</div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 탭 네비게이션 -->
    <v-tabs v-model="currentTab" class="mb-6" fixed-tabs>
      <v-tab value="sheets">
        <v-icon start>mdi-file-table</v-icon>
        <span class="d-none d-md-inline">스프레드시트</span>
        <span class="d-inline d-md-none">시트</span>
      </v-tab>
      <v-tab value="connections">
        <v-icon start>mdi-calendar-clock</v-icon>
        <span class="d-none d-md-inline">날짜별 연결</span>
        <span class="d-inline d-md-none">연결</span>
      </v-tab>
      <v-tab value="solapi">
        <v-icon start>mdi-message-text</v-icon>
        <span class="d-none d-md-inline">카카오톡</span>
        <span class="d-inline d-md-none">메시지</span>
      </v-tab>
      <v-tab value="settings">
        <v-icon start>mdi-cog</v-icon>
        <span class="d-none d-md-inline">설정</span>
        <span class="d-inline d-md-none">설정</span>
      </v-tab>
    </v-tabs>

    <!-- 탭 컨텐츠 -->
    <v-tabs-window v-model="currentTab">

      <!-- 스프레드시트 연동 탭 -->
      <v-tabs-window-item value="sheets">
        <GoogleSheetsConnection />
      </v-tabs-window-item>

      <!-- 날짜별 연결 탭 -->
      <v-tabs-window-item value="connections">
        <DateBasedSheetConnection />
      </v-tabs-window-item>

      <!-- 카카오톡 연동 탭 -->
      <v-tabs-window-item value="solapi">
        <SolapiIntegration />
      </v-tabs-window-item>

      <!-- 시스템 설정 탭 -->
      <v-tabs-window-item value="settings">
        <SystemSettings />
      </v-tabs-window-item>
    </v-tabs-window>

    <!-- 로딩 오버레이 -->
    <v-overlay
      v-model="isLoading"
      class="align-center justify-center"
      contained
    >
      <div class="text-center">
        <v-progress-circular
          indeterminate
          size="64"
          color="primary"
        />
        <div class="mt-3 text-h6">로딩 중...</div>
      </div>
    </v-overlay>

    <!-- 글로벌 알림 스낵바 -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color">
      {{ snackbar.message }}
      <template v-slot:actions>
        <v-btn icon="mdi-close" @click="snackbar.show = false" />
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useAdminStore } from '@/stores/adminStore'

// 컴포넌트 임포트
import GoogleSheetsConnection from '@/components/GoogleSheetsConnection.vue'
import DateBasedSheetConnection from '@/components/DateBasedSheetConnection.vue'
import SolapiIntegration from '@/components/SolapiIntegration.vue'
import SystemSettings from '@/components/SystemSettings.vue'

// 스토어 사용
const adminStore = useAdminStore()

// 반응형 데이터
const currentTab = ref('sheets')
const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

// 계산된 속성
const isLoading = computed(() => {
  return Object.values(adminStore.loading).some(loading => loading)
})

const qrCodeCount = computed(() => {
  return 0 // 배달기사 관리 제거로 인해 항상 0 반환
})

// 탭 변경 감시
watch(currentTab, (newTab) => {
  // 탭별 데이터 로딩 최적화
  switch (newTab) {
    case 'staff':
      if (adminStore.deliveryStaff.length === 0 && adminStore.isGoogleAuthenticated) {
        adminStore.loadDeliveryStaff().catch(handleError)
      }
      break
    case 'sheets':
      if (adminStore.connectedSheets.length === 0 && adminStore.isGoogleAuthenticated) {
        adminStore.loadConnectedSheets().catch(handleError)
      }
      break
    case 'connections':
      if (adminStore.sheetConnections.length === 0 && adminStore.isGoogleAuthenticated) {
        adminStore.loadSheetConnections().catch(handleError)
      }
      break
    case 'solapi':
      if (adminStore.isSolapiConnected && adminStore.messageHistory.length === 0) {
        adminStore.loadMessageHistory().catch(handleError)
      }
      break
  }
})

// 컴포넌트 마운트
onMounted(async () => {
  try {
    // URL 인증 파라미터 먼저 처리
    const authCompleted = await adminStore.handleUrlAuthParams()
    
    await adminStore.initializeStore()
    
    // URL 파라미터로 초기 탭 설정 (인증 완료되지 않은 경우만)
    if (!authCompleted) {
      const urlParams = new URLSearchParams(window.location.search)
      const tabParam = urlParams.get('tab')
      if (tabParam && ['staff', 'sheets', 'connections', 'solapi', 'settings'].includes(tabParam)) {
        currentTab.value = tabParam
      }
    }
  } catch (error) {
    handleError(error)
  }
})

// 에러 핸들링
const handleError = (error: any) => {
  console.error('Admin Dashboard Error:', error)
  showSnackbar(
    error?.response?.data?.message || error?.message || '알 수 없는 오류가 발생했습니다.',
    'error'
  )
}

// 스낵바 표시
const showSnackbar = (message: string, color: string = 'success') => {
  snackbar.value = {
    show: true,
    message,
    color
  }
}

// 전역 이벤트 리스너 (컴포넌트 간 통신)
const handleNotification = (event: any) => {
  const { message, type } = event.detail
  showSnackbar(message, type || 'success')
}

onMounted(() => {
  document.addEventListener('admin-notification', handleNotification)
})

// 언마운트 시 이벤트 리스너 정리
onUnmounted(() => {
  document.removeEventListener('admin-notification', handleNotification)
})
</script>

<style scoped>
.gap-2 {
  gap: 8px;
}

/* 탭 반응형 스타일 */
@media (max-width: 960px) {
  .v-tabs {
    overflow-x: auto;
  }
}

/* 로딩 오버레이 스타일 */
.v-overlay--contained {
  border-radius: 8px;
}
</style>