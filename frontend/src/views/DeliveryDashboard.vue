<template>
  <v-container fluid>
    <!-- 헤더 -->
    <v-row>
      <v-col cols="12">
        <v-card class="mb-4">
          <v-card-title class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <v-icon icon="mdi-truck-delivery" class="me-2" color="primary"></v-icon>
              <span>배송 관리 대시보드</span>
            </div>
            <v-btn
              @click="logout"
              color="error"
              variant="outlined"
              size="small"
            >
              <v-icon icon="mdi-logout" class="me-1"></v-icon>
              로그아웃
            </v-btn>
          </v-card-title>
          
          <v-card-text v-if="userInfo">
            <v-row>
              <v-col cols="12" md="4">
                <v-list-item density="compact">
                  <v-list-item-title>배송자</v-list-item-title>
                  <v-list-item-subtitle class="text-h6">{{ userInfo.staffName }}</v-list-item-subtitle>
                </v-list-item>
              </v-col>
              <v-col cols="12" md="4">
                <v-list-item density="compact">
                  <v-list-item-title>작업 날짜</v-list-item-title>
                  <v-list-item-subtitle class="text-h6">{{ userInfo.workDate }}</v-list-item-subtitle>
                </v-list-item>
              </v-col>
              <v-col cols="12" md="4">
                <v-list-item density="compact">
                  <v-list-item-title>연락처</v-list-item-title>
                  <v-list-item-subtitle class="text-h6">{{ userInfo.staffInfo?.phone }}</v-list-item-subtitle>
                </v-list-item>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 통계 카드들 -->
    <v-row>
      <v-col cols="12" sm="6" md="3">
        <v-card color="primary" variant="elevated">
          <v-card-text>
            <div class="d-flex align-center">
              <v-icon icon="mdi-package-variant" size="40" class="me-3"></v-icon>
              <div>
                <div class="text-h4 font-weight-bold">{{ stats.totalOrders }}</div>
                <div class="text-body-2">전체 주문</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      
      <v-col cols="12" sm="6" md="3">
        <v-card color="success" variant="elevated">
          <v-card-text>
            <div class="d-flex align-center">
              <v-icon icon="mdi-check-circle" size="40" class="me-3"></v-icon>
              <div>
                <div class="text-h4 font-weight-bold">{{ stats.completedOrders }}</div>
                <div class="text-body-2">완료</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      
      <v-col cols="12" sm="6" md="3">
        <v-card color="warning" variant="elevated">
          <v-card-text>
            <div class="d-flex align-center">
              <v-icon icon="mdi-clock-outline" size="40" class="me-3"></v-icon>
              <div>
                <div class="text-h4 font-weight-bold">{{ stats.pendingOrders }}</div>
                <div class="text-body-2">대기중</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      
      <v-col cols="12" sm="6" md="3">
        <v-card color="info" variant="elevated">
          <v-card-text>
            <div class="d-flex align-center">
              <v-icon icon="mdi-percent" size="40" class="me-3"></v-icon>
              <div>
                <div class="text-h4 font-weight-bold">{{ completionRate }}%</div>
                <div class="text-body-2">완료율</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 주문 목록 -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="d-flex align-center justify-space-between">
            <span>배송 주문 목록</span>
            <div class="d-flex align-center gap-2">
              <v-btn
                @click="refreshOrders"
                :loading="refreshLoading"
                icon="mdi-refresh"
                variant="text"
                size="small"
              ></v-btn>
              
              <v-select
                v-model="statusFilter"
                :items="statusOptions"
                label="상태 필터"
                variant="outlined"
                density="compact"
                style="min-width: 150px;"
                hide-details
              ></v-select>
            </div>
          </v-card-title>
          
          <v-card-text>
            <v-data-table
              :headers="orderHeaders"
              :items="filteredOrders"
              :loading="ordersLoading"
              item-key="rowIndex"
              class="elevation-1"
              :items-per-page="10"
            >
              <template v-slot:item.status="{ item }">
                <v-chip
                  :color="getStatusColor(item.status)"
                  variant="elevated"
                >
                  {{ item.status }}
                </v-chip>
              </template>
              
              <template v-slot:item.actions="{ item }">
                <v-select
                  :model-value="item.status"
                  @update:model-value="(newStatus) => updateStatus(item, newStatus)"
                  :items="validStatuses"
                  variant="outlined"
                  density="compact"
                  hide-details
                  style="min-width: 120px;"
                  :loading="item.updating"
                  :disabled="item.updating"
                >
                  <template v-slot:selection="{ item: statusItem }">
                    <v-chip
                      :color="getStatusColor(statusItem.value)"
                      size="small"
                      variant="elevated"
                    >
                      {{ statusItem.title }}
                    </v-chip>
                  </template>
                </v-select>
              </template>
              
              <template v-slot:no-data>
                <div class="text-center py-8">
                  <v-icon icon="mdi-package-variant-closed" size="64" color="grey-lighten-2" class="mb-4"></v-icon>
                  <p class="text-body-1 text-grey">주문이 없습니다.</p>
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 상태 업데이트 확인 다이얼로그 -->
    <v-dialog v-model="confirmDialog" max-width="400px">
      <v-card>
        <v-card-title>상태 변경 확인</v-card-title>
        <v-card-text>
          <p><strong>{{ pendingUpdate?.customerName }}</strong>님의 배송 상태를</p>
          <p><strong>"{{ pendingUpdate?.newStatus }}"</strong>로 변경하시겠습니까?</p>
          
          <v-alert
            v-if="pendingUpdate?.newStatus === '완료'"
            color="info"
            icon="mdi-information"
            variant="tonal"
            class="mt-3"
          >
            완료 처리 시 고객에게 카카오톡 알림이 자동으로 발송됩니다.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="confirmDialog = false" variant="text">취소</v-btn>
          <v-btn @click="confirmStatusUpdate" color="primary" :loading="updateLoading">확인</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 성공 스낵바 -->
    <v-snackbar v-model="successSnackbar" color="success" :timeout="3000">
      {{ successMessage }}
      <template v-slot:actions>
        <v-btn icon="mdi-close" @click="successSnackbar = false"></v-btn>
      </template>
    </v-snackbar>

    <!-- 에러 스낵바 -->
    <v-snackbar v-model="errorSnackbar" color="error" :timeout="5000">
      {{ errorMessage }}
      <template v-slot:actions>
        <v-btn icon="mdi-close" @click="errorSnackbar = false"></v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

