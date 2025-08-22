<template>
  <v-card>
    <v-card-title class="d-flex justify-space-between align-center">
      <div>
        <v-icon class="me-2">mdi-message-text</v-icon>
        SOLAPI 카카오톡 연동
      </div>
      <v-chip
        :color="connectionStatus === 'connected' ? 'success' : 'error'"
        size="small"
      >
        {{ getConnectionStatusText(connectionStatus) }}
      </v-chip>
    </v-card-title>

    <v-card-text>
      <!-- 연결 상태 섹션 -->
      <v-row class="mb-6">
        <v-col cols="12" md="6">
          <v-card variant="outlined">
            <v-card-title class="text-h6">연결 상태</v-card-title>
            <v-card-text>
              <div v-if="connectionStatus === 'disconnected'">
                <v-alert type="info" variant="tonal" class="mb-4">
                  <div class="d-flex align-center">
                    <v-icon class="me-2">mdi-information</v-icon>
                    SOLAPI 연동을 위해 먼저 인증하세요
                  </div>
                </v-alert>
                
                <v-btn
                  color="primary"
                  @click="authenticateSolapi"
                  :loading="authLoading"
                  block
                >
                  <v-icon start>mdi-login</v-icon>
                  SOLAPI 계정 연결
                </v-btn>
              </div>

              <div v-else-if="connectionStatus === 'connected'">
                <v-alert type="success" variant="tonal" class="mb-4">
                  <div class="d-flex align-center">
                    <v-icon class="me-2">mdi-check-circle</v-icon>
                    SOLAPI가 성공적으로 연결되었습니다
                  </div>
                </v-alert>

                <div class="connection-info" v-if="accountInfo">
                  <div class="mb-2">
                    <strong>계정 ID:</strong> {{ accountInfo.accountId }}
                  </div>
                  <div class="mb-2">
                    <strong>계정명:</strong> {{ accountInfo.accountName }}
                  </div>
                  <div class="mb-2">
                    <strong>잔액:</strong> {{ formatCurrency(accountInfo.balance) }}원
                  </div>
                  <div class="mb-2">
                    <strong>연결일:</strong> {{ formatDateTime(accountInfo.connectedAt) }}
                  </div>
                </div>

                <v-divider class="my-3" />

                <div class="d-flex gap-2">
                  <v-btn
                    size="small"
                    color="info"
                    @click="refreshAccountInfo"
                    :loading="refreshLoading"
                  >
                    <v-icon start>mdi-refresh</v-icon>
                    정보 새로고침
                  </v-btn>
                  <v-btn
                    size="small"
                    color="warning"
                    @click="disconnectSolapi"
                    :loading="disconnectLoading"
                  >
                    <v-icon start>mdi-logout</v-icon>
                    연결 해제
                  </v-btn>
                </div>
              </div>

              <div v-else>
                <v-alert type="warning" variant="tonal">
                  <div class="d-flex align-center">
                    <v-icon class="me-2">mdi-alert</v-icon>
                    연결 상태를 확인 중입니다...
                  </div>
                </v-alert>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card variant="outlined">
            <v-card-title class="text-h6">메시지 설정</v-card-title>
            <v-card-text>
              <v-form ref="messageForm">
                <v-text-field
                  v-model="messageSettings.senderPhone"
                  label="발신번호"
                  placeholder="01012345678"
                  :rules="phoneRules"
                  hint="카카오톡 메시지 발신에 사용할 번호"
                  persistent-hint
                />

                <v-textarea
                  v-model="messageSettings.completionTemplate"
                  label="배달 완료 메시지 템플릿"
                  placeholder="{customerName}님, 주문하신 상품이 배달 완료되었습니다. 감사합니다!"
                  rows="3"
                  class="mt-4"
                  hint="{customerName}, {orderTime}, {deliveryTime} 변수를 사용할 수 있습니다"
                  persistent-hint
                />

                <v-switch
                  v-model="messageSettings.autoSend"
                  label="배달 완료시 자동 발송"
                  color="primary"
                  class="mt-4"
                />

                <v-btn
                  color="primary"
                  @click="saveMessageSettings"
                  :loading="saveSettingsLoading"
                  class="mt-4"
                >
                  <v-icon start>mdi-content-save</v-icon>
                  설정 저장
                </v-btn>
              </v-form>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 메시지 테스트 섹션 -->
      <v-card variant="outlined" class="mb-6" v-if="connectionStatus === 'connected'">
        <v-card-title>메시지 테스트</v-card-title>
        <v-card-text>
          <v-form ref="testForm">
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="testMessage.recipientPhone"
                  label="수신번호"
                  placeholder="01012345678"
                  :rules="phoneRules"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="testMessage.customerName"
                  label="고객명 (테스트용)"
                  placeholder="홍길동"
                />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="testMessage.message"
                  label="테스트 메시지"
                  :placeholder="messagePreview"
                  rows="3"
                />
              </v-col>
              <v-col cols="12">
                <div class="d-flex gap-2">
                  <v-btn
                    color="info"
                    @click="generatePreview"
                    :disabled="!testMessage.customerName"
                  >
                    <v-icon start>mdi-eye</v-icon>
                    미리보기 생성
                  </v-btn>
                  <v-btn
                    color="success"
                    @click="sendTestMessage"
                    :loading="testSendLoading"
                    :disabled="!testMessage.recipientPhone || !testMessage.message"
                  >
                    <v-icon start>mdi-send</v-icon>
                    테스트 발송
                  </v-btn>
                </div>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
      </v-card>

      <!-- 발송 내역 섹션 -->
      <v-card variant="outlined" v-if="connectionStatus === 'connected'">
        <v-card-title class="d-flex justify-space-between align-center">
          최근 발송 내역
          <v-btn
            size="small"
            color="primary"
            @click="loadSendHistory"
            :loading="historyLoading"
          >
            <v-icon start>mdi-refresh</v-icon>
            새로고침
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-data-table
            :headers="historyHeaders"
            :items="sendHistory"
            :loading="historyLoading"
            class="elevation-0"
          >
            <template v-slot:item.recipientPhone="{ item }">
              {{ formatPhoneNumber(item.recipientPhone) }}
            </template>

            <template v-slot:item.status="{ item }">
              <v-chip
                :color="getMessageStatusColor(item.status)"
                size="small"
              >
                {{ getMessageStatusText(item.status) }}
              </v-chip>
            </template>

            <template v-slot:item.message="{ item }">
              <div class="message-preview">
                {{ item.message.length > 50 ? item.message.substring(0, 50) + '...' : item.message }}
              </div>
            </template>

            <template v-slot:item.sentAt="{ item }">
              {{ formatDateTime(item.sentAt) }}
            </template>

            <template v-slot:item.cost="{ item }">
              {{ item.cost ? formatCurrency(item.cost) + '원' : '-' }}
            </template>

            <template v-slot:item.actions="{ item }">
              <v-btn
                icon
                size="small"
                @click="viewMessageDetail(item)"
                title="상세보기"
              >
                <v-icon>mdi-eye</v-icon>
              </v-btn>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
    </v-card-text>

    <!-- 메시지 상세 다이얼로그 -->
    <v-dialog v-model="messageDetailDialog" max-width="500">
      <v-card v-if="selectedMessage">
        <v-card-title>메시지 상세 정보</v-card-title>
        
        <v-card-text>
          <div class="message-detail">
            <div class="mb-3">
              <strong>수신번호:</strong> {{ formatPhoneNumber(selectedMessage.recipientPhone) }}
            </div>
            <div class="mb-3">
              <strong>발송일시:</strong> {{ formatDateTime(selectedMessage.sentAt) }}
            </div>
            <div class="mb-3">
              <strong>상태:</strong>
              <v-chip
                :color="getMessageStatusColor(selectedMessage.status)"
                size="small"
                class="ml-2"
              >
                {{ getMessageStatusText(selectedMessage.status) }}
              </v-chip>
            </div>
            <div class="mb-3">
              <strong>비용:</strong> {{ selectedMessage.cost ? formatCurrency(selectedMessage.cost) + '원' : '무료' }}
            </div>
            <div class="mb-3">
              <strong>메시지 내용:</strong>
              <v-card variant="outlined" class="mt-2 pa-3">
                <pre class="text-body-2">{{ selectedMessage.message }}</pre>
              </v-card>
            </div>
            <div v-if="selectedMessage.errorMessage" class="mb-3">
              <strong>오류 메시지:</strong>
              <v-alert type="error" variant="tonal" class="mt-2">
                {{ selectedMessage.errorMessage }}
              </v-alert>
            </div>
          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="messageDetailDialog = false">닫기</v-btn>
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
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'

