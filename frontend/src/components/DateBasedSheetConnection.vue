<template>
  <v-card>
    <v-card-title class="d-flex justify-space-between align-center">
      <div>
        <v-icon class="me-2">mdi-calendar-clock</v-icon>
        날짜별 스프레드시트 연결
      </div>
      <v-btn color="primary" @click="openConnectionDialog">
        <v-icon start>mdi-plus</v-icon>
        새 연결 추가
      </v-btn>
    </v-card-title>

    <v-card-text>
      <!-- 달력 및 연결 상태 -->
      <v-row>
        <!-- 달력 -->
        <v-col cols="12" md="6">
          <v-card variant="outlined">
            <v-card-title class="text-h6">연결 달력</v-card-title>
            <v-card-text>
              <v-date-picker
                v-model="selectedDate"
                color="primary"
                @update:model-value="onDateSelect"
                :attributes="calendarAttributes"
                full-width
                show-adjacent-months
              />
            </v-card-text>
          </v-card>
        </v-col>

        <!-- 연결 정보 -->
        <v-col cols="12" md="6">
          <v-card variant="outlined">
            <v-card-title class="text-h6">
              {{ selectedDate ? formatDate(selectedDate) : '날짜를 선택하세요' }}
            </v-card-title>
            <v-card-text>
              <div v-if="selectedDateConnection" class="mb-4">
                <v-alert
                  :type="selectedDateConnection.status === 'connected' ? 'success' : 'warning'"
                  variant="tonal"
                  class="mb-3"
                >
                  <div class="d-flex align-center">
                    <v-icon class="me-2">
                      {{ selectedDateConnection.status === 'connected' ? 'mdi-check-circle' : 'mdi-alert' }}
                    </v-icon>
                    {{ getConnectionStatusText(selectedDateConnection.status) }}
                  </div>
                </v-alert>

                <div class="connection-details">
                  <div class="mb-2">
                    <strong>스프레드시트:</strong> {{ selectedDateConnection.spreadsheetName }}
                  </div>
                  <div class="mb-2">
                    <strong>연결일:</strong> {{ formatDateTime(selectedDateConnection.createdAt) }}
                  </div>
                  <div class="mb-2">
                    <strong>마지막 접근:</strong> 
                    {{ selectedDateConnection.lastAccessed ? formatDateTime(selectedDateConnection.lastAccessed) : '없음' }}
                  </div>
                  
                  <v-divider class="my-3" />
                  
                  <div class="d-flex gap-2">
                    <v-btn
                      size="small"
                      color="primary"
                      @click="testConnection(selectedDateConnection)"
                      :loading="selectedDateConnection.testing"
                    >
                      <v-icon start>mdi-connection</v-icon>
                      연결 테스트
                    </v-btn>
                    <v-btn
                      size="small"
                      color="info"
                      @click="openInNewTab(selectedDateConnection.webViewLink)"
                      v-if="selectedDateConnection.webViewLink"
                    >
                      <v-icon start>mdi-open-in-new</v-icon>
                      시트 열기
                    </v-btn>
                    <v-btn
                      size="small"
                      color="warning"
                      @click="editConnection(selectedDateConnection)"
                    >
                      <v-icon start>mdi-pencil</v-icon>
                      수정
                    </v-btn>
                    <v-btn
                      size="small"
                      color="error"
                      @click="removeConnection(selectedDateConnection)"
                    >
                      <v-icon start>mdi-delete</v-icon>
                      제거
                    </v-btn>
                  </div>
                </div>
              </div>

              <v-alert v-else type="info" variant="tonal">
                <div class="text-center">
                  <v-icon class="mb-2">mdi-calendar-plus</v-icon>
                  <div>이 날짜에는 연결된 스프레드시트가 없습니다</div>
                  <v-btn
                    color="primary"
                    class="mt-2"
                    @click="openConnectionDialog"
                  >
                    연결 추가
                  </v-btn>
                </div>
              </v-alert>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 최근 연결 목록 -->
      <v-card variant="outlined" class="mt-6">
        <v-card-title>최근 연결 목록</v-card-title>
        <v-card-text>
          <v-data-table
            :headers="connectionHeaders"
            :items="recentConnections"
            :loading="loading"
            class="elevation-0"
          >
            <template v-slot:item.date="{ item }">
              <v-chip color="primary" size="small">
                {{ formatDate(item.date) }}
              </v-chip>
            </template>

            <template v-slot:item.status="{ item }">
              <v-chip
                :color="item.status === 'connected' ? 'success' : 'warning'"
                size="small"
              >
                {{ getConnectionStatusText(item.status) }}
              </v-chip>
            </template>

            <template v-slot:item.spreadsheetName="{ item }">
              <div class="d-flex align-center">
                <v-icon class="me-2" color="green">mdi-file-table</v-icon>
                <div>
                  <div class="font-weight-medium">{{ item.spreadsheetName }}</div>
                  <div class="text-caption text-grey">{{ item.spreadsheetId }}</div>
                </div>
              </div>
            </template>

            <template v-slot:item.lastAccessed="{ item }">
              <div v-if="item.lastAccessed" class="text-caption">
                {{ formatDateTime(item.lastAccessed) }}
              </div>
              <span v-else class="text-grey">-</span>
            </template>

            <template v-slot:item.actions="{ item }">
              <div class="d-flex gap-1">
                <v-btn
                  icon
                  size="small"
                  @click="testConnection(item)"
                  :loading="item.testing"
                  title="연결 테스트"
                >
                  <v-icon>mdi-connection</v-icon>
                </v-btn>
                <v-btn
                  icon
                  size="small"
                  @click="editConnection(item)"
                  title="연결 수정"
                >
                  <v-icon>mdi-pencil</v-icon>
                </v-btn>
                <v-btn
                  icon
                  size="small"
                  @click="removeConnection(item)"
                  color="error"
                  title="연결 제거"
                >
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </div>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
    </v-card-text>

    <!-- 연결 추가/수정 다이얼로그 -->
    <v-dialog v-model="connectionDialog" max-width="600">
      <v-card>
        <v-card-title>
          {{ editMode ? '스프레드시트 연결 수정' : '새 스프레드시트 연결' }}
        </v-card-title>
        
        <v-card-text>
          <v-form ref="connectionForm" v-model="formValid">
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="connectionForm.date"
                  label="날짜 *"
                  type="date"
                  :rules="dateRules"
                  required
                />
              </v-col>
              
              <v-col cols="12">
                <v-text-field
                  v-model="connectionForm.spreadsheetUrl"
                  label="스프레드시트 URL *"
                  :rules="urlRules"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  required
                />
                <div class="text-caption mt-1">
                  Google Sheets의 공유 링크를 입력하세요
                </div>
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="connectionForm.description"
                  label="설명"
                  placeholder="예: 2025년 1월 15일 배송 시트"
                />
              </v-col>

              <v-col cols="12">
                <v-switch
                  v-model="connectionForm.autoDetect"
                  label="자동으로 스프레드시트 정보 감지"
                  color="primary"
                  hint="URL에서 스프레드시트 ID와 제목을 자동으로 추출합니다"
                  persistent-hint
                />
              </v-col>

              <!-- 스프레드시트 정보 미리보기 -->
              <v-col cols="12" v-if="previewData">
                <v-card variant="outlined">
                  <v-card-subtitle>스프레드시트 정보 미리보기</v-card-subtitle>
                  <v-card-text>
                    <div class="mb-2">
                      <strong>제목:</strong> {{ previewData.name }}
                    </div>
                    <div class="mb-2">
                      <strong>ID:</strong> {{ previewData.id }}
                    </div>
                    <div class="mb-2">
                      <strong>소유자:</strong> {{ previewData.owners?.join(', ') }}
                    </div>
                    <div class="mb-2">
                      <strong>마지막 수정:</strong> {{ formatDateTime(previewData.modifiedTime) }}
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-btn 
            v-if="connectionForm.spreadsheetUrl && connectionForm.autoDetect"
            @click="previewSpreadsheet"
            :loading="previewLoading"
            color="info"
          >
            <v-icon start>mdi-eye</v-icon>
            미리보기
          </v-btn>
          <v-spacer />
          <v-btn @click="closeConnectionDialog">취소</v-btn>
          <v-btn 
            color="primary" 
            @click="saveConnection"
            :disabled="!formValid"
            :loading="saveLoading"
          >
            {{ editMode ? '수정' : '연결' }}
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
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'

