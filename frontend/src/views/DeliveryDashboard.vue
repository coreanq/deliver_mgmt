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
import { useDeliveryStore } from '@/stores/deliveryStore'
import { useErrorTracker } from '@/services/ErrorTracker'

// Router & Stores
const router = useRouter()
const deliveryStore = useDeliveryStore()
const errorTracker = useErrorTracker()

// 반응형 데이터 (스토어 사용)
const userInfo = computed(() => deliveryStore.currentStaff)
const orders = computed(() => deliveryStore.orders)
const ordersLoading = computed(() => deliveryStore.loading)
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

// 계산된 속성 (스토어에서 가져오기)
const stats = computed(() => ({
  totalOrders: deliveryStore.ordersCount,
  completedOrders: deliveryStore.completedOrders,
  pendingOrders: deliveryStore.pendingOrders
}))

const completionRate = computed(() => deliveryStore.completionRate)

const filteredOrders = computed(() => 
  deliveryStore.getOrdersByStatus(statusFilter.value)
)

// 컴포넌트 마운트
onMounted(async () => {
  await loadCurrentWork()
})

// 현재 작업 로드 (스토어 사용)
const loadCurrentWork = async () => {
  try {
    await deliveryStore.loadCurrentWork()
    
    // 로드 성공 시 실시간 동기화 시작
    if (deliveryStore.isAuthenticated) {
      deliveryStore.enableRealtimeSync()
    }
  } catch (error: any) {
    if (error.response?.status === 401) {
      // 인증 실패 시 QR 스캐너로 리다이렉트
      router.push('/qr-scanner')
      return
    }
    
    errorMessage.value = error.response?.data?.message || '작업 정보를 불러오는데 실패했습니다.'
    errorSnackbar.value = true
  }
}

// 주문 새로고침 (스토어 사용)
const refreshOrders = async () => {
  refreshLoading.value = true
  try {
    await deliveryStore.refreshOrders()
    
    successMessage.value = '주문 목록이 새로고침되었습니다.'
    successSnackbar.value = true
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || '새로고침에 실패했습니다.'
    errorSnackbar.value = true
  } finally {
    refreshLoading.value = false
  }
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

// 상태 업데이트 확인 (스토어 사용)
const confirmStatusUpdate = async () => {
  if (!pendingUpdate.value) return
  
  const { order, newStatus } = pendingUpdate.value
  
  updateLoading.value = true
  
  try {
    const result = await deliveryStore.updateOrderStatus(order, newStatus)
    
    successMessage.value = result.message
    successSnackbar.value = true
    
    // 완료 처리 시 추가 메시지
    if (newStatus === '완료' && result.shouldSendNotification) {
      setTimeout(() => {
        successMessage.value = '고객에게 카카오톡 알림이 발송됩니다.'
        successSnackbar.value = true
      }, 2000)
    }
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || '상태 업데이트에 실패했습니다.'
    errorSnackbar.value = true
  } finally {
    updateLoading.value = false
    confirmDialog.value = false
    pendingUpdate.value = null
  }
}

// 로그아웃 (스토어 사용)
const logout = async () => {
  try {
    await deliveryStore.logout()
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
  padding: 12px;
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

/* 모바일 최적화 */
@media (max-width: 768px) {
  .v-container {
    padding: 8px;
  }
  
  /* 헤더 간소화 */
  .v-card-title {
    font-size: 1.1rem;
    padding: 12px 16px;
  }
  
  /* 통계 카드 작게 */
  .v-card-text {
    padding: 12px;
  }
  
  .text-h4 {
    font-size: 1.8rem !important;
  }
  
  .text-body-2 {
    font-size: 0.75rem !important;
  }
  
  /* 테이블 스크롤 및 최적화 */
  .v-data-table {
    font-size: 0.875rem;
  }
  
  .v-data-table th,
  .v-data-table td {
    padding: 8px 4px !important;
  }
  
  /* 버튼 크기 조정 */
  .v-btn {
    min-height: 36px;
  }
  
  .v-btn--size-small {
    min-height: 32px;
    font-size: 0.75rem;
  }
  
  /* 폼 요소 간격 */
  .v-select {
    min-width: 100px !important;
  }
  
  /* 모달 최적화 */
  .v-dialog .v-card {
    margin: 16px;
    max-width: calc(100vw - 32px);
  }
}

/* 터치 친화적 버튼 */
@media (hover: none) and (pointer: coarse) {
  .v-btn {
    min-height: 44px; /* iOS 권장 최소 터치 타겟 */
  }
  
  .v-chip {
    min-height: 40px;
    padding: 0 12px;
  }
  
  /* 테이블 행 높이 증가 */
  .v-data-table .v-data-table__tr {
    height: 56px;
  }
}

/* 가로 스크롤 방지 */
.v-data-table-wrapper {
  overflow-x: auto;
}
</style>