interface AccountInfo {
  accountId: string
  accountName: string
  balance: number
  connectedAt: string
}

interface MessageHistory {
  id: string
  recipientPhone: string
  message: string
  status: 'sent' | 'failed' | 'pending'
  sentAt: string
  cost?: number
  errorMessage?: string
}

// 반응형 데이터
const connectionStatus = ref<'connected' | 'disconnected' | 'checking'>('checking')
const authLoading = ref(false)
const refreshLoading = ref(false)
const disconnectLoading = ref(false)
const saveSettingsLoading = ref(false)
const testSendLoading = ref(false)
const historyLoading = ref(false)

const accountInfo = ref<AccountInfo | null>(null)
const sendHistory = ref<MessageHistory[]>([])
const selectedMessage = ref<MessageHistory | null>(null)

const messageDetailDialog = ref(false)

// 메시지 설정
const messageSettings = ref({
  senderPhone: '',
  completionTemplate: '{customerName}님, 주문하신 상품이 배달 완료되었습니다. 감사합니다!',
  autoSend: true
})

// 테스트 메시지
const testMessage = ref({
  recipientPhone: '',
  customerName: '',
  message: ''
})

const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

// 테이블 헤더
const historyHeaders = [
  { title: '수신번호', key: 'recipientPhone', sortable: false },
  { title: '메시지', key: 'message', sortable: false },
  { title: '상태', key: 'status', sortable: true },
  { title: '발송일시', key: 'sentAt', sortable: true },
  { title: '비용', key: 'cost', sortable: false },
  { title: '작업', key: 'actions', sortable: false }
]