interface SheetConnection {
  id: string
  date: string
  spreadsheetId: string
  spreadsheetName: string
  spreadsheetUrl: string
  webViewLink?: string
  description?: string
  status: 'connected' | 'error' | 'testing'
  createdAt: string
  lastAccessed?: string
  testing?: boolean
}

interface SpreadsheetPreview {
  id: string
  name: string
  owners: string[]
  modifiedTime: string
  webViewLink: string
}

// 반응형 데이터
const loading = ref(false)
const saveLoading = ref(false)
const previewLoading = ref(false)
const formValid = ref(false)
const editMode = ref(false)

const selectedDate = ref<string | null>(null)
const sheetConnections = ref<SheetConnection[]>([])
const previewData = ref<SpreadsheetPreview | null>(null)

const connectionDialog = ref(false)

// 폼 데이터
const connectionForm = ref({
  id: '',
  date: '',
  spreadsheetUrl: '',
  description: '',
  autoDetect: true
})

const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

// 테이블 헤더
const connectionHeaders = [
  { title: '날짜', key: 'date', sortable: true },
  { title: '스프레드시트', key: 'spreadsheetName', sortable: false },
  { title: '상태', key: 'status', sortable: true },
  { title: '최근 접근', key: 'lastAccessed', sortable: true },
  { title: '작업', key: 'actions', sortable: false }
]

