<template>
  <div>
    <!-- 시스템 정보 -->
    <v-card class="mb-6">
      <v-card-title>
        <v-icon class="me-2">mdi-information</v-icon>
        시스템 정보
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <div class="mb-4">
              <strong>시스템 버전:</strong> v1.0.0
            </div>
            <div class="mb-4">
              <strong>빌드 날짜:</strong> {{ new Date().toLocaleDateString('ko-KR') }}
            </div>
            <div class="mb-4">
              <strong>환경:</strong> {{ environment }}
            </div>
          </v-col>
          <v-col cols="12" md="6">
            <div class="mb-4">
              <strong>서버 상태:</strong> 
              <v-chip color="success" size="small">정상</v-chip>
            </div>
            <div class="mb-4">
              <strong>데이터베이스:</strong> Google Sheets
            </div>
            <div class="mb-4">
              <strong>백업 상태:</strong> 자동 백업 활성
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- 일반 설정 -->
    <v-card class="mb-6">
      <v-card-title>
        <v-icon class="me-2">mdi-cog</v-icon>
        일반 설정
      </v-card-title>
      <v-card-text>
        <v-form ref="generalForm">
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="settings.systemName"
                label="시스템 이름"
                placeholder="배달 관리 시스템"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="settings.timezone"
                :items="timezoneOptions"
                label="시간대"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="settings.language"
                :items="languageOptions"
                label="언어"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="settings.dateFormat"
                :items="dateFormatOptions"
                label="날짜 형식"
              />
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
    </v-card>

    <!-- 알림 설정 -->
    <v-card class="mb-6">
      <v-card-title>
        <v-icon class="me-2">mdi-bell</v-icon>
        알림 설정
      </v-card-title>
      <v-card-text>
        <v-form ref="notificationForm">
          <v-switch
            v-model="settings.notifications.email"
            label="이메일 알림"
            color="primary"
            hint="중요한 이벤트 발생시 이메일로 알림"
            persistent-hint
          />
          
          <v-switch
            v-model="settings.notifications.sms"
            label="SMS 알림"
            color="primary"
            hint="긴급 상황시 SMS로 알림"
            persistent-hint
            class="mt-4"
          />

          <v-switch
            v-model="settings.notifications.deliveryComplete"
            label="배달 완료 알림"
            color="primary"
            hint="배달 완료시 자동 알림 발송"
            persistent-hint
            class="mt-4"
          />

          <v-text-field
            v-model="settings.notifications.adminEmail"
            label="관리자 이메일"
            type="email"
            hint="알림을 받을 관리자 이메일 주소"
            persistent-hint
            class="mt-4"
          />
        </v-form>
      </v-card-text>
    </v-card>

    <!-- 보안 설정 -->
    <v-card class="mb-6">
      <v-card-title>
        <v-icon class="me-2">mdi-shield</v-icon>
        보안 설정
      </v-card-title>
      <v-card-text>
        <v-form ref="securityForm">
          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="settings.security.sessionTimeout"
                :items="sessionTimeoutOptions"
                label="세션 만료 시간"
                suffix="분"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="settings.security.qrCodeExpiry"
                :items="qrExpiryOptions"
                label="QR 코드 유효 기간"
                suffix="일"
              />
            </v-col>
          </v-row>

          <v-switch
            v-model="settings.security.twoFactor"
            label="2단계 인증 활성화"
            color="primary"
            hint="로그인시 추가 인증 단계 요구"
            persistent-hint
            class="mt-4"
          />

          <v-switch
            v-model="settings.security.auditLog"
            label="감사 로그 활성화"
            color="primary"
            hint="모든 중요한 작업 로그 기록"
            persistent-hint
            class="mt-4"
          />

          <v-switch
            v-model="settings.security.ipRestriction"
            label="IP 제한 활성화"
            color="primary"
            hint="특정 IP에서만 접근 허용"
            persistent-hint
            class="mt-4"
          />

          <v-textarea
            v-if="settings.security.ipRestriction"
            v-model="settings.security.allowedIPs"
            label="허용된 IP 주소"
            placeholder="192.168.1.1&#10;10.0.0.1"
            rows="3"
            hint="줄바꿈으로 구분하여 여러 IP 입력"
            persistent-hint
            class="mt-4"
          />
        </v-form>
      </v-card-text>
    </v-card>

    <!-- 백업 및 복구 -->
    <v-card class="mb-6">
      <v-card-title>
        <v-icon class="me-2">mdi-backup-restore</v-icon>
        백업 및 복구
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <div class="mb-4">
              <strong>자동 백업:</strong> 매일 오전 3시
            </div>
            <div class="mb-4">
              <strong>마지막 백업:</strong> {{ lastBackupDate }}
            </div>
            <div class="mb-4">
              <strong>백업 보관 기간:</strong> 30일
            </div>
          </v-col>
          <v-col cols="12" md="6">
            <div class="d-flex flex-column gap-2">
              <v-btn
                color="primary"
                @click="createBackup"
                :loading="backupLoading"
              >
                <v-icon start>mdi-content-save</v-icon>
                수동 백업 생성
              </v-btn>
              
              <v-btn
                color="info"
                @click="downloadBackup"
                :loading="downloadLoading"
              >
                <v-icon start>mdi-download</v-icon>
                백업 파일 다운로드
              </v-btn>

              <v-btn
                color="warning"
                @click="showRestoreDialog = true"
              >
                <v-icon start>mdi-restore</v-icon>
                백업에서 복구
              </v-btn>
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- 시스템 작업 -->
    <v-card class="mb-6">
      <v-card-title>
        <v-icon class="me-2">mdi-tools</v-icon>
        시스템 작업
      </v-card-title>
      <v-card-text>
        <div class="d-flex flex-wrap gap-2">
          <v-btn
            color="info"
            @click="clearCache"
            :loading="cacheLoading"
          >
            <v-icon start>mdi-cached</v-icon>
            캐시 정리
          </v-btn>

          <v-btn
            color="warning"
            @click="runDiagnostic"
            :loading="diagnosticLoading"
          >
            <v-icon start>mdi-medical-bag</v-icon>
            시스템 진단
          </v-btn>

          <v-btn
            color="success"
            @click="testConnections"
            :loading="testLoading"
          >
            <v-icon start>mdi-connection</v-icon>
            연결 테스트
          </v-btn>

          <v-btn
            color="error"
            @click="showResetDialog = true"
          >
            <v-icon start>mdi-restart</v-icon>
            시스템 초기화
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- 설정 저장 버튼 -->
    <div class="text-center">
      <v-btn
        color="primary"
        size="large"
        @click="saveSettings"
        :loading="saveLoading"
      >
        <v-icon start>mdi-content-save</v-icon>
        설정 저장
      </v-btn>
    </div>

    <!-- 복구 다이얼로그 -->
    <v-dialog v-model="showRestoreDialog" max-width="500">
      <v-card>
        <v-card-title>백업에서 복구</v-card-title>
        <v-card-text>
          <v-alert type="warning" class="mb-4">
            복구를 진행하면 현재 데이터가 모두 삭제됩니다. 신중히 선택하세요.
          </v-alert>
          
          <v-file-input
            v-model="restoreFile"
            label="백업 파일 선택"
            accept=".json,.zip"
            prepend-icon="mdi-file"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showRestoreDialog = false">취소</v-btn>
          <v-btn
            color="warning"
            @click="restoreFromBackup"
            :loading="restoreLoading"
            :disabled="!restoreFile"
          >
            복구 실행
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 시스템 초기화 다이얼로그 -->
    <v-dialog v-model="showResetDialog" max-width="500">
      <v-card>
        <v-card-title>시스템 초기화</v-card-title>
        <v-card-text>
          <v-alert type="error" class="mb-4">
            <strong>경고!</strong> 이 작업은 되돌릴 수 없습니다.
            모든 데이터가 삭제되고 시스템이 초기 상태로 되돌아갑니다.
          </v-alert>
          
          <v-text-field
            v-model="resetConfirmText"
            label="확인을 위해 'RESET'을 입력하세요"
            placeholder="RESET"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showResetDialog = false">취소</v-btn>
          <v-btn
            color="error"
            @click="resetSystem"
            :loading="resetLoading"
            :disabled="resetConfirmText !== 'RESET'"
          >
            초기화 실행
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 알림 스낵바 -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color">
      {{ snackbar.message }}
      <template v-slot:actions>
        <v-btn icon="mdi-close" @click="snackbar.show = false" />
      </template>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'

