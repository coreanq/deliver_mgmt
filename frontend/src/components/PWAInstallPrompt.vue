<template>
  <v-snackbar
    v-model="showPrompt"
    location="bottom"
    timeout="-1"
    color="primary"
    class="pwa-install-prompt"
  >
    <div class="d-flex align-center">
      <v-icon class="mr-3">mdi-cellphone-arrow-down</v-icon>
      <div class="flex-grow-1">
        <div class="text-subtitle-2 font-weight-medium">
          앱으로 설치
        </div>
        <div class="text-caption">
          홈 화면에 추가하여 더 빠르게 접근하세요
        </div>
      </div>
    </div>
    
    <template #actions>
      <v-btn
        variant="text"
        color="white"
        @click="dismissPrompt"
        size="small"
      >
        나중에
      </v-btn>
      <v-btn
        variant="outlined"
        color="white"
        @click="installApp"
        size="small"
        :loading="installing"
      >
        설치
      </v-btn>
    </template>
  </v-snackbar>
  
  <!-- 업데이트 알림 -->
  <v-snackbar
    v-model="showUpdatePrompt"
    location="bottom"
    timeout="-1"
    color="success"
    class="pwa-update-prompt"
  >
    <div class="d-flex align-center">
      <v-icon class="mr-3">mdi-update</v-icon>
      <div class="flex-grow-1">
        <div class="text-subtitle-2 font-weight-medium">
          업데이트 사용 가능
        </div>
        <div class="text-caption">
          새로운 기능과 개선사항이 있습니다
        </div>
      </div>
    </div>
    
    <template #actions>
      <v-btn
        variant="text"
        color="white"
        @click="dismissUpdate"
        size="small"
      >
        나중에
      </v-btn>
      <v-btn
        variant="outlined"
        color="white"
        @click="applyUpdate"
        size="small"
        :loading="updating"
      >
        업데이트
      </v-btn>
    </template>
  </v-snackbar>
  
  <!-- 네트워크 상태 알림 -->
  <v-snackbar
    v-model="showOfflineAlert"
    location="top"
    timeout="-1"
    color="warning"
    class="network-status-alert"
  >
    <div class="d-flex align-center">
      <v-icon class="mr-3">mdi-wifi-off</v-icon>
      <div class="flex-grow-1">
        <div class="text-subtitle-2 font-weight-medium text-black">
          오프라인 모드
        </div>
        <div class="text-caption text-black">
          일부 기능이 제한될 수 있습니다
        </div>
      </div>
    </div>
    
    <template #actions>
      <v-btn
        variant="text"
        color="black"
        @click="showOfflineAlert = false"
        size="small"
      >
        확인
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import pwaService from '@/services/PWAService'

// 상태 관리
const showPrompt = ref(false)
const showUpdatePrompt = ref(false)
const showOfflineAlert = ref(false)
const installing = ref(false)
const updating = ref(false)

let networkCleanup: (() => void) | null = null

// 컴포넌트 마운트
onMounted(async () => {
  // PWA 상태 확인
  const status = await pwaService.getAppInfo()
  
  // 설치 프롬프트 표시 (설치되지 않은 경우만)
  if (status.canInstall && !status.isInstalled) {
    // 3초 후 프롬프트 표시
    setTimeout(() => {
      showPrompt.value = true
    }, 3000)
  }
  
  // 업데이트 사용 가능 이벤트 리스너
  window.addEventListener('pwa-update-available', handleUpdateAvailable)
  
  // 네트워크 상태 모니터링
  networkCleanup = pwaService.onNetworkStatusChange((isOnline) => {
    if (!isOnline) {
      showOfflineAlert.value = true
    } else {
      showOfflineAlert.value = false
    }
  })
})

// 컴포넌트 언마운트
onUnmounted(() => {
  window.removeEventListener('pwa-update-available', handleUpdateAvailable)
  if (networkCleanup) {
    networkCleanup()
  }
})

// 앱 설치
const installApp = async () => {
  installing.value = true
  
  try {
    const success = await pwaService.showInstallPrompt()
    if (success) {
      showPrompt.value = false
    }
  } catch (error) {
    console.error('PWA 설치 실패:', error)
  } finally {
    installing.value = false
  }
}

// 설치 프롬프트 무시
const dismissPrompt = () => {
  showPrompt.value = false
  // 1시간 후 다시 표시
  setTimeout(() => {
    if (!pwaService.isAppInstalled()) {
      showPrompt.value = true
    }
  }, 60 * 60 * 1000)
}

// 업데이트 사용 가능 이벤트 핸들러
const handleUpdateAvailable = () => {
  showUpdatePrompt.value = true
}

// 업데이트 적용
const applyUpdate = async () => {
  updating.value = true
  
  try {
    await pwaService.applyUpdate()
  } catch (error) {
    console.error('업데이트 적용 실패:', error)
  } finally {
    updating.value = false
    showUpdatePrompt.value = false
  }
}

// 업데이트 프롬프트 무시
const dismissUpdate = () => {
  showUpdatePrompt.value = false
}
</script>

<style scoped>
.pwa-install-prompt :deep(.v-snackbar__wrapper) {
  border-radius: 12px !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
}

.pwa-update-prompt :deep(.v-snackbar__wrapper) {
  border-radius: 12px !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
}

.network-status-alert :deep(.v-snackbar__wrapper) {
  border-radius: 8px !important;
}

/* 모바일 최적화 */
@media (max-width: 600px) {
  .pwa-install-prompt :deep(.v-snackbar__wrapper) {
    margin: 0 16px 16px 16px !important;
    border-radius: 8px !important;
  }
  
  .pwa-update-prompt :deep(.v-snackbar__wrapper) {
    margin: 0 16px 16px 16px !important;
    border-radius: 8px !important;
  }
}
</style>