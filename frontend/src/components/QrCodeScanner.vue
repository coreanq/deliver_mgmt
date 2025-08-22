<template>
  <v-card class="qr-scanner">
    <v-card-title class="d-flex align-center">
      <v-icon icon="mdi-qrcode-scan" class="me-2"></v-icon>
      배송자 QR 스캐너
    </v-card-title>

    <v-card-text>
      <!-- 스캐너 영역 -->
      <div v-if="!isScanning && !scanResult" class="text-center">
        <v-btn
          @click="startScanning"
          color="primary"
          size="large"
          variant="elevated"
          class="mb-4"
        >
          <v-icon icon="mdi-camera" class="me-2"></v-icon>
          QR 코드 스캔 시작
        </v-btn>
        
        <v-divider class="my-4"></v-divider>
        
        <p class="text-body-2 text-grey-600">
          또는 수동으로 입력하세요
        </p>
        
        <!-- 수동 입력 폼 -->
        <v-form ref="form" v-model="valid" @submit.prevent="manualLogin">
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="manualInput.staffName"
                label="배송자 이름"
                variant="outlined"
                density="compact"
                :rules="nameRules"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="manualInput.token"
                label="토큰"
                variant="outlined"
                density="compact"
                :rules="tokenRules"
              ></v-text-field>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="manualInput.workDate"
                label="작업 날짜"
                type="date"
                variant="outlined"
                density="compact"
                :max="maxDate"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6" class="d-flex align-center">
              <v-btn
                :loading="loginLoading"
                :disabled="!valid"
                type="submit"
                color="success"
                variant="elevated"
              >
                <v-icon icon="mdi-login" class="me-1"></v-icon>
                로그인
              </v-btn>
            </v-col>
          </v-row>
        </v-form>
      </div>

      <!-- 스캐닝 중 화면 -->
      <div v-if="isScanning" class="scanner-container">
        <div class="video-container">
          <video
            ref="videoElement"
            autoplay
            muted
            playsinline
            @loadedmetadata="onVideoLoaded"
          ></video>
          <canvas
            ref="canvasElement"
            style="display: none;"
          ></canvas>
        </div>
        
        <div class="scanner-overlay">
          <div class="scanner-frame">
            <div class="corner top-left"></div>
            <div class="corner top-right"></div>
            <div class="corner bottom-left"></div>
            <div class="corner bottom-right"></div>
          </div>
        </div>

        <div class="scanner-controls mt-4 text-center">
          <v-btn
            @click="stopScanning"
            color="error"
            variant="elevated"
            class="me-2"
          >
            <v-icon icon="mdi-stop" class="me-1"></v-icon>
            스캔 중지
          </v-btn>
          
          <v-btn
            @click="switchCamera"
            color="info"
            variant="outlined"
            :disabled="cameras.length < 2"
          >
            <v-icon icon="mdi-camera-flip" class="me-1"></v-icon>
            카메라 전환
          </v-btn>
        </div>

        <div class="scanner-status mt-3 text-center">
          <v-chip color="info" variant="elevated">
            QR 코드를 카메라에 맞춰주세요
          </v-chip>
        </div>
      </div>

      <!-- 스캔 결과 -->
      <div v-if="scanResult" class="scan-result">
        <v-alert
          :color="scanResult.success ? 'success' : 'error'"
          :icon="scanResult.success ? 'mdi-check-circle' : 'mdi-alert-circle'"
          variant="elevated"
          class="mb-4"
        >
          <v-alert-title>
            {{ scanResult.success ? '스캔 성공' : '스캔 실패' }}
          </v-alert-title>
          {{ scanResult.message }}
        </v-alert>

        <div v-if="scanResult.success && scanResult.data" class="result-details">
          <v-card variant="outlined">
            <v-card-title class="text-h6">인증 정보</v-card-title>
            <v-card-text>
              <v-list density="compact">
                <v-list-item>
                  <v-list-item-title>배송자명</v-list-item-title>
                  <v-list-item-subtitle>{{ scanResult.data.staffName }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>작업 날짜</v-list-item-title>
                  <v-list-item-subtitle>{{ scanResult.data.workDate }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="scanResult.data.staffInfo">
                  <v-list-item-title>연락처</v-list-item-title>
                  <v-list-item-subtitle>{{ scanResult.data.staffInfo.phone }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </div>

        <div class="result-actions mt-4 text-center">
          <v-btn
            v-if="scanResult.success"
            @click="goToDeliveryDashboard"
            color="primary"
            size="large"
            variant="elevated"
            class="me-2"
          >
            <v-icon icon="mdi-view-dashboard" class="me-1"></v-icon>
            배송 관리로 이동
          </v-btn>
          
          <v-btn
            @click="resetScanner"
            color="secondary"
            variant="outlined"
          >
            <v-icon icon="mdi-restart" class="me-1"></v-icon>
            다시 스캔
          </v-btn>
        </div>
      </div>

      <!-- 에러 상황별 도움말 -->
      <div v-if="scanResult && !scanResult.success" class="error-help mt-4">
        <v-expansion-panels variant="accordion">
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon icon="mdi-help-circle" class="me-2"></v-icon>
              문제 해결 방법
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div v-if="scanResult.errorType === 'STAFF_NOT_FOUND'">
                <h4>등록되지 않은 배송자</h4>
                <ul>
                  <li>관리자에게 배송자 등록을 요청하세요</li>
                  <li>이름 철자가 정확한지 확인하세요</li>
                </ul>
              </div>
              
              <div v-else-if="scanResult.errorType === 'SHEET_NOT_CONNECTED'">
                <h4>스프레드시트 미연결</h4>
                <ul>
                  <li>관리자에게 해당 날짜의 스프레드시트 연결을 요청하세요</li>
                  <li>올바른 작업 날짜인지 확인하세요</li>
                </ul>
              </div>
              
              <div v-else-if="scanResult.errorType === 'INVALID_QR_CODE'">
                <h4>유효하지 않은 QR 코드</h4>
                <ul>
                  <li>QR 코드가 손상되었을 수 있습니다</li>
                  <li>관리자에게 새로운 QR 코드 발급을 요청하세요</li>
                </ul>
              </div>
              
              <div v-else>
                <h4>일반적인 해결 방법</h4>
                <ul>
                  <li>QR 코드를 다시 스캔해보세요</li>
                  <li>인터넷 연결을 확인하세요</li>
                  <li>문제가 지속되면 관리자에게 문의하세요</li>
                </ul>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </div>
    </v-card-text>

    <!-- 로딩 스낵바 -->
    <v-snackbar v-model="loadingSnackbar" color="info" :timeout="-1">
      QR 코드 처리 중...
      <template v-slot:actions>
        <v-progress-circular indeterminate size="20"></v-progress-circular>
      </template>
    </v-snackbar>

    <!-- 에러 스낵바 -->
    <v-snackbar v-model="errorSnackbar" color="error" :timeout="5000">
      {{ errorMessage }}
      <template v-slot:actions>
        <v-btn icon="mdi-close" @click="errorSnackbar = false"></v-btn>
      </template>
    </v-snackbar>
  </v-card>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

// Router
const router = useRouter()

// 반응형 데이터
const form = ref()
const valid = ref(false)
const isScanning = ref(false)
const videoElement = ref<HTMLVideoElement | null>(null)
const canvasElement = ref<HTMLCanvasElement | null>(null)
const stream = ref<MediaStream | null>(null)
const scanResult = ref<any>(null)
const loginLoading = ref(false)
const loadingSnackbar = ref(false)
const errorSnackbar = ref(false)
const errorMessage = ref('')

// 카메라 관련
const cameras = ref<MediaDeviceInfo[]>([])
const currentCameraIndex = ref(0)

// 수동 입력
const manualInput = reactive({
  staffName: '',
  token: '',
  workDate: new Date().toISOString().split('T')[0]
})

// 최대 날짜 (오늘)
const maxDate = new Date().toISOString().split('T')[0]

// 폼 유효성 검사
const nameRules = [
  (v: string) => !!v || '배송자 이름을 입력해주세요.',
  (v: string) => v.length >= 2 || '최소 2글자 이상 입력해주세요.'
]

const tokenRules = [
  (v: string) => !!v || '토큰을 입력해주세요.'
]

// QR 코드 패턴 (배송자 URL 형태)
const QR_PATTERN = /\/delivery\?staff=([^&]+)&workDate=([^&]+)&token=([^&]+)/

// 컴포넌트 마운트
onMounted(async () => {
  await getCameras()
})

// 컴포넌트 언마운트
onUnmounted(() => {
  stopScanning()
})

// 카메라 목록 가져오기
const getCameras = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    cameras.value = devices.filter(device => device.kind === 'videoinput')
  } catch (error) {
    console.error('카메라 목록 조회 실패:', error)
  }
}

// 스캔 시작
const startScanning = async () => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('카메라를 지원하지 않는 브라우저입니다.')
    }

    const constraints = {
      video: {
        facingMode: 'environment', // 후면 카메라 선호
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    }

    if (cameras.value.length > 0) {
      constraints.video.deviceId = cameras.value[currentCameraIndex.value].deviceId
    }

    stream.value = await navigator.mediaDevices.getUserMedia(constraints)
    
    if (videoElement.value) {
      videoElement.value.srcObject = stream.value
      isScanning.value = true
      scanResult.value = null
    }
  } catch (error: any) {
    errorMessage.value = error.message || '카메라 접근에 실패했습니다.'
    errorSnackbar.value = true
  }
}