// 반응형 데이터
const saveLoading = ref(false)
const backupLoading = ref(false)
const downloadLoading = ref(false)
const restoreLoading = ref(false)
const resetLoading = ref(false)
const cacheLoading = ref(false)
const diagnosticLoading = ref(false)
const testLoading = ref(false)

const showRestoreDialog = ref(false)
const showResetDialog = ref(false)
const restoreFile = ref(null)
const resetConfirmText = ref('')

const settings = ref({
  systemName: '배달 관리 시스템',
  timezone: 'Asia/Seoul',
  language: 'ko',
  dateFormat: 'YYYY-MM-DD',
  notifications: {
    email: true,
    sms: false,
    deliveryComplete: true,
    adminEmail: ''
  },
  security: {
    sessionTimeout: 120,
    qrCodeExpiry: 7,
    twoFactor: false,
    auditLog: true,
    ipRestriction: false,
    allowedIPs: ''
  }
})

const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

// 옵션들
const timezoneOptions = [
  { title: '서울 (Asia/Seoul)', value: 'Asia/Seoul' },
  { title: '도쿄 (Asia/Tokyo)', value: 'Asia/Tokyo' },
  { title: 'UTC', value: 'UTC' }
]

const languageOptions = [
  { title: '한국어', value: 'ko' },
  { title: 'English', value: 'en' }
]

