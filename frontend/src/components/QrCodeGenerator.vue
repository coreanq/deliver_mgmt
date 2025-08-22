<template>
  <v-card class="qr-generator">
    <v-card-title class="d-flex align-center">
      <v-icon icon="mdi-qrcode" class="me-2"></v-icon>
      QR 코드 생성기
    </v-card-title>

    <v-card-text>
      <v-form ref="form" v-model="valid" @submit.prevent="generateQrCode">
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="staffName"
              label="배달기사 이름"
              required
              :rules="nameRules"
              variant="outlined"
              density="compact"
            ></v-text-field>
          </v-col>
          
          <v-col cols="12" md="6">
            <v-text-field
              v-model="sheetName"
              label="시트명 (선택사항)"
              hint="비워두면 배달기사 이름을 사용합니다"
              variant="outlined"
              density="compact"
            ></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12">
            <v-btn
              :loading="loading"
              :disabled="!valid"
              color="primary"
              type="submit"
              variant="elevated"
              class="me-2"
            >
              <v-icon icon="mdi-qrcode" class="me-1"></v-icon>
              QR 코드 생성
            </v-btn>

            <v-btn
              v-if="qrData"
              @click="downloadQrCode"
              color="success"
              variant="outlined"
              class="me-2"
            >
              <v-icon icon="mdi-download" class="me-1"></v-icon>
              다운로드
            </v-btn>

            <v-btn
              @click="generateBatch"
              color="info"
              variant="outlined"
              class="me-2"
            >
              <v-icon icon="mdi-account-multiple" class="me-1"></v-icon>
              일괄 생성
            </v-btn>

            <v-btn
              @click="generateFromSheets"
              color="success"
              variant="elevated"
            >
              <v-icon icon="mdi-google-spreadsheet" class="me-1"></v-icon>
              구글 시트에서 생성
            </v-btn>
          </v-col>
        </v-row>
      </v-form>

      <!-- QR 코드 표시 영역 -->
      <v-row v-if="qrData" class="mt-4">
        <v-col cols="12" md="6">
          <v-card variant="outlined">
            <v-card-title class="text-h6">생성된 QR 코드</v-card-title>
            <v-card-text class="text-center">
              <img 
                :src="qrData.qrCodeDataUrl" 
                :alt="`${qrData.staffName} QR 코드`"
                class="qr-image"
                style="max-width: 100%; height: auto;"
              />
              <div class="mt-2">
                <v-chip color="primary" variant="elevated">
                  {{ qrData.staffName }}
                </v-chip>
                <v-chip v-if="qrData.sheetName !== qrData.staffName" color="secondary" variant="outlined" class="ml-2">
                  시트: {{ qrData.sheetName }}
                </v-chip>
              </div>
              <p class="text-caption mt-2 text-grey">
                유효기간: {{ qrData.expiresIn }}
              </p>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card variant="outlined">
            <v-card-title class="text-h6">QR 코드 정보</v-card-title>
            <v-card-text>
              <v-list density="compact">
                <v-list-item>
                  <v-list-item-title>배달기사</v-list-item-title>
                  <v-list-item-subtitle>{{ qrData.staffName }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>시트명</v-list-item-title>
                  <v-list-item-subtitle>{{ qrData.sheetName }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>접속 URL</v-list-item-title>
                  <v-list-item-subtitle class="text-wrap">
                    <a :href="qrData.qrCodeUrl" target="_blank" class="text-primary">
                      {{ shortenUrl(qrData.qrCodeUrl) }}
                    </a>
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 구글 시트 생성 다이얼로그 -->
      <v-dialog v-model="sheetsDialog" max-width="600px">
        <v-card>
          <v-card-title>구글 시트에서 QR 코드 생성</v-card-title>
          <v-card-text>
            <v-text-field
              v-model="spreadsheetId"
              label="스프레드시트 ID"
              hint="구글 시트 URL에서 /d/ 뒤의 긴 문자열"
              variant="outlined"
              persistent-hint
              class="mb-4"
            ></v-text-field>
            <v-alert color="info" icon="mdi-information" class="mb-4">
              구글 시트의 각 배달담당자별 시트명을 기준으로 QR 코드가 생성됩니다.
            </v-alert>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn @click="sheetsDialog = false" variant="text">취소</v-btn>
            <v-btn @click="processSheetsGeneration" color="success" :loading="sheetsLoading">생성</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- 일괄 생성 다이얼로그 -->
      <v-dialog v-model="batchDialog" max-width="600px">
        <v-card>
          <v-card-title>일괄 QR 코드 생성</v-card-title>
          <v-card-text>
            <v-textarea
              v-model="batchStaffList"
              label="배달기사 목록"
              hint="한 줄에 하나씩 입력하세요. 예: 홍길동, 김철수 (시트명), ..."
              rows="6"
              variant="outlined"
            ></v-textarea>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn @click="batchDialog = false" variant="text">취소</v-btn>
            <v-btn @click="processBatchGeneration" color="primary" :loading="batchLoading">생성</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- 일괄 생성 결과 다이얼로그 -->
      <v-dialog v-model="batchResultDialog" max-width="800px">
        <v-card>
          <v-card-title>일괄 생성 결과</v-card-title>
          <v-card-text>
            <v-alert
              :color="batchResult.summary.failed === 0 ? 'success' : 'warning'"
              icon="mdi-information"
              class="mb-4"
            >
              총 {{ batchResult.summary.total }}개 중 {{ batchResult.summary.success }}개 성공, 
              {{ batchResult.summary.failed }}개 실패
            </v-alert>

            <v-data-table
              :headers="batchHeaders"
              :items="batchResult.results"
              item-key="staffName"
              class="elevation-1"
            >
              <template v-slot:item.success="{ item }">
                <v-chip :color="item.success ? 'success' : 'error'" variant="elevated">
                  {{ item.success ? '성공' : '실패' }}
                </v-chip>
              </template>
              <template v-slot:item.actions="{ item }">
                <v-btn
                  v-if="item.success"
                  @click="downloadSingleQr(item)"
                  icon="mdi-download"
                  size="small"
                  variant="text"
                ></v-btn>
              </template>
            </v-data-table>
          </v-card-text>
          <v-card-actions>
            <v-btn @click="downloadAllQrCodes" color="primary" variant="outlined">
              <v-icon icon="mdi-download-multiple" class="me-1"></v-icon>
              전체 다운로드
            </v-btn>
            <v-spacer></v-spacer>
            <v-btn @click="batchResultDialog = false" variant="text">닫기</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-card-text>

    <!-- 에러 스낵바 -->
    <v-snackbar v-model="errorSnackbar" color="error" :timeout="5000">
      {{ errorMessage }}
      <template v-slot:actions>
        <v-btn icon="mdi-close" @click="errorSnackbar = false"></v-btn>
      </template>
    </v-snackbar>

    <!-- 성공 스낵바 -->
    <v-snackbar v-model="successSnackbar" color="success" :timeout="3000">
      {{ successMessage }}
      <template v-slot:actions>
        <v-btn icon="mdi-close" @click="successSnackbar = false"></v-btn>
      </template>
    </v-snackbar>
  </v-card>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import axios from 'axios'

// 반응형 데이터
const form = ref()
const valid = ref(false)
const loading = ref(false)
const staffName = ref('')
const sheetName = ref('')
const qrData = ref<any>(null)

// 일괄 생성 관련
const batchDialog = ref(false)
const batchStaffList = ref('')
const batchLoading = ref(false)
const batchResultDialog = ref(false)
const batchResult = ref<any>({ results: [], summary: {} })

// 구글 시트 생성 관련
const sheetsDialog = ref(false)
const spreadsheetId = ref('')
const sheetsLoading = ref(false)

// 스낵바
const errorSnackbar = ref(false)
const errorMessage = ref('')
const successSnackbar = ref(false)
const successMessage = ref('')

// 폼 유효성 검사 규칙
const nameRules = [
  (v: string) => !!v || '배달기사 이름을 입력해주세요.',
  (v: string) => v.length >= 2 || '최소 2글자 이상 입력해주세요.'
]

// 일괄 생성 테이블 헤더
const batchHeaders = [
  { title: '배달기사', value: 'staffName' },
  { title: '시트명', value: 'sheetName' },
  { title: '상태', value: 'success' },
  { title: '오류', value: 'error' },
  { title: '작업', value: 'actions', sortable: false }
]

// 단일 QR 코드 생성
const generateQrCode = async () => {
  if (!form.value.validate()) return

  loading.value = true
  try {
    const response = await axios.post('/api/qr/generate', {
      staffName: staffName.value,
      sheetName: sheetName.value || null
    })

    if (response.data.success) {
      qrData.value = response.data.data
      successMessage.value = 'QR 코드가 성공적으로 생성되었습니다.'
      successSnackbar.value = true
    } else {
      throw new Error(response.data.message)
    }
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || 'QR 코드 생성에 실패했습니다.'
    errorSnackbar.value = true
  } finally {
    loading.value = false
  }
}

// QR 코드 다운로드
const downloadQrCode = () => {
  if (!qrData.value) return

  const link = document.createElement('a')
  link.href = qrData.value.qrCodeDataUrl
  link.download = `QR_${qrData.value.staffName}_${new Date().toISOString().split('T')[0]}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// URL 단축 표시
const shortenUrl = (url: string) => {
  if (url.length <= 50) return url
  return url.substring(0, 30) + '...' + url.substring(url.length - 15)
}

// 일괄 생성 다이얼로그 열기
const generateBatch = () => {
  batchDialog.value = true
  batchStaffList.value = ''
}

// 일괄 생성 처리
const processBatchGeneration = async () => {
  if (!batchStaffList.value.trim()) {
    errorMessage.value = '배달기사 목록을 입력해주세요.'
    errorSnackbar.value = true
    return
  }

  batchLoading.value = true
  try {
    // 배달기사 목록 파싱
    const staffList = batchStaffList.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => {
        if (line.includes(',')) {
          const [name, sheet] = line.split(',').map(s => s.trim())
          return { name, sheetName: sheet }
        }
        return line
      })

    const response = await axios.post('/api/qr/generate-batch', {
      staffList
    })

    if (response.data.success) {
      batchResult.value = response.data.data
      batchDialog.value = false
      batchResultDialog.value = true
    } else {
      throw new Error(response.data.message)
    }
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || '일괄 생성에 실패했습니다.'
    errorSnackbar.value = true
  } finally {
    batchLoading.value = false
  }
}

// 개별 QR 코드 다운로드
const downloadSingleQr = (item: any) => {
  const link = document.createElement('a')
  link.href = item.qrCodeDataUrl
  link.download = `QR_${item.staffName}_${new Date().toISOString().split('T')[0]}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 전체 QR 코드 다운로드 (ZIP은 추후 구현)
const downloadAllQrCodes = () => {
  batchResult.value.results
    .filter((item: any) => item.success)
    .forEach((item: any) => {
      setTimeout(() => downloadSingleQr(item), 100) // 약간의 딜레이
    })
}

// 구글 시트 생성 다이얼로그 열기
const generateFromSheets = () => {
  sheetsDialog.value = true
  spreadsheetId.value = ''
}

// 구글 시트에서 QR 코드 생성 처리
const processSheetsGeneration = async () => {
  if (!spreadsheetId.value.trim()) {
    errorMessage.value = '스프레드시트 ID를 입력해주세요.'
    errorSnackbar.value = true
    return
  }

  sheetsLoading.value = true
  try {
    // 임시로 빈 토큰 객체 사용 (실제로는 세션에서 가져와야 함)
    const response = await axios.post('/api/qr/generate-from-sheets', {
      tokens: {}, // 실제로는 구글 OAuth 토큰 필요
      spreadsheetId: spreadsheetId.value
    })

    if (response.data.success) {
      batchResult.value = response.data.data
      sheetsDialog.value = false
      batchResultDialog.value = true
      successMessage.value = '구글 시트에서 QR 코드가 성공적으로 생성되었습니다.'
      successSnackbar.value = true
    } else {
      throw new Error(response.data.message)
    }
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || '구글 시트에서 QR 코드 생성에 실패했습니다.'
    errorSnackbar.value = true
  } finally {
    sheetsLoading.value = false
  }
}
</script>

<style scoped>
.qr-generator {
  max-width: 100%;
}

.qr-image {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 8px;
  background: white;
}

.text-wrap {
  word-break: break-all;
}
</style>