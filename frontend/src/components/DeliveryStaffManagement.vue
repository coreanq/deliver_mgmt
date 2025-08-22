<template>
  <v-card>
    <v-card-title class="d-flex justify-space-between align-center">
      <div>
        <v-icon class="me-2">mdi-account-group</v-icon>
        배달기사 관리
      </div>
      <v-btn color="primary" @click="openAddDialog">
        <v-icon start>mdi-plus</v-icon>
        배달기사 추가
      </v-btn>
    </v-card-title>

    <v-card-text>
      <!-- 검색 및 필터 -->
      <v-row class="mb-4">
        <v-col cols="12" md="6">
          <v-text-field
            v-model="searchQuery"
            label="배달기사 검색"
            prepend-inner-icon="mdi-magnify"
            clearable
            @input="filterStaff"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-select
            v-model="statusFilter"
            :items="statusOptions"
            label="상태 필터"
            @update:model-value="filterStaff"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-btn color="success" @click="generateAllQrCodes" :loading="bulkQrLoading">
            <v-icon start>mdi-qrcode</v-icon>
            전체 QR 생성
          </v-btn>
        </v-col>
      </v-row>

      <!-- 배달기사 목록 -->
      <v-data-table
        :headers="staffHeaders"
        :items="filteredStaff"
        :loading="loading"
        class="elevation-1"
      >
        <template v-slot:item.avatar="{ item }">
          <v-avatar color="primary" size="40">
            <span class="text-white font-weight-bold">
              {{ item.name.charAt(0) }}
            </span>
          </v-avatar>
        </template>

        <template v-slot:item.name="{ item }">
          <div>
            <div class="font-weight-medium">{{ item.name }}</div>
            <div class="text-caption text-grey">ID: {{ item.id }}</div>
          </div>
        </template>

        <template v-slot:item.contact="{ item }">
          <div>
            <div v-if="item.phone">
              <v-icon size="small" class="me-1">mdi-phone</v-icon>
              {{ formatPhoneNumber(item.phone) }}
            </div>
            <div v-if="item.email" class="text-caption">
              <v-icon size="small" class="me-1">mdi-email</v-icon>
              {{ item.email }}
            </div>
          </div>
        </template>

        <template v-slot:item.status="{ item }">
          <v-chip
            :color="getStatusColor(item.status)"
            size="small"
            :text="getStatusText(item.status)"
          />
        </template>

        <template v-slot:item.qrCode="{ item }">
          <div class="d-flex align-center gap-2">
            <v-btn
              icon
              size="small"
              @click="generateQrCode(item)"
              :loading="item.qrLoading"
              title="QR 코드 생성"
            >
              <v-icon>mdi-qrcode</v-icon>
            </v-btn>
            <v-btn
              v-if="item.qrCodeUrl"
              icon
              size="small"
              @click="downloadQrCode(item)"
              color="success"
              title="QR 코드 다운로드"
            >
              <v-icon>mdi-download</v-icon>
            </v-btn>
            <v-btn
              v-if="item.qrCodeUrl"
              icon
              size="small"
              @click="previewQrCode(item)"
              color="info"
              title="QR 코드 미리보기"
            >
              <v-icon>mdi-eye</v-icon>
            </v-btn>
          </div>
        </template>

        <template v-slot:item.lastActive="{ item }">
          <div v-if="item.lastActive" class="text-caption">
            {{ formatDate(item.lastActive) }}
          </div>
          <span v-else class="text-grey">-</span>
        </template>

        <template v-slot:item.actions="{ item }">
          <v-menu>
            <template v-slot:activator="{ props }">
              <v-btn icon="mdi-dots-vertical" v-bind="props" size="small" />
            </template>
            <v-list>
              <v-list-item @click="editStaff(item)">
                <v-list-item-title>
                  <v-icon start>mdi-pencil</v-icon>
                  수정
                </v-list-item-title>
              </v-list-item>
              <v-list-item 
                @click="toggleStaffStatus(item)"
                :class="item.status === 'active' ? 'text-warning' : 'text-success'"
              >
                <v-list-item-title>
                  <v-icon start>{{ item.status === 'active' ? 'mdi-pause' : 'mdi-play' }}</v-icon>
                  {{ item.status === 'active' ? '비활성화' : '활성화' }}
                </v-list-item-title>
              </v-list-item>
              <v-divider />
              <v-list-item @click="deleteStaff(item)" class="text-error">
                <v-list-item-title>
                  <v-icon start>mdi-delete</v-icon>
                  삭제
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </template>
      </v-data-table>
    </v-card-text>

    <!-- 배달기사 추가/수정 다이얼로그 -->
    <v-dialog v-model="staffDialog" max-width="600">
      <v-card>
        <v-card-title>
          {{ editMode ? '배달기사 정보 수정' : '새 배달기사 등록' }}
        </v-card-title>
        
        <v-card-text>
          <v-form ref="staffForm" v-model="formValid">
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="staffForm.name"
                  label="이름 *"
                  :rules="nameRules"
                  required
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="staffForm.phone"
                  label="전화번호 *"
                  :rules="phoneRules"
                  required
                />
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="staffForm.email"
                  label="이메일"
                  :rules="emailRules"
                  type="email"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="staffForm.status"
                  :items="statusOptions"
                  label="상태"
                  required
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="staffForm.vehicleType"
                  label="차량 유형"
                  placeholder="예: 오토바이, 자전거, 도보"
                />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="staffForm.notes"
                  label="메모"
                  rows="3"
                  placeholder="추가 정보나 특이사항"
                />
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="closeStaffDialog">취소</v-btn>
          <v-btn 
            color="primary" 
            @click="saveStaff"
            :disabled="!formValid"
            :loading="saveLoading"
          >
            {{ editMode ? '수정' : '등록' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- QR 코드 미리보기 다이얼로그 -->
    <v-dialog v-model="qrPreviewDialog" max-width="400">
      <v-card v-if="selectedStaff">
        <v-card-title>{{ selectedStaff.name }}님 QR 코드</v-card-title>
        
        <v-card-text class="text-center">
          <div v-if="selectedStaff.qrCodeDataUrl" class="mb-4">
            <img 
              :src="selectedStaff.qrCodeDataUrl" 
              alt="QR Code"
              style="max-width: 100%; height: auto;"
            />
          </div>
          <div class="text-caption text-grey mb-2">
            QR 코드를 스캔하여 배달 화면으로 이동합니다
          </div>
          <v-chip size="small" color="info">
            유효기간: 7일
          </v-chip>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="qrPreviewDialog = false">닫기</v-btn>
          <v-btn color="primary" @click="downloadQrCode(selectedStaff)">
            <v-icon start>mdi-download</v-icon>
            다운로드
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
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'

interface DeliveryStaff {
  id: string
  name: string
  phone: string
  email?: string
  status: 'active' | 'inactive'
  vehicleType?: string
  notes?: string
  qrCodeUrl?: string
  qrCodeDataUrl?: string
  qrLoading?: boolean
  lastActive?: string
  createdAt: string
  updatedAt: string
}

// 반응형 데이터
const loading = ref(false)
const saveLoading = ref(false)
const bulkQrLoading = ref(false)
const formValid = ref(false)
const editMode = ref(false)

const deliveryStaff = ref<DeliveryStaff[]>([])
const filteredStaff = ref<DeliveryStaff[]>([])
const selectedStaff = ref<DeliveryStaff | null>(null)

const staffDialog = ref(false)
const qrPreviewDialog = ref(false)

const searchQuery = ref('')
const statusFilter = ref('all')

// 폼 데이터
const staffForm = ref({
  id: '',
  name: '',
  phone: '',
  email: '',
  status: 'active',
  vehicleType: '',
  notes: ''
})

const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

// 테이블 헤더
const staffHeaders = [
  { title: '', key: 'avatar', sortable: false, width: 60 },
  { title: '이름', key: 'name', sortable: true },
  { title: '연락처', key: 'contact', sortable: false },
  { title: '상태', key: 'status', sortable: true },
  { title: 'QR 코드', key: 'qrCode', sortable: false },
  { title: '최근 활동', key: 'lastActive', sortable: true },
  { title: '작업', key: 'actions', sortable: false }
]

// 옵션들
const statusOptions = [
  { title: '전체', value: 'all' },
  { title: '활성', value: 'active' },
  { title: '비활성', value: 'inactive' }
]

// 유효성 검사 규칙
const nameRules = [
  (v: string) => !!v || '이름은 필수입니다',
  (v: string) => v.length >= 2 || '이름은 2자 이상이어야 합니다'
]

const phoneRules = [
  (v: string) => !!v || '전화번호는 필수입니다',
  (v: string) => /^01[0-9]-?\d{3,4}-?\d{4}$/.test(v) || '올바른 전화번호 형식이 아닙니다'
]

const emailRules = [
  (v: string) => !v || /.+@.+\..+/.test(v) || '올바른 이메일 형식이 아닙니다'
]

// 컴포넌트 마운트
onMounted(async () => {
  await loadDeliveryStaff()
})

// 배달기사 목록 로드
const loadDeliveryStaff = async () => {
  try {
    loading.value = true
    const response = await axios.get('/api/admin/delivery-staff')
    deliveryStaff.value = response.data.map((staff: DeliveryStaff) => ({
      ...staff,
      qrLoading: false
    }))
    filterStaff()
  } catch (error: any) {
    showSnackbar('배달기사 목록을 불러오는데 실패했습니다.', 'error')
    console.error('배달기사 목록 로드 실패:', error)
  } finally {
    loading.value = false
  }
}

// 배달기사 필터링
const filterStaff = () => {
  let filtered = deliveryStaff.value

  // 검색 필터
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(staff => 
      staff.name.toLowerCase().includes(query) ||
      staff.phone.includes(query) ||
      staff.email?.toLowerCase().includes(query)
    )
  }

  // 상태 필터
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(staff => staff.status === statusFilter.value)
  }

  filteredStaff.value = filtered
}