// 유효성 검사 규칙
const phoneRules = [
  (v: string) => !v || /^01[0-9]\d{3,4}\d{4}$/.test(v.replace(/[^0-9]/g, '')) || '올바른 전화번호 형식이 아닙니다'
]

// 계산된 속성
const messagePreview = computed(() => {
  if (!testMessage.value.customerName) return ''
  
  const now = new Date()
  return messageSettings.value.completionTemplate
    .replace('{customerName}', testMessage.value.customerName)
    .replace('{orderTime}', now.toLocaleString('ko-KR'))
    .replace('{deliveryTime}', now.toLocaleString('ko-KR'))
})

// 컴포넌트 마운트
onMounted(async () => {
  await checkConnectionStatus()
  await loadMessageSettings()
  if (connectionStatus.value === 'connected') {
    await loadSendHistory()
  }
})

// 연결 상태 확인
const checkConnectionStatus = async () => {
  try {
    const response = await axios.get('/api/solapi/status')
    
    if (response.data.connected) {
      connectionStatus.value = 'connected'
      accountInfo.value = response.data.accountInfo
    } else {
      connectionStatus.value = 'disconnected'
    }
  } catch (error: any) {
    console.error('SOLAPI 상태 확인 실패:', error)
    connectionStatus.value = 'disconnected'
  }
}

// SOLAPI 인증
const authenticateSolapi = async () => {
  try {
    authLoading.value = true
    const response = await axios.get('/api/solapi/auth-url')
    window.location.href = response.data.authUrl
  } catch (error: any) {
    showSnackbar('SOLAPI 인증 URL 생성에 실패했습니다.', 'error')
    console.error('SOLAPI 인증 실패:', error)
  } finally {
    authLoading.value = false
  }
}

// 계정 정보 새로고침
const refreshAccountInfo = async () => {
  try {
    refreshLoading.value = true
    const response = await axios.get('/api/solapi/account')
    accountInfo.value = response.data
    showSnackbar('계정 정보가 새로고침되었습니다.', 'success')
  } catch (error: any) {
    showSnackbar('계정 정보 새로고침에 실패했습니다.', 'error')
    console.error('계정 정보 새로고침 실패:', error)
  } finally {
    refreshLoading.value = false
  }
}

