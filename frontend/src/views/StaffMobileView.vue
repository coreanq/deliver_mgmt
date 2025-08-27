<template>
  <v-container class="pa-4" style="max-width: 600px;">
    <!-- Header Section -->
    <v-row class="mb-4">
      <v-col cols="12">
        <v-card variant="outlined" class="text-center">
          <v-card-title class="text-h5 py-4">
            <v-icon start color="primary">mdi-truck-delivery</v-icon>
            {{ staffName }} 배달 현황
          </v-card-title>
          <v-card-subtitle>
            {{ formatDateDisplay(dateString) }}
          </v-card-subtitle>
        </v-card>
      </v-col>
    </v-row>

    <!-- Loading State -->
    <v-row v-if="loading" class="mb-4">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
        <p class="mt-4">데이터 로딩 중...</p>
      </v-col>
    </v-row>

    <!-- Statistics Cards -->
    <v-row v-if="!loading && deliveryOrders.length > 0" class="mb-4">
      <v-col cols="6">
        <v-card variant="outlined" class="text-center">
          <v-card-text class="py-3">
            <v-icon size="32" color="primary" class="mb-2">mdi-format-list-numbered</v-icon>
            <h3>{{ deliveryOrders.length }}</h3>
            <p class="text-caption">총 배달 건수</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6">
        <v-card variant="outlined" class="text-center">
          <v-card-text class="py-3">
            <v-icon size="32" color="success" class="mb-2">mdi-check-circle</v-icon>
            <h3>{{ completedCount }}</h3>
            <p class="text-caption">완료된 배달</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Delivery Progress -->
    <v-row v-if="!loading && deliveryOrders.length > 0" class="mb-4">
      <v-col cols="12">
        <v-card variant="outlined">
          <v-card-title class="text-h6">배달 진행률</v-card-title>
          <v-card-text>
            <v-progress-linear
              :model-value="progressPercentage"
              height="20"
              color="success"
              class="mb-2"
            >
              <template #default="{ value }">
                <strong>{{ Math.ceil(value) }}%</strong>
              </template>
            </v-progress-linear>
            <p class="text-caption text-center">
              {{ completedCount }} / {{ deliveryOrders.length }} 완료
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Status Filter Tabs -->
    <v-row v-if="!loading && deliveryOrders.length > 0" class="mb-4">
      <v-col cols="12">
        <v-tabs v-model="selectedStatusTab" color="primary" grow>
          <v-tab value="all">전체 ({{ deliveryOrders.length }})</v-tab>
          <v-tab value="pending">배송 미완료 ({{ getPendingCount() }})</v-tab>
          <v-tab value="completed">배송 완료 ({{ getCompletedCount() }})</v-tab>
        </v-tabs>
      </v-col>
    </v-row>

    <!-- Delivery Orders List -->
    <v-row v-if="!loading && filteredOrders.length > 0">
      <v-col cols="12">
        <v-card
          v-for="(order, index) in filteredOrders"
          :key="order.rowIndex || index"
          class="mb-3"
          variant="outlined"
        >
          <v-card-text class="pb-2">
            <!-- Order Header -->
            <div class="d-flex justify-space-between align-center mb-2">
              <h3 class="text-h6">{{ getOrderTitle(order) }}</h3>
              <v-chip
                color="primary"
                size="small"
                variant="outlined"
              >
                {{ staffName }}
              </v-chip>
            </div>

            <!-- Order Details -->
            <div class="mb-3">
              <!-- 배송지 - 특별 처리 -->
              <div 
                v-for="header in displayHeaders" 
                :key="header"
                class="mb-2"
              >
                <div v-if="header.includes('배송지')" class="delivery-address">
                  <div class="d-flex justify-space-between align-center mb-1">
                    <span class="text-body-2 text-grey">{{ header }}:</span>
                    <v-btn
                      size="x-small"
                      variant="outlined"
                      color="primary"
                      @click="copyToClipboard(order[header] || '', header)"
                    >
                      <v-icon size="12">mdi-content-copy</v-icon>
                    </v-btn>
                  </div>
                  <div class="address-content">
                    {{ order[header] || '-' }}
                  </div>
                </div>
                <!-- 전화번호 - 복사 버튼 포함 -->
                <div v-else-if="header.includes('연락처') || header.includes('전화')" class="d-flex justify-space-between align-center">
                  <span class="text-body-2 text-grey">{{ header }}:</span>
                  <div class="d-flex align-center gap-2">
                    <span class="text-body-2 font-weight-medium">{{ order[header] || '-' }}</span>
                    <v-btn
                      size="x-small"
                      variant="outlined"
                      color="primary"
                      @click="copyToClipboard(order[header] || '', header)"
                    >
                      <v-icon size="12">mdi-content-copy</v-icon>
                    </v-btn>
                  </div>
                </div>
                <!-- 고객명 - 복사 버튼 포함 -->
                <div v-else-if="header.includes('고객명') || header.includes('이름')" class="d-flex justify-space-between align-center">
                  <span class="text-body-2 text-grey">{{ header }}:</span>
                  <div class="d-flex align-center gap-2">
                    <span class="text-body-2 font-weight-medium">{{ order[header] || '-' }}</span>
                    <v-btn
                      size="x-small"
                      variant="outlined"
                      color="primary"
                      @click="copyToClipboard(order[header] || '', header)"
                    >
                      <v-icon size="12">mdi-content-copy</v-icon>
                    </v-btn>
                  </div>
                </div>
                <!-- 기타 필드 -->
                <div v-else class="d-flex justify-space-between align-center">
                  <span class="text-body-2 text-grey">{{ header }}:</span>
                  <span class="text-body-2 font-weight-medium">{{ order[header] || '-' }}</span>
                </div>
              </div>
            </div>

            <!-- Status Update Buttons -->
            <div class="d-flex gap-2 flex-wrap">
              <v-btn
                v-for="status in getAvailableStatuses(order[statusColumn])"
                :key="status"
                :color="getStatusColor(status)"
                size="small"
                variant="elevated"
                @click="updateOrderStatus(order, status)"
                :loading="updatingOrders[order.rowIndex]"
              >
                {{ status }}
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- No Orders Message -->
    <v-row v-if="!loading && deliveryOrders.length === 0">
      <v-col cols="12">
        <v-card variant="outlined" class="text-center py-8">
          <v-icon size="64" color="grey-lighten-2" class="mb-4">mdi-package-variant</v-icon>
          <h3 class="text-h6 mb-2">배달 건이 없습니다</h3>
          <p class="text-body-2 text-grey">
            {{ staffName }}님에게 할당된 {{ formatDateDisplay(dateString) }} 배달이 없습니다.
          </p>
        </v-card>
      </v-col>
    </v-row>

    <!-- Error State -->
    <v-row v-if="error">
      <v-col cols="12">
        <v-alert type="error" variant="outlined">
          {{ error }}
        </v-alert>
      </v-col>
    </v-row>

    <!-- Refresh Button -->
    <v-row class="mt-4">
      <v-col cols="12">
        <v-btn
          color="primary"
          variant="outlined"
          block
          @click="refreshData"
          :loading="loading"
        >
          <v-icon start>mdi-refresh</v-icon>
          새로고침
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