// 배달기사 추가 다이얼로그 열기
const openAddDialog = () => {
  editMode.value = false
  staffForm.value = {
    id: '',
    name: '',
    phone: '',
    email: '',
    status: 'active',
    vehicleType: '',
    notes: ''
  }
  staffDialog.value = true
}

// 배달기사 수정
const editStaff = (staff: DeliveryStaff) => {
  editMode.value = true
  staffForm.value = {
    id: staff.id,
    name: staff.name,
    phone: staff.phone,
    email: staff.email || '',
    status: staff.status,
    vehicleType: staff.vehicleType || '',
    notes: staff.notes || ''
  }
  staffDialog.value = true
}

// 배달기사 저장
const saveStaff = async () => {
  try {
    saveLoading.value = true
    
    if (editMode.value) {
      await axios.put(`/api/admin/delivery-staff/${staffForm.value.id}`, staffForm.value)
      showSnackbar('배달기사 정보가 수정되었습니다.', 'success')
    } else {
      await axios.post('/api/admin/delivery-staff', staffForm.value)
      showSnackbar('새 배달기사가 등록되었습니다.', 'success')
    }
    
    closeStaffDialog()
    await loadDeliveryStaff()
    
  } catch (error: any) {
    const message = editMode.value ? '배달기사 정보 수정에 실패했습니다.' : '배달기사 등록에 실패했습니다.'
    showSnackbar(message, 'error')
    console.error('배달기사 저장 실패:', error)
  } finally {
    saveLoading.value = false
  }
}