// Router
const router = useRouter()

// 반응형 데이터
const userInfo = ref<any>(null)
const orders = ref<any[]>([])
const ordersLoading = ref(false)
const refreshLoading = ref(false)
const updateLoading = ref(false)
const statusFilter = ref('전체')
const confirmDialog = ref(false)
const pendingUpdate = ref<any>(null)

// 스낵바
const successSnackbar = ref(false)
const successMessage = ref('')
const errorSnackbar = ref(false)
const errorMessage = ref('')

// 상태 옵션
const validStatuses = [
  { title: '대기', value: '대기' },
  { title: '준비중', value: '준비중' },
  { title: '출발', value: '출발' },
  { title: '완료', value: '완료' }
]

const statusOptions = [
  { title: '전체', value: '전체' },
  ...validStatuses
]

// 테이블 헤더
const orderHeaders = [
  { title: '순번', value: 'rowIndex', width: '80px' },
  { title: '고객명', value: 'customerName', width: '150px' },
  { title: '연락처', value: 'phone', width: '150px' },
  { title: '주소', value: 'address' },
  { title: '상태', value: 'status', width: '120px' },
  { title: '상태 변경', value: 'actions', width: '150px', sortable: false }
]

// 계산된 속성
const stats = computed(() => {
  const total = orders.value.length
  const completed = orders.value.filter(order => order.status === '완료').length
  const pending = total - completed
  
  return {
    totalOrders: total,
    completedOrders: completed,
    pendingOrders: pending
  }
})

