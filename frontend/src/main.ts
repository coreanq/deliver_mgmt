import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { mdi } from 'vuetify/iconsets/mdi'
import '@mdi/font/css/materialdesignicons.css'

// Axios 기본 설정
import axios from 'axios'

// 에러 트래킹 시스템
import errorTracker from './services/ErrorTracker'

// PWA 서비스
import pwaService from './services/PWAService'

// PWA 스타일
import './styles/pwa.css'

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1976D2',
          secondary: '#424242',
          accent: '#82B1FF',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FFC107',
        },
      },
    },
  },
  icons: {
    defaultSet: 'mdi',
    sets: {
      mdi,
    },
  },
})

// Axios 기본 설정 - 환경변수에서 가져오기
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
axios.defaults.withCredentials = true

// Axios 인터셉터로 API 에러 추적
axios.interceptors.response.use(
  (response) => {
    // 성공 응답 로깅 (필요시)
    if (response.config.method !== 'get') {
      errorTracker.captureInfo(`API Success: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        api: true
      })
    }
    return response
  },
  (error) => {
    // API 에러 추적
    errorTracker.captureAPIError(error, error.config)
    return Promise.reject(error)
  }
)

console.log('API Base URL:', axios.defaults.baseURL)

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(vuetify)

// Vue 에러 핸들러 설정
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue Error:', err, info)
  errorTracker.captureError(err as Error, {
    vueErrorInfo: info,
    componentName: instance?.$?.type?.name || 'Unknown Component',
    source: 'vue'
  })
}

// Vue 경고 핸들러 설정
app.config.warnHandler = (msg, instance, trace) => {
  if (import.meta.env.DEV) {
    console.warn('Vue Warning:', msg, trace)
  }
  errorTracker.captureWarning(`Vue Warning: ${msg}`, {
    componentName: instance?.$?.type?.name || 'Unknown Component',
    trace,
    source: 'vue'
  })
}

// 앱 마운트 전 성능 측정
const mountStart = performance.now()
app.mount('#app')
const mountEnd = performance.now()

// 앱 마운트 성능 기록
errorTracker.capturePerformance('app-mount-time', mountEnd - mountStart, {
  environment: import.meta.env.MODE
})

// PWA 초기화 (앱 마운트 후)
console.log('[Main] PWA 서비스 초기화 시작...')
if (import.meta.env.PROD) {
  // 프로덕션 환경에서만 PWA 서비스 활성화
  console.log('[Main] PWA 서비스가 활성화되었습니다.')
} else {
  // 개발 환경에서도 PWA 기능 테스트를 위해 활성화
  console.log('[Main] PWA 서비스가 개발 모드에서 활성화되었습니다.')
}

// 페이지 로드 완료 후 성능 메트릭 수집
window.addEventListener('load', () => {
  if (performance.getEntriesByType) {
    const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    if (navigationEntries.length > 0) {
      const nav = navigationEntries[0]
      
      errorTracker.capturePerformance('page-load-time', nav.loadEventEnd - nav.navigationStart)
      errorTracker.capturePerformance('dom-content-loaded', nav.domContentLoadedEventEnd - nav.navigationStart)
      errorTracker.capturePerformance('first-paint', nav.responseEnd - nav.requestStart)
    }
  }
})