const dateFormatOptions = [
  { title: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
  { title: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
  { title: 'DD/MM/YYYY', value: 'DD/MM/YYYY' }
]

const sessionTimeoutOptions = [
  { title: '30분', value: 30 },
  { title: '1시간', value: 60 },
  { title: '2시간', value: 120 },
  { title: '4시간', value: 240 }
]

const qrExpiryOptions = [
  { title: '1일', value: 1 },
  { title: '3일', value: 3 },
  { title: '7일', value: 7 },
  { title: '30일', value: 30 }
]

// 계산된 속성
const environment = computed(() => {
  return import.meta.env.NODE_ENV || 'development'
})

const lastBackupDate = computed(() => {
  return new Date().toLocaleString('ko-KR')
})

// 컴포넌트 마운트
onMounted(async () => {
  await loadSettings()
})

// 설정 로드
const loadSettings = async () => {
  try {
    const response = await axios.get('/api/admin/system-settings')
    if (response.data) {
      settings.value = { ...settings.value, ...response.data }
    }
  } catch (error) {
    console.error('설정 로드 실패:', error)
  }
}

// 설정 저장
const saveSettings = async () => {
  try {
    saveLoading.value = true
    await axios.post('/api/admin/system-settings', settings.value)
    showSnackbar('설정이 저장되었습니다.', 'success')
  } catch (error) {
    showSnackbar('설정 저장에 실패했습니다.', 'error')
    console.error('설정 저장 실패:', error)
  } finally {
    saveLoading.value = false
  }
}

// 백업 생성
const createBackup = async () => {
  try {
    backupLoading.value = true
    await axios.post('/api/admin/backup')
    showSnackbar('백업이 성공적으로 생성되었습니다.', 'success')
  } catch (error) {
    showSnackbar('백업 생성에 실패했습니다.', 'error')
    console.error('백업 생성 실패:', error)
  } finally {
    backupLoading.value = false
  }
}

// 백업 다운로드
const downloadBackup = async () => {
  try {
    downloadLoading.value = true
    const response = await axios.get('/api/admin/backup/download', {
      responseType: 'blob'
    })
    
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = `backup_${new Date().toISOString().split('T')[0]}.json`
    link.click()
    
    showSnackbar('백업 파일이 다운로드되었습니다.', 'success')
  } catch (error) {
    showSnackbar('백업 다운로드에 실패했습니다.', 'error')
    console.error('백업 다운로드 실패:', error)
  } finally {
    downloadLoading.value = false
  }
}

// 백업에서 복구
const restoreFromBackup = async () => {
  if (!restoreFile.value) return

  try {
    restoreLoading.value = true
    const formData = new FormData()
    formData.append('backup', restoreFile.value)
    
    await axios.post('/api/admin/restore', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    
    showSnackbar('백업에서 성공적으로 복구되었습니다.', 'success')
    showRestoreDialog.value = false
    restoreFile.value = null
    
    // 페이지 새로고침
    setTimeout(() => {
      window.location.reload()
    }, 2000)
  } catch (error) {
    showSnackbar('복구에 실패했습니다.', 'error')
    console.error('복구 실패:', error)
  } finally {
    restoreLoading.value = false
  }
}

// 캐시 정리
const clearCache = async () => {
  try {
    cacheLoading.value = true
    await axios.post('/api/admin/cache/clear')
    showSnackbar('캐시가 정리되었습니다.', 'success')
  } catch (error) {
    showSnackbar('캐시 정리에 실패했습니다.', 'error')
    console.error('캐시 정리 실패:', error)
  } finally {
    cacheLoading.value = false
  }
}

// 시스템 진단
const runDiagnostic = async () => {
  try {
    diagnosticLoading.value = true
    const response = await axios.post('/api/admin/diagnostic')
    
    const issues = response.data.issues || []
    if (issues.length === 0) {
      showSnackbar('시스템이 정상 상태입니다.', 'success')
    } else {
      showSnackbar(`${issues.length}개의 문제가 발견되었습니다.`, 'warning')
    }
  } catch (error) {
    showSnackbar('시스템 진단에 실패했습니다.', 'error')
    console.error('시스템 진단 실패:', error)
  } finally {
    diagnosticLoading.value = false
  }
}

// 연결 테스트
const testConnections = async () => {
  try {
    testLoading.value = true
    const response = await axios.post('/api/admin/test-connections')
    
    const results = response.data
    const successCount = Object.values(results).filter(Boolean).length
    const totalCount = Object.keys(results).length
    
    showSnackbar(`${successCount}/${totalCount} 연결이 정상입니다.`, 'success')
  } catch (error) {
    showSnackbar('연결 테스트에 실패했습니다.', 'error')
    console.error('연결 테스트 실패:', error)
  } finally {
    testLoading.value = false
  }
}

// 시스템 초기화
const resetSystem = async () => {
  if (resetConfirmText.value !== 'RESET') return

  try {
    resetLoading.value = true
    await axios.post('/api/admin/reset')
    
    showSnackbar('시스템이 초기화되었습니다. 잠시 후 로그인 페이지로 이동합니다.', 'success')
    showResetDialog.value = false
    resetConfirmText.value = ''
    
    // 로그인 페이지로 리다이렉트
    setTimeout(() => {
      window.location.href = '/'
    }, 3000)
  } catch (error) {
    showSnackbar('시스템 초기화에 실패했습니다.', 'error')
    console.error('시스템 초기화 실패:', error)
  } finally {
    resetLoading.value = false
  }
}

// 유틸리티 함수
const showSnackbar = (message: string, color: string = 'success') => {
  snackbar.value = {
    show: true,
    message,
    color
  }
}
</script>

<style scoped>
.gap-2 {
  gap: 8px;
}
</style>