// 유효성 검사 규칙
const dateRules = [
  (v: string) => !!v || '날짜는 필수입니다'
]

const urlRules = [
  (v: string) => !!v || 'URL은 필수입니다',
  (v: string) => {
    const pattern = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/
    return pattern.test(v) || '올바른 Google Sheets URL이 아닙니다'
  }
]

// 계산된 속성
const selectedDateConnection = computed(() => {
  if (!selectedDate.value) return null
  return sheetConnections.value.find(conn => conn.date === selectedDate.value)
})

const recentConnections = computed(() => {
  return sheetConnections.value
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)
})

const calendarAttributes = computed(() => {
  return sheetConnections.value.map(conn => ({
    dates: new Date(conn.date),
    highlight: {
      color: conn.status === 'connected' ? 'green' : 'orange',
      fillMode: 'solid'
    }
  }))
})

// 감시자
watch(() => connectionForm.value.spreadsheetUrl, () => {
  previewData.value = null
  if (connectionForm.value.autoDetect && connectionForm.value.spreadsheetUrl) {
    // 디바운스를 위해 지연
    setTimeout(() => {
      if (connectionForm.value.autoDetect && connectionForm.value.spreadsheetUrl) {
        previewSpreadsheet()
      }
    }, 1000)
  }
})

// 컴포넌트 마운트
onMounted(async () => {
  await loadSheetConnections()
  
  // 오늘 날짜로 초기화
  const today = new Date().toISOString().split('T')[0]
  selectedDate.value = today
})

// 시트 연결 목록 로드
const loadSheetConnections = async () => {
  try {
    loading.value = true
    const response = await axios.get('/api/admin/sheet-connections')
    sheetConnections.value = response.data.map((conn: SheetConnection) => ({
      ...conn,
      testing: false
    }))
  } catch (error: any) {
    showSnackbar('연결 목록을 불러오는데 실패했습니다.', 'error')
    console.error('연결 목록 로드 실패:', error)
  } finally {
    loading.value = false
  }
}

// 날짜 선택
const onDateSelect = (date: string) => {
  selectedDate.value = date
}

// 연결 추가 다이얼로그 열기
const openConnectionDialog = () => {
  editMode.value = false
  connectionForm.value = {
    id: '',
    date: selectedDate.value || new Date().toISOString().split('T')[0],
    spreadsheetUrl: '',
    description: '',
    autoDetect: true
  }
  previewData.value = null
  connectionDialog.value = true
}

// 연결 수정
const editConnection = (connection: SheetConnection) => {
  editMode.value = true
  connectionForm.value = {
    id: connection.id,
    date: connection.date,
    spreadsheetUrl: connection.spreadsheetUrl,
    description: connection.description || '',
    autoDetect: true
  }
  connectionDialog.value = true
}