// SOLAPI 연결 해제
const disconnectSolapi = async () => {
  if (!confirm('SOLAPI 연결을 해제하시겠습니까?')) return

  try {
    disconnectLoading.value = true
    await axios.post('/api/solapi/disconnect')
    
    connectionStatus.value = 'disconnected'
    accountInfo.value = null
    showSnackbar('SOLAPI 연결이 해제되었습니다.', 'success')
  } catch (error: any) {
    showSnackbar('SOLAPI 연결 해제에 실패했습니다.', 'error')
    console.error('SOLAPI 연결 해제 실패:', error)
  } finally {
    disconnectLoading.value = false
  }
}

// 메시지 설정 로드
const loadMessageSettings = async () => {
  try {
    const response = await axios.get('/api/solapi/settings')
    if (response.data) {
      messageSettings.value = { ...messageSettings.value, ...response.data }
    }
  } catch (error: any) {
    console.error('메시지 설정 로드 실패:', error)
  }
}

// 메시지 설정 저장
const saveMessageSettings = async () => {
  try {
    saveSettingsLoading.value = true
    await axios.post('/api/solapi/settings', messageSettings.value)
    showSnackbar('메시지 설정이 저장되었습니다.', 'success')
  } catch (error: any) {
    showSnackbar('메시지 설정 저장에 실패했습니다.', 'error')
    console.error('메시지 설정 저장 실패:', error)
  } finally {
    saveSettingsLoading.value = false
  }
}

// 미리보기 생성
const generatePreview = () => {
  testMessage.value.message = messagePreview.value
}

// 테스트 메시지 발송
const sendTestMessage = async () => {
  try {
    testSendLoading.value = true
    
    const response = await axios.post('/api/solapi/send', {
      to: testMessage.value.recipientPhone.replace(/[^0-9]/g, ''),
      message: testMessage.value.message,
      from: messageSettings.value.senderPhone.replace(/[^0-9]/g, '')
    })
    
    showSnackbar('테스트 메시지가 발송되었습니다.', 'success')
    
    // 발송 내역 새로고침
    await loadSendHistory()
    
  } catch (error: any) {
    showSnackbar('테스트 메시지 발송에 실패했습니다.', 'error')
    console.error('테스트 메시지 발송 실패:', error)
  } finally {
    testSendLoading.value = false
  }
}

// 발송 내역 로드
const loadSendHistory = async () => {
  try {
    historyLoading.value = true
    const response = await axios.get('/api/solapi/history')
    sendHistory.value = response.data
  } catch (error: any) {
    showSnackbar('발송 내역을 불러오는데 실패했습니다.', 'error')
    console.error('발송 내역 로드 실패:', error)
  } finally {
    historyLoading.value = false
  }
}

// 메시지 상세보기
const viewMessageDetail = (message: MessageHistory) => {
  selectedMessage.value = message
  messageDetailDialog.value = true
}

// 유틸리티 함수들
const formatPhoneNumber = (phone: string) => {
  const cleaned = phone.replace(/[^0-9]/g, '')
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  }
  return phone
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ko-KR').format(amount)
}

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString('ko-KR')
}

const getConnectionStatusText = (status: string) => {
  switch (status) {
    case 'connected': return '연결됨'
    case 'disconnected': return '연결 해제'
    case 'checking': return '확인 중'
    default: return '알 수 없음'
  }
}

const getMessageStatusColor = (status: string) => {
  switch (status) {
    case 'sent': return 'success'
    case 'failed': return 'error'
    case 'pending': return 'warning'
    default: return 'grey'
  }
}

const getMessageStatusText = (status: string) => {
  switch (status) {
    case 'sent': return '발송완료'
    case 'failed': return '발송실패'
    case 'pending': return '발송대기'
    default: return '알 수 없음'
  }
}

const showSnackbar = (message: string, color: string = 'success') => {
  snackbar.value = {
    show: true,
    message,
    color
  }
}
</script>

<style scoped>
.connection-info {
  font-size: 0.9em;
}

.message-preview {
  max-width: 200px;
  word-break: break-word;
}

.message-detail pre {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>