// 스캔 중지
const stopScanning = () => {
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop())
    stream.value = null
  }
  isScanning.value = false
}

// 카메라 전환
const switchCamera = async () => {
  if (cameras.value.length < 2) return
  
  stopScanning()
  currentCameraIndex.value = (currentCameraIndex.value + 1) % cameras.value.length
  await startScanning()
}

// 비디오 로드 완료
const onVideoLoaded = () => {
  startQrDetection()
}

// QR 코드 감지 시작
const startQrDetection = () => {
  const scanFrame = () => {
    if (!isScanning.value || !videoElement.value || !canvasElement.value) {
      return
    }

    const video = videoElement.value
    const canvas = canvasElement.value
    const context = canvas.getContext('2d')

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanFrame)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    
    // 여기서는 간단한 QR 감지를 시뮬레이션
    // 실제로는 jsQR 같은 라이브러리를 사용해야 함
    // TODO: jsQR 라이브러리 설치 후 구현
    
    requestAnimationFrame(scanFrame)
  }
  
  requestAnimationFrame(scanFrame)
}

// QR 코드 데이터 처리
const processQrData = async (qrData: string) => {
  loadingSnackbar.value = true
  
  try {
    // URL에서 파라미터 추출
    const match = qrData.match(QR_PATTERN)
    if (!match) {
      throw new Error('유효하지 않은 QR 코드 형식입니다.')
    }

    const [, staffName, workDate, token] = match
    
    // 디코딩
    const decodedStaffName = decodeURIComponent(staffName)
    const decodedToken = decodeURIComponent(token)

    await performLogin(decodedStaffName, decodedToken, workDate)
    
  } catch (error: any) {
    scanResult.value = {
      success: false,
      message: error.message || 'QR 코드 처리에 실패했습니다.',
      errorType: 'QR_PROCESSING_ERROR'
    }
  } finally {
    loadingSnackbar.value = false
    stopScanning()
  }
}