// 스프레드시트 미리보기
const previewSpreadsheet = async () => {
  if (!connectionForm.value.spreadsheetUrl) return

  try {
    previewLoading.value = true
    
    const spreadsheetId = extractSpreadsheetId(connectionForm.value.spreadsheetUrl)
    if (!spreadsheetId) {
      showSnackbar('올바른 Google Sheets URL을 입력하세요.', 'error')
      return
    }

    const response = await axios.get(`/api/admin/spreadsheets/${spreadsheetId}/details`)
    previewData.value = response.data
    
  } catch (error: any) {
    showSnackbar('스프레드시트 정보를 가져올 수 없습니다.', 'error')
    console.error('스프레드시트 미리보기 실패:', error)
    previewData.value = null
  } finally {
    previewLoading.value = false
  }
}

// 연결 저장
const saveConnection = async () => {
  try {
    saveLoading.value = true
    
    const spreadsheetId = extractSpreadsheetId(connectionForm.value.spreadsheetUrl)
    if (!spreadsheetId) {
      showSnackbar('올바른 Google Sheets URL을 입력하세요.', 'error')
      return
    }

    const connectionData = {
      ...connectionForm.value,
      spreadsheetId,
      spreadsheetName: previewData.value?.name || `Sheet for ${connectionForm.value.date}`
    }
    
    if (editMode.value) {
      await axios.put(`/api/admin/sheet-connections/${connectionForm.value.id}`, connectionData)
      showSnackbar('스프레드시트 연결이 수정되었습니다.', 'success')
    } else {
      await axios.post('/api/admin/sheet-connections', connectionData)
      showSnackbar('새 스프레드시트 연결이 추가되었습니다.', 'success')
    }
    
    closeConnectionDialog()
    await loadSheetConnections()
    
  } catch (error: any) {
    const message = editMode.value ? '연결 수정에 실패했습니다.' : '연결 추가에 실패했습니다.'
    showSnackbar(message, 'error')
    console.error('연결 저장 실패:', error)
  } finally {
    saveLoading.value = false
  }
}

// 연결 테스트
const testConnection = async (connection: SheetConnection) => {
  try {
    connection.testing = true
    
    const response = await axios.post(`/api/admin/sheet-connections/${connection.id}/test`)
    
    connection.status = response.data.success ? 'connected' : 'error'
    showSnackbar(
      response.data.success ? '연결 테스트가 성공했습니다.' : '연결 테스트가 실패했습니다.',
      response.data.success ? 'success' : 'error'
    )
    
  } catch (error: any) {
    connection.status = 'error'
    showSnackbar('연결 테스트 중 오류가 발생했습니다.', 'error')
    console.error('연결 테스트 실패:', error)
  } finally {
    connection.testing = false
  }
}

// 연결 제거
const removeConnection = async (connection: SheetConnection) => {
  if (!confirm(`${formatDate(connection.date)}의 연결을 정말 제거하시겠습니까?`)) return

  try {
    await axios.delete(`/api/admin/sheet-connections/${connection.id}`)
    showSnackbar('스프레드시트 연결이 제거되었습니다.', 'success')
    await loadSheetConnections()
    
  } catch (error: any) {
    showSnackbar('연결 제거에 실패했습니다.', 'error')
    console.error('연결 제거 실패:', error)
  }
}

// 다이얼로그 닫기
const closeConnectionDialog = () => {
  connectionDialog.value = false
  previewData.value = null
  connectionForm.value = {
    id: '',
    date: '',
    spreadsheetUrl: '',
    description: '',
    autoDetect: true
  }
}

// 유틸리티 함수들
const extractSpreadsheetId = (url: string): string | null => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : null
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
}

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString('ko-KR')
}

const getConnectionStatusText = (status: string) => {
  switch (status) {
    case 'connected': return '연결됨'
    case 'error': return '오류'
    case 'testing': return '테스트중'
    default: return '알 수 없음'
  }
}

const openInNewTab = (url: string) => {
  window.open(url, '_blank')
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
.gap-1 {
  gap: 4px;
}

.gap-2 {
  gap: 8px;
}

.connection-details {
  font-size: 0.9em;
}
</style>