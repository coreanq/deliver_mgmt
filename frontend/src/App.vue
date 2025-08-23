<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-title>
        <v-icon icon="mdi-truck-delivery" class="me-2"></v-icon>
        배달 관리 시스템
      </v-app-bar-title>
      
      <v-spacer></v-spacer>
      
      <v-btn
        v-if="$route.path !== '/qr-scanner'"
        @click="$router.push('/qr-scanner')"
        variant="outlined"
        class="me-2"
      >
        <v-icon icon="mdi-qrcode-scan" class="me-1"></v-icon>
        QR 스캐너
      </v-btn>
      
      <v-btn
        v-if="$route.path !== '/admin'"
        @click="$router.push('/admin')"
        variant="outlined"
      >
        <v-icon icon="mdi-view-dashboard" class="me-1"></v-icon>
        관리자
      </v-btn>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>

    <!-- PWA 설치 프롬프트 -->
    <PWAInstallPrompt />
    
    <!-- 전역 스낵바 -->
    <v-snackbar
      v-model="globalSnackbar.show"
      :color="globalSnackbar.color"
      :timeout="globalSnackbar.timeout"
      location="top"
    >
      {{ globalSnackbar.message }}
      <template v-slot:actions>
        <v-btn
          icon="mdi-close"
          @click="globalSnackbar.show = false"
        ></v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import PWAInstallPrompt from '@/components/PWAInstallPrompt.vue'

const router = useRouter()

// 전역 스낵바
const globalSnackbar = reactive({
  show: false,
  message: '',
  color: 'info',
  timeout: 3000
})

// 전역 스낵바 표시 함수
const showSnackbar = (message: string, color: string = 'info', timeout: number = 3000) => {
  globalSnackbar.message = message
  globalSnackbar.color = color
  globalSnackbar.timeout = timeout
  globalSnackbar.show = true
}

// 전역으로 스낵바 함수 제공
window.showSnackbar = showSnackbar
</script>

<style>
/* 전역 스타일 */
.v-application {
  font-family: 'Roboto', sans-serif !important;
}

.v-main {
  background-color: #f5f5f5;
}

/* 스크롤바 스타일 */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 반응형 텍스트 */
@media (max-width: 600px) {
  .v-app-bar-title {
    font-size: 1.1rem !important;
  }
}
</style>