// 배달기사 상태 토글
const toggleStaffStatus = async (staff: DeliveryStaff) => {
  try {
    const newStatus = staff.status === 'active' ? 'inactive' : 'active'
    await axios.patch(`/api/admin/delivery-staff/${staff.id}/status`, { status: newStatus })
    
    staff.status = newStatus
    showSnackbar(
      `${staff.name}님이 ${newStatus === 'active' ? '활성화' : '비활성화'}되었습니다.`,
      'success'
    )
    filterStaff()
    
  } catch (error: any) {
    showSnackbar('상태 변경에 실패했습니다.', 'error')
    console.error('상태 변경 실패:', error)
  }
}

// 배달기사 삭제
const deleteStaff = async (staff: DeliveryStaff) => {
  if (!confirm(`${staff.name}님을 정말 삭제하시겠습니까?`)) return

  try {
    await axios.delete(`/api/admin/delivery-staff/${staff.id}`)
    showSnackbar(`${staff.name}님이 삭제되었습니다.`, 'success')
    await loadDeliveryStaff()
    
  } catch (error: any) {
    showSnackbar('배달기사 삭제에 실패했습니다.', 'error')
    console.error('배달기사 삭제 실패:', error)
  }
}

// QR 코드 생성
const generateQrCode = async (staff: DeliveryStaff) => {
  try {
    staff.qrLoading = true
    
    const response = await axios.post('/api/qr/generate', {
      staffName: staff.name,
      sheetName: staff.name
    })
    
    staff.qrCodeUrl = response.data.data.qrCodeUrl
    staff.qrCodeDataUrl = response.data.data.qrCodeDataUrl
    
    showSnackbar(`${staff.name}님의 QR 코드가 생성되었습니다.`, 'success')
    
  } catch (error: any) {
    showSnackbar('QR 코드 생성에 실패했습니다.', 'error')
    console.error('QR 코드 생성 실패:', error)
  } finally {
    staff.qrLoading = false
  }
}

// 전체 QR 코드 생성
const generateAllQrCodes = async () => {
  try {
    bulkQrLoading.value = true
    
    const activeStaff = deliveryStaff.value.filter(staff => staff.status === 'active')
    const promises = activeStaff.map(staff => generateQrCode(staff))
    
    await Promise.all(promises)
    showSnackbar(`${activeStaff.length}명의 QR 코드가 생성되었습니다.`, 'success')
    
  } catch (error: any) {
    showSnackbar('QR 코드 일괄 생성에 실패했습니다.', 'error')
    console.error('QR 코드 일괄 생성 실패:', error)
  } finally {
    bulkQrLoading.value = false
  }
}

// QR 코드 다운로드
const downloadQrCode = (staff: DeliveryStaff) => {
  if (!staff.qrCodeDataUrl) return

  const link = document.createElement('a')
  link.download = `QR_${staff.name}.png`
  link.href = staff.qrCodeDataUrl
  link.click()
}

// QR 코드 미리보기
const previewQrCode = (staff: DeliveryStaff) => {
  selectedStaff.value = staff
  qrPreviewDialog.value = true
}

// 다이얼로그 닫기
const closeStaffDialog = () => {
  staffDialog.value = false
  staffForm.value = {
    id: '',
    name: '',
    phone: '',
    email: '',
    status: 'active',
    vehicleType: '',
    notes: ''
  }
}

// 유틸리티 함수들
const formatPhoneNumber = (phone: string) => {
  if (phone.length === 11) {
    return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  }
  return phone
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('ko-KR')
}

const getStatusColor = (status: string) => {
  return status === 'active' ? 'success' : 'error'
}

const getStatusText = (status: string) => {
  return status === 'active' ? '활성' : '비활성'
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
.gap-2 {
  gap: 8px;
}
</style>