// Route parameters
const staffName = ref<string>(route.params.staffName as string);
const dateString = ref<string>(route.params.date as string);

// Data
const deliveryOrders = ref<any[]>([]);
const headers = ref<string[]>([]);
const loading = ref(false);
const error = ref<string>('');
const updatingOrders = ref<{ [key: string]: boolean }>({});
const selectedStatusTab = ref<string>('all');

// Status workflow - 전체 5단계 상태
const allStatuses = ['주문 완료', '상품 준비중', '배송 준비중', '배송 출발', '배송 완료'];
// 배달담당자가 변경 가능한 상태들
const deliveryStaffStatuses = ['배송 준비중', '배송 출발', '배송 완료'];

// Computed properties
const statusColumn = computed(() => {
  // Find status column from headers (usually contains '상태' or '배달상태')
  return headers.value.find(header => 
    header.includes('상태') || header.includes('배달')
  ) || headers.value[3] || '배달상태'; // Default to 4th column (D) or fallback
});

const displayHeaders = computed(() => {
  // Show important headers excluding status (which is shown separately)
  return headers.value.filter(header => 
    header !== statusColumn.value && 
    header !== 'rowIndex' && 
    header !== 'staffName'
  );
});

const completedCount = computed(() => {
  return deliveryOrders.value.filter(order => order[statusColumn.value] === '배송 완료').length;
});

const progressPercentage = computed(() => {
  if (deliveryOrders.value.length === 0) return 0;
  return (completedCount.value / deliveryOrders.value.length) * 100;
});

const filteredOrders = computed(() => {
  if (selectedStatusTab.value === 'all') {
    return deliveryOrders.value;
  }
  if (selectedStatusTab.value === 'pending') {
    // 배송 미완료: 배송 완료가 아닌 모든 상태
    return deliveryOrders.value.filter(order => order[statusColumn.value] !== '배송 완료');
  }
  if (selectedStatusTab.value === 'completed') {
    // 배송 완료: 배송 완료 상태만
    return deliveryOrders.value.filter(order => order[statusColumn.value] === '배송 완료');
  }
  return deliveryOrders.value;
});

// Methods
const formatDateDisplay = (dateStr: string): string => {
  if (dateStr && dateStr.length === 8) {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return `${year}년 ${month}월 ${day}일`;
  }
  return dateStr;
};

const getOrderTitle = (order: any): string => {
  // Try to find customer name in common header patterns
  const nameHeaders = headers.value.filter(header => 
    header.includes('이름') || header.includes('고객') || header.includes('성명')
  );
  
  if (nameHeaders.length > 0) {
    return order[nameHeaders[0]] || `배달 #${order.rowIndex}`;
  }
  
  // Fallback to first non-status column or row index
  const firstHeader = headers.value.find(header => header !== statusColumn.value);
  return firstHeader ? (order[firstHeader] || `배달 #${order.rowIndex}`) : `배달 #${order.rowIndex}`;
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case '주문 완료': return 'blue-grey';
    case '상품 준비중': return 'orange';
    case '배송 준비중': return 'warning';
    case '배송 출발': return 'info';
    case '배송 완료': return 'success';
    default: return 'grey';
  }
};