// 로그인 수행
const performLogin = async (staffName: string, token: string, workDate?: string) => {
  try {
    const response = await axios.post('/api/delivery/qr-login', {
      staffName,
      token,
      workDate
    })

    if (response.data.success) {
      scanResult.value = {
        success: true,
        message: response.data.message,
        data: response.data.data
      }
    } else {
      throw new Error(response.data.message)
    }
  } catch (error: any) {
    const errorData = error.response?.data
    scanResult.value = {
      success: false,
      message: errorData?.message || 'QR 로그인에 실패했습니다.',
      errorType: errorData?.errorType || 'LOGIN_ERROR',
      details: errorData?.details
    }
  }
}

// 수동 로그인
const manualLogin = async () => {
  if (!form.value.validate()) return

  loginLoading.value = true
  await performLogin(manualInput.staffName, manualInput.token, manualInput.workDate)
  loginLoading.value = false
}

// 배송 대시보드로 이동
const goToDeliveryDashboard = () => {
  router.push('/delivery-dashboard')
}

// 스캐너 리셋
const resetScanner = () => {
  scanResult.value = null
  manualInput.staffName = ''
  manualInput.token = ''
  manualInput.workDate = new Date().toISOString().split('T')[0]
}
</script>

<style scoped>
.qr-scanner {
  max-width: 800px;
  margin: 0 auto;
}

.scanner-container {
  position: relative;
  max-width: 400px;
  margin: 0 auto;
}

.video-container {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}

video {
  width: 100%;
  height: auto;
  display: block;
}

.scanner-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.scanner-frame {
  position: relative;
  width: 200px;
  height: 200px;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.corner {
  position: absolute;
  width: 20px;
  height: 20px;
  border: 3px solid #4CAF50;
}

.corner.top-left {
  top: -3px;
  left: -3px;
  border-right: none;
  border-bottom: none;
}

.corner.top-right {
  top: -3px;
  right: -3px;
  border-left: none;
  border-bottom: none;
}

.corner.bottom-left {
  bottom: -3px;
  left: -3px;
  border-right: none;
  border-top: none;
}

.corner.bottom-right {
  bottom: -3px;
  right: -3px;
  border-left: none;
  border-top: none;
}

.scanner-controls {
  margin-top: 16px;
}

.scanner-status {
  margin-top: 12px;
}

.scan-result {
  max-width: 500px;
  margin: 0 auto;
}

.result-details {
  margin-top: 16px;
}

.result-actions {
  margin-top: 16px;
}

.error-help h4 {
  color: #f44336;
  margin-bottom: 8px;
}

.error-help ul {
  margin-left: 16px;
}

.error-help li {
  margin-bottom: 4px;
}
</style>