<template>
  <div 
    class="mobile-wrapper"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- Pull to Refresh Indicator -->
    <div 
      v-if="pullToRefreshActive" 
      class="pull-refresh-indicator"
      :class="{ 'pull-refresh-triggered': pullDistance > pullThreshold }"
    >
      <v-progress-circular 
        v-if="loading" 
        indeterminate 
        color="primary" 
        size="24"
      />
      <v-icon v-else size="24" color="primary">
        {{ pullDistance > pullThreshold ? 'mdi-refresh' : 'mdi-arrow-down' }}
      </v-icon>
      <span class="refresh-text">
        {{ loading ? '새로고침 중...' : (pullDistance > pullThreshold ? '손을 떼어 새로고침' : '당겨서 새로고침') }}
      </span>
    </div>

  <v-container class="mobile-container">
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

    <!-- Status Filter Tabs - Mobile Optimized -->
    <v-row v-if="!loading && deliveryOrders.length > 0" class="mb-4">
      <v-col cols="12">
        <v-card variant="outlined" class="filter-tabs-card">
          <v-tabs 
            v-model="selectedStatusTab" 
            color="primary" 
            grow
            class="mobile-tabs"
            slider-color="primary"
          >
            <v-tab value="all" class="mobile-tab">
              <v-icon start size="18">mdi-format-list-bulleted</v-icon>
              <span class="tab-text">전체</span>
              <v-chip size="x-small" color="primary" variant="elevated" class="ml-1">
                {{ deliveryOrders.length }}
              </v-chip>
            </v-tab>
            <v-tab value="pending" class="mobile-tab">
              <v-icon start size="18">mdi-clock-outline</v-icon>
              <span class="tab-text">미완료</span>
              <v-chip size="x-small" color="warning" variant="elevated" class="ml-1">
                {{ getPendingCount() }}
              </v-chip>
            </v-tab>
            <v-tab value="completed" class="mobile-tab">
              <v-icon start size="18">mdi-check-circle</v-icon>
              <span class="tab-text">완료</span>
              <v-chip size="x-small" color="success" variant="elevated" class="ml-1">
                {{ getCompletedCount() }}
              </v-chip>
            </v-tab>
          </v-tabs>
        </v-card>
      </v-col>
    </v-row>

    <!-- Delivery Orders List - New Design -->
    <v-row v-if="!loading && filteredOrders.length > 0">
      <v-col cols="12">
        <div
          v-for="(order, index) in filteredOrders"
          :key="order.rowIndex || index"
          class="delivery-card"
          :style="{ animationDelay: `${index * 100}ms` }"
        >
          <!-- 헤더 -->
          <div class="card-header">
            <div>
              <h2 class="customer-name">{{ getOrderTitle(order) }}</h2>
            </div>
            <span class="staff-badge">{{ staffName }}</span>
          </div>
          
          <!-- 배송지 정보 -->
          <div class="delivery-section">
            <div class="info-row">
              <div class="icon-wrapper">
                <v-icon size="16" color="grey-darken-1">mdi-map-marker</v-icon>
              </div>
              <div class="info-content">
                <div class="info-header">
                  <p class="info-label">배송지:</p>
                  <button 
                    class="copy-btn"
                    @click="copyToClipboard(getAddressValue(order), '배송지')"
                  >
                    <v-icon size="12">mdi-content-copy</v-icon>
                    복사
                  </button>
                </div>
                <p class="address-text">
                  {{ getAddressValue(order) || '-' }}
                </p>
              </div>
            </div>
          </div>
          
          <!-- 고객 연락처 -->
          <div class="contact-section">
            <div class="info-row">
              <div class="icon-wrapper">
                <v-icon size="16" color="grey-darken-1">mdi-phone</v-icon>
              </div>
              <div class="info-content">
                <p class="info-label">고객 연락처:</p>
                <div class="contact-row">
                  <span class="phone-number">{{ getPhoneValue(order) || '-' }}</span>
                  <button 
                    class="copy-btn"
                    @click="copyToClipboard(getPhoneValue(order), '고객 연락처')"
                  >
                    <v-icon size="12">mdi-content-copy</v-icon>
                    복사
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 배송 상태 -->
          <div class="status-section">
            <div class="info-row">
              <div class="icon-wrapper">
                <v-icon size="16" color="grey-darken-1">mdi-truck</v-icon>
              </div>
              <div class="info-content">
                <p class="info-label">배송상태:</p>
                <div class="status-row">
                  <span class="status-text">{{ getOrderStatus(order) }}</span>
                  <span 
                    class="status-badge"
                    :class="getStatusBadgeClass(getOrderStatus(order))"
                  >
                    {{ getStatusDisplayText(getOrderStatus(order)) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 구분선 -->
          <div class="section-divider"></div>
          
          <!-- 배송 버튼 -->
          <div class="action-section">
            <!-- 변경 가능한 상태가 있을 때만 버튼 표시 -->
            <template v-if="getAvailableStatuses(getOrderStatus(order)).length > 0">
              <button
                v-for="status in getAvailableStatuses(getOrderStatus(order))"
                :key="status"
                class="delivery-btn"
                :class="getDeliveryButtonClass(status)"
                @click="updateOrderStatus(order, status)"
                :disabled="updatingOrders[order.rowIndex]"
              >
                <v-icon size="20">{{ getStatusIcon(status) }}</v-icon>
                {{ status }}
              </button>
            </template>
            <!-- 변경 불가능한 상태일 때 안내 메시지 -->
            <template v-else>
              <div 
                v-if="getOrderStatus(order) === '배송 완료'"
                class="status-message success-message"
              >
                <v-icon size="16" color="success">mdi-check-circle</v-icon>
                배송이 완료되었습니다
              </div>
              <div 
                v-else
                class="status-message info-message"
              >
                <v-icon size="16" color="info">mdi-information</v-icon>
                배송 준비중 상태에서 변경 가능합니다
              </div>
            </template>
          </div>
        </div>
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

    <!-- Floating Action Button for Refresh -->
    <v-fab
      v-if="!loading"
      icon="mdi-refresh"
      location="bottom end"
      size="large"
      color="primary"
      @click="refreshData"
      class="refresh-fab"
      :loading="loading"
    />
    
    <!-- Bottom Spacer -->
    <div class="bottom-spacer"></div>
  </v-container>
  
  <!-- 토스트 알림 -->
  <div 
    v-if="toastVisible"
    class="toast"
    :class="{ 'toast-success': toastType === 'success', 'toast-error': toastType === 'error' }"
  >
    <div class="toast-content">
      <v-icon size="16" :color="toastType === 'success' ? 'success' : 'error'">
        {{ toastType === 'success' ? 'mdi-check-circle' : 'mdi-alert-circle' }}
      </v-icon>
      <span>{{ toastMessage }}</span>
    </div>
  </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

// Route parameters
const staffName = ref<string>(route.params.staffName as string);
const dateString = ref<string>(route.params.date as string);
const qrToken = ref<string>('');

// Data
const deliveryOrders = ref<any[]>([]);
const headers = ref<string[]>([]);
const loading = ref(false);
const error = ref<string>('');
const updatingOrders = ref<{ [key: string]: boolean }>({});
const selectedStatusTab = ref<string>('all');
const expandedAddresses = ref<{ [key: string]: boolean }>({});

// Pull to refresh
const pullToRefreshActive = ref(false);
const pullDistance = ref(0);
const pullThreshold = 80;
let startY = 0;
let currentY = 0;

// Status workflow - 전체 5단계 상태
const allStatuses = ['주문 완료', '상품 준비중', '배송 준비중', '배송 출발', '배송 완료'];
// 배달담당자가 변경 가능한 상태들
const deliveryStaffStatuses = ['배송 준비중', '배송 출발', '배송 완료'];

// Computed properties
const statusColumn = computed(() => {
  // Find status column from headers - prioritize '상태' over '배달'
  const foundColumn = headers.value.find(header => 
    header.includes('상태')
  ) || headers.value[4] || '배송상태'; // 배송상태는 5번째 컬럼 (index 4)
  
  return foundColumn;
});

const displayHeaders = computed(() => {
  // Show important headers including status
  return headers.value.filter(header => 
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

const getStatusIcon = (status: string): string => {
  switch (status) {
    case '주문 완료': return 'mdi-clipboard-check';
    case '상품 준비중': return 'mdi-package-variant';
    case '배송 준비중': return 'mdi-truck-fast';
    case '배송 출발': return 'mdi-truck-delivery';
    case '배송 완료': return 'mdi-check-circle';
    default: return 'mdi-help-circle';
  }
};

const isAddressLong = (address: string): boolean => {
  return (address && address.length > 30) || false;
};

const toggleAddressExpansion = (rowIndex: number): void => {
  expandedAddresses.value[rowIndex] = !expandedAddresses.value[rowIndex];
};

const getAvailableStatuses = (currentStatus: string): string[] => {
  // 배달담당자는 배송 준비중 상태에서만 버튼 활성화
  const currentStatusValue = currentStatus || '주문 완료';
  
  // 배송 준비중 → 배송 출발 → 배송 완료 순서로만 변경 가능
  const trimmedStatus = currentStatusValue.trim();
  
  switch (trimmedStatus) {
    case '배송 준비중':
      return ['배송 출발']; // 배송 출발로만 변경 가능
    case '배송 출발':
      return ['배송 완료']; // 배송 완료로만 변경 가능
    case '주문 완료':
    case '상품 준비중':
    case '배송 완료':
      return []; // 버튼 비활성화
    default:
      return []; // 버튼 비활성화
  }
};

// Helper function - 주문의 배송 상태를 가져오는 함수
const getOrderStatus = (order: any): string => {
  return order[statusColumn.value] || order['배송상태'] || '미상';
};

// Helper functions for dynamic field access
const getAddressValue = (order: any): string => {
  const addressHeaders = headers.value.filter(header => 
    header.includes('배송지') || header.includes('주소')
  );
  return addressHeaders.length > 0 ? (order[addressHeaders[0]] || '') : '';
};

const getPhoneValue = (order: any): string => {
  const phoneHeaders = headers.value.filter(header => 
    header.includes('연락처') || header.includes('전화')
  );
  return phoneHeaders.length > 0 ? (order[phoneHeaders[0]] || '') : '';
};

const getStatusDisplayText = (status: string): string => {
  switch (status) {
    case '주문 완료': return '주문완료';
    case '상품 준비중': return '준비중';
    case '배송 준비중': return '준비중';
    case '배송 출발': return '배송중';
    case '배송 완료': return '완료';
    default: return '미상';
  }
};

const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case '주문 완료': return 'status-order';
    case '상품 준비중': return 'status-product';
    case '배송 준비중': return 'status-preparing';
    case '배송 출발': return 'status-shipping';
    case '배송 완료': return 'status-completed';
    default: return 'status-unknown';
  }
};

const getDeliveryButtonClass = (status: string): string => {
  switch (status) {
    case '배송 출발': return 'btn-shipping';
    case '배송 완료': return 'btn-completed';
    default: return 'btn-default';
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
    const token = urlParams.get('token');
    
    if (token) {
      // Store QR token for later use
      qrToken.value = token;
      
      // Verify QR token first
      const verifyResponse = await fetch(
        `http://localhost:5001/api/delivery/qr/verify/${token}`,
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
  
  // 현재 스크롤 위치 저장
  const scrollPosition = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  
  updatingOrders.value[rowIndex] = true;
  
  try {
    // Prepare headers with QR token if available
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
    };
    
    if (qrToken.value) {
      headers['Authorization'] = `Bearer ${qrToken.value}`;
    }
    
    const response = await fetch(
      `http://localhost:5001/api/sheets/data/${dateString.value}/status`,
      {
        method: 'PUT',
        headers,
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
      showToast(`배송 상태가 "${newStatus}"로 변경되었습니다!`);
      // Refresh data from server to sync with spreadsheet
      await loadDeliveryData();
      
      // 데이터 로딩 완료 후 스크롤 위치 복원
      await nextTick();
      window.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      });
    } else {
      error.value = result.message || '상태 업데이트에 실패했습니다.';
      showToast('상태 업데이트에 실패했습니다.', 'error');
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

// Pull to refresh handlers
const handleTouchStart = (e: TouchEvent): void => {
  if (window.scrollY === 0) {
    startY = e.touches[0].clientY;
    pullToRefreshActive.value = true;
  }
};

const handleTouchMove = (e: TouchEvent): void => {
  if (!pullToRefreshActive.value || loading.value) return;
  
  currentY = e.touches[0].clientY;
  pullDistance.value = Math.max(0, (currentY - startY) * 0.5);
  
  if (pullDistance.value > 0) {
    e.preventDefault();
  }
};

const handleTouchEnd = (): void => {
  if (!pullToRefreshActive.value) return;
  
  if (pullDistance.value > pullThreshold && !loading.value) {
    refreshData();
  }
  
  pullToRefreshActive.value = false;
  pullDistance.value = 0;
  startY = 0;
  currentY = 0;
};

const copyToClipboard = async (text: string, fieldName: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${fieldName}가 복사되었습니다!`);
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
      showToast(`${fieldName}가 복사되었습니다!`);
    } catch (fallbackError) {
      console.error('폴백 복사도 실패:', fallbackError);
      showToast('복사에 실패했습니다.', 'error');
    }
  }
};

// 토스트 메시지 상태
const toastVisible = ref(false);
const toastMessage = ref('');
const toastType = ref<'success' | 'error'>('success');

// 토스트 메시지 표시 함수
const showToast = (message: string, type: 'success' | 'error' = 'success'): void => {
  toastMessage.value = message;
  toastType.value = type;
  toastVisible.value = true;
  
  setTimeout(() => {
    toastVisible.value = false;
  }, 3000);
};

// Initialize data loading
onMounted(() => {
  loadDeliveryData();
});
</script>

<style scoped>
/* 모바일 래퍼 */
.mobile-wrapper {
  position: relative;
  overflow-x: hidden;
}

/* Pull to refresh */
.pull-refresh-indicator {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1001;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 0 0 16px 16px;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.pull-refresh-indicator.pull-refresh-triggered {
  background: rgba(33, 150, 243, 0.95);
  color: white;
}

.refresh-text {
  font-size: 14px;
  font-weight: 500;
}

/* 모바일 컨테이너 */
.mobile-container {
  background-color: #fafafa;
  min-height: 100vh;
  padding: 12px;
  max-width: 100%;
}

/* 카드 스타일 */
.v-card {
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  margin-bottom: 16px;
}

.v-btn {
  border-radius: 12px;
  text-transform: none;
  font-weight: 500;
}

/* 주문 내용 섹션 */
.order-details {
  margin-bottom: 20px;
}

.detail-item {
  margin-bottom: 16px;
}

/* 배송지 섹션 */
.delivery-address-section {
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  border-radius: 12px;
  padding: 16px;
  border-left: 4px solid #1976d2;
  margin-bottom: 8px;
}

.address-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.address-content {
  position: relative;
}

.address-text {
  font-size: 18px;
  font-weight: 600;
  color: #1565c0;
  line-height: 1.5;
  cursor: pointer;
  transition: all 0.3s ease;
  max-height: 48px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.address-content.address-expanded .address-text {
  max-height: none;
  -webkit-line-clamp: unset;
}

.expand-btn {
  margin-top: 8px;
  font-size: 12px;
}

/* 전화번호 섹션 */
.phone-section {
  background-color: #e8f5e8;
  border-radius: 12px;
  padding: 16px;
  border-left: 4px solid #4caf50;
}

.phone-link {
  color: #2e7d32;
  text-decoration: none;
  font-weight: 600;
  font-size: 16px;
}

.phone-link:hover {
  text-decoration: underline;
}

/* 고객명 섹션 */
.customer-section {
  background-color: #fff3e0;
  border-radius: 12px;
  padding: 16px;
  border-left: 4px solid #ff9800;
}

.customer-name {
  font-size: 18px;
  font-weight: 700;
  color: #f57c00;
}

/* 기타 정보 섹션 */
.other-info-section {
  padding: 12px 16px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

/* 필드 레이아웃 */
.field-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.field-label {
  font-size: 14px;
  font-weight: 500;
  color: #666;
  min-width: 80px;
  flex-shrink: 0;
}

.field-value {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  text-align: right;
}

.field-value-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: flex-end;
}

/* 복사 버튼 */
.copy-btn {
  min-width: 60px !important;
  height: 36px !important;
  font-size: 12px;
  padding: 0 12px;
  flex-shrink: 0;
}

/* 탭 네비게이션 */
.filter-tabs-card {
  background: linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.mobile-tabs {
  height: 60px;
}

.mobile-tab {
  font-size: 13px;
  font-weight: 600;
  text-transform: none;
  padding: 8px 4px;
  min-width: auto;
}

.tab-text {
  display: inline;
}

/* 플로팅 버튼 */
.refresh-fab {
  margin-bottom: 20px;
  margin-right: 20px;
  z-index: 1000;
}

.bottom-spacer {
  height: 80px;
}

/* 새로운 카드 디자인 */
.delivery-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease-out;
  animation: cardEnter 0.3s ease-out;
}

.delivery-card:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
}

/* 카드 헤더 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.customer-name {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.staff-badge {
  background: #1976d2;
  color: white;
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
}

/* 정보 행 */
.info-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.icon-wrapper {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.info-content {
  flex: 1;
}

.info-label {
  font-size: 14px;
  font-weight: 500;
  color: #666;
  margin: 0 0 4px 0;
}

.info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

/* 주소 텍스트 */
.address-text {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
  margin: 0;
}

/* 연락처 행 */
.contact-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.phone-number {
  font-size: 14px;
  color: #1a1a1a;
  font-family: 'Roboto Mono', monospace;
  font-weight: 500;
}

/* 상태 행 */
.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-text {
  font-size: 14px;
  color: #1a1a1a;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
}

.status-order { background: #90caf9; color: #1565c0; }
.status-product { background: #ffcc02; color: #f57c00; }
.status-preparing { background: #ff9800; color: white; }
.status-shipping { background: #2196f3; color: white; }
.status-completed { background: #4caf50; color: white; }
.status-unknown { background: #9e9e9e; color: white; }

/* 복사 버튼 */
.copy-btn {
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s ease-out;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.copy-btn:hover {
  background: #1976d2;
  color: white;
  border-color: #1976d2;
  transform: scale(1.05);
}

.copy-btn:active {
  transform: scale(0.95);
}

/* 구분선 */
.section-divider {
  border-top: 1px solid #e0e0e0;
  margin: 20px 0;
}

/* 액션 섹션 */
.action-section {
  margin-top: 20px;
}

/* 배송 버튼 */
.delivery-btn {
  border: none;
  border-radius: 12px;
  padding: 14px 24px;
  font-size: 14px;
  font-weight: 600;
  width: 100%;
  cursor: pointer;
  transition: all 0.15s ease-out;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  position: relative;
  overflow: hidden;
}

/* 기본 배송 준비중 → 배송 출발 버튼 */
.delivery-btn.btn-default,
.delivery-btn.btn-shipping {
  background: #ff9800;
  color: white;
}

.delivery-btn.btn-default:hover:not(:disabled),
.delivery-btn.btn-shipping:hover:not(:disabled) {
  background: #f57c00;
  transform: scale(1.02);
  box-shadow: 0 4px 16px rgba(255, 152, 0, 0.4);
}

/* 배송 완료 버튼 */
.delivery-btn.btn-completed {
  background: #4caf50;
  color: white;
}

.delivery-btn.btn-completed:hover:not(:disabled) {
  background: #45a049;
  transform: scale(1.02);
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.4);
}

.delivery-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.delivery-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 상태 메시지 */
.status-message {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.success-message {
  background: #e8f5e8;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}

.info-message {
  background: #e3f2fd;
  color: #1976d2;
  border: 1px solid #bbdefb;
}

/* 토스트 알림 */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  animation: toastSlideIn 0.3s ease-out;
}

.toast-success {
  background: #e8f5e8;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}

.toast-error {
  background: #ffebee;
  color: #d32f2f;
  border: 1px solid #ffcdd2;
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

/* 애니메이션 */
@keyframes cardEnter {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes toastSlideIn {
  from {
    opacity: 0;
    transform: translateY(-100px) translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateY(0) translateX(0);
  }
}

/* 데스크탑 대응 */
@media (min-width: 768px) {
  .mobile-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 24px;
  }
  
  .status-btn {
    flex: none;
    min-width: 160px;
  }
}

/* 모바일 최적화 */
@media (max-width: 480px) {
  .mobile-container {
    padding: 8px;
  }
  
  .field-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .field-label {
    min-width: auto;
  }
  
  .field-value-group {
    width: 100%;
    justify-content: space-between;
  }
  
  .address-text {
    font-size: 16px;
  }
  
  .customer-name {
    font-size: 16px;
  }
  
  .status-btn {
    min-width: 100%;
    margin-bottom: 8px;
  }
  
  .copy-btn {
    min-width: 50px !important;
  }
  
  .tab-text {
    font-size: 11px;
  }
  
  .mobile-tab {
    padding: 6px 2px;
    font-size: 11px;
  }
  
  .refresh-fab {
    margin-bottom: 16px;
    margin-right: 16px;
  }
}
</style>