const getAvailableStatuses = (currentStatus: string): string[] => {
  // 배달담당자는 배송 준비중, 배송 출발, 배송 완료만 변경 가능
  const currentStatusValue = currentStatus || '주문 완료';
  
  // 현재 상태에 따른 다음 가능한 상태들
  switch (currentStatusValue) {
    case '주문 완료':
    case '상품 준비중':
      return ['배송 준비중']; // 배송 준비중으로만 변경 가능
    case '배송 준비중':
      return ['배송 출발']; // 배송 출발로만 변경 가능
    case '배송 출발':
      return ['배송 완료']; // 배송 완료로만 변경 가능
    case '배송 완료':
      return []; // 완료됨, 더 이상 변경 불가
    default:
      return ['배송 준비중']; // 알 수 없는 상태는 배송 준비중으로
  }
};

const getPendingCount = (): number => {
  return deliveryOrders.value.filter(order => order[statusColumn.value] !== '배송 완료').length;
};

const getCompletedCount = (): number => {
  return deliveryOrders.value.filter(order => order[statusColumn.value] === '배송 완료').length;
};

const loadDeliveryData = async (): Promise<void> => {
  if (!staffName.value || !dateString.value) return;
  
  loading.value = true;
  error.value = '';
  
  try {
    // Check if QR token is provided for additional security
    const urlParams = new URLSearchParams(window.location.search);
    const qrToken = urlParams.get('token');
    
    if (qrToken) {
      // Verify QR token first
      const verifyResponse = await fetch(
        `http://localhost:5001/api/delivery/qr/verify/${qrToken}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );
      
      const verifyResult = await verifyResponse.json();
      
      if (!verifyResult.success || verifyResult.data.staffName !== staffName.value) {
        error.value = '유효하지 않은 QR 코드입니다.';
        return;
      }
      
      console.log('QR token verified for staff:', staffName.value);
    }
    
    const response = await fetch(
      `http://localhost:5001/api/sheets/date/${dateString.value}/staff/${staffName.value}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      deliveryOrders.value = result.data || [];
      headers.value = result.headers || [];
      console.log('Staff delivery data loaded:', result.data);
    } else {
      error.value = result.message || '데이터를 불러올 수 없습니다.';
      deliveryOrders.value = [];
      headers.value = [];
    }
  } catch (err) {
    console.error('Failed to load delivery data:', err);
    error.value = '서버 연결에 실패했습니다.';
    deliveryOrders.value = [];
    headers.value = [];
  } finally {
    loading.value = false;
  }
};

const updateOrderStatus = async (order: any, newStatus: string): Promise<void> => {
  const rowIndex = order.rowIndex;
  if (!rowIndex) return;
  
  updatingOrders.value[rowIndex] = true;
  
  try {
    const response = await fetch(
      `http://localhost:5001/api/sheets/data/${dateString.value}/status`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          rowIndex: rowIndex,
          status: newStatus,
        }),
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`Status updated for row ${rowIndex}: ${newStatus}`);
      // Refresh data from server to sync with spreadsheet
      await loadDeliveryData();
    } else {
      error.value = result.message || '상태 업데이트에 실패했습니다.';
    }
  } catch (err) {
    console.error('Failed to update status:', err);
    error.value = '상태 업데이트 중 오류가 발생했습니다.';
  } finally {
    updatingOrders.value[rowIndex] = false;
  }
};

const refreshData = (): void => {
  loadDeliveryData();
};

const copyToClipboard = async (text: string, fieldName: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    // 간단한 피드백 - 실제로는 toast 메시지를 사용할 수 있음
    console.log(`${fieldName} 복사됨: ${text}`);
  } catch (err) {
    console.error('복사 실패:', err);
    // 폴백: 텍스트 선택 방식
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      console.log(`${fieldName} 복사됨 (폴백): ${text}`);
    } catch (fallbackError) {
      console.error('폴백 복사도 실패:', fallbackError);
    }
  }
};

// Initialize data loading
onMounted(() => {
  loadDeliveryData();
});
</script>

<style scoped>
.v-container {
  background-color: #fafafa;
  min-height: 100vh;
}

.v-card {
  border-radius: 12px;
}

.v-btn {
  border-radius: 8px;
}

/* 배송지 스타일 */
.delivery-address {
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 12px;
  border-left: 4px solid #1976d2;
}

.address-content {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1565c0;
  line-height: 1.4;
  margin-top: 4px;
}

/* 복사 버튼 스타일 */
.v-btn--size-x-small {
  min-width: 32px !important;
  width: 32px;
  height: 24px;
}

/* 간격 조정 */
.gap-2 {
  gap: 8px;
}

@media (max-width: 600px) {
  .v-container {
    padding: 8px;
  }
  
  .address-content {
    font-size: 1rem;
  }
}
</style>