const completionRate = computed(() => {
  if (stats.value.totalOrders === 0) return 0
  return Math.round((stats.value.completedOrders / stats.value.totalOrders) * 100)
})

const filteredOrders = computed(() => {
  if (statusFilter.value === '전체') {
    return orders.value
  }
  return orders.value.filter(order => order.status === statusFilter.value)
})

// 컴포넌트 마운트
onMounted(async () => {
  await loadCurrentWork()
})

// 현재 작업 로드
const loadCurrentWork = async () => {
  ordersLoading.value = true
  try {
    const response = await axios.get('/api/delivery/current-work')
    
    if (response.data.success) {
      const data = response.data.data
      userInfo.value = {
        staffName: data.staffName,
        workDate: data.workDate,
        staffInfo: data.staffInfo || {}
      }
      
      // 주문에 updating 플래그 추가
      orders.value = data.orders.map((order: any) => ({
        ...order,
        updating: false
      }))
    } else {
      throw new Error(response.data.message)
    }
  } catch (error: any) {
    if (error.response?.status === 401) {
      // 인증 실패 시 QR 스캐너로 리다이렉트
      router.push('/qr-scanner')
      return
    }
    
    errorMessage.value = error.response?.data?.message || '작업 정보를 불러오는데 실패했습니다.'
    errorSnackbar.value = true
  } finally {
    ordersLoading.value = false
  }
}

// 주문 새로고침
const refreshOrders = async () => {
  refreshLoading.value = true
  await loadCurrentWork()
  refreshLoading.value = false
  
  successMessage.value = '주문 목록이 새로고침되었습니다.'
  successSnackbar.value = true
}

// 상태 색상 반환
const getStatusColor = (status: string) => {
  switch (status) {
    case '대기': return 'grey'
    case '준비중': return 'orange'
    case '출발': return 'blue'
    case '완료': return 'green'
    default: return 'grey'
  }
}

// 상태 업데이트 (확인 다이얼로그 표시)
const updateStatus = (order: any, newStatus: string) => {
  if (order.status === newStatus) return
  
  pendingUpdate.value = {
    order,
    newStatus,
    customerName: order.customerName
  }
  confirmDialog.value = true
}

// 상태 업데이트 확인
const confirmStatusUpdate = async () => {
  if (!pendingUpdate.value) return
  
  const { order, newStatus } = pendingUpdate.value
  
  updateLoading.value = true
  order.updating = true
  
  try {
    const response = await axios.put('/api/delivery/update-status', {
      rowIndex: order.rowIndex,
      status: newStatus,
      customerName: order.customerName
    })
    
    if (response.data.success) {
      // 주문 상태 업데이트
      order.status = newStatus
      
      successMessage.value = response.data.message
      successSnackbar.value = true
      
      // 완료 처리 시 추가 메시지
      if (newStatus === '완료' && response.data.shouldSendNotification) {
        setTimeout(() => {
          successMessage.value = '고객에게 카카오톡 알림이 발송됩니다.'
          successSnackbar.value = true
        }, 2000)
      }
    } else {
      throw new Error(response.data.message)
    }
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || '상태 업데이트에 실패했습니다.'
    errorSnackbar.value = true
  } finally {
    updateLoading.value = false
    order.updating = false
    confirmDialog.value = false
    pendingUpdate.value = null
  }
}

// 로그아웃
const logout = async () => {
  try {
    await axios.post('/api/delivery/logout')
    router.push('/qr-scanner')
  } catch (error) {
    // 에러가 발생해도 프론트엔드에서 로그아웃 처리
    router.push('/qr-scanner')
  }
}
</script>

<style scoped>
.v-container {
  max-width: 1200px;
}

.v-card-title {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.gap-2 {
  gap: 8px;
}

.v-data-table {
  border-radius: 8px;
}

.v-chip {
  font-weight: 500;
}

/* 통계 카드 글자 색상 */
.v-card.v-card--variant-elevated .v-card-text {
  color: white;
}

.v-card.v-card--variant-elevated .v-icon {
  color: rgba(255, 255, 255, 0.8);
}
</style>