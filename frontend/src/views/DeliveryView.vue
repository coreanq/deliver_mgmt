<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="text-h5">
            <v-icon start>mdi-truck-delivery</v-icon>
            {{ authStore.currentStaffName }}님의 배송 목록
          </v-card-title>
          
          <v-card-subtitle>
            전체 {{ deliveryOrders.length }}건 | 완료 {{ completedCount }}건 | 진행률 {{ progressPercentage }}%
          </v-card-subtitle>

          <v-card-text>
            <!-- Loading state -->
            <div v-if="loading" class="text-center pa-4">
              <v-progress-circular indeterminate color="primary" />
              <p class="mt-2">배송 목록을 불러오는 중...</p>
            </div>

            <!-- No orders -->
            <div v-else-if="deliveryOrders.length === 0" class="text-center pa-4">
              <v-icon size="64" color="grey">mdi-inbox</v-icon>
              <p class="text-h6 mt-2">배송할 주문이 없습니다</p>
              <p class="text-body-2">새로운 주문이 등록되면 자동으로 표시됩니다.</p>
            </div>

            <!-- Orders list -->
            <v-list v-else>
              <v-list-item
                v-for="(order, index) in deliveryOrders"
                :key="index"
                class="border mb-3 pa-4"
              >
                <div class="w-100">
                  <v-row align="center">
                    <v-col cols="12" md="6">
                      <div>
                        <p class="text-h6 mb-1">{{ order.customerName }}</p>
                        <p class="text-body-2 mb-1">
                          <v-icon size="16" class="mr-1">mdi-phone</v-icon>
                          {{ order.phone }}
                        </p>
                        <p class="text-body-2">
                          <v-icon size="16" class="mr-1">mdi-map-marker</v-icon>
                          {{ order.address }}
                        </p>
                      </div>
                    </v-col>
                    
                    <v-col cols="12" md="6">
                      <div class="text-right">
                        <v-chip
                          :color="getStatusColor(order.status)"
                          class="mb-2"
                        >
                          {{ order.status }}
                        </v-chip>
                        
                        <div class="mt-2">
                          <v-btn
                            v-if="order.status === '대기'"
                            color="orange"
                            variant="elevated"
                            size="small"
                            @click="updateStatus(index, '준비중')"
                            :loading="updatingStatus[index]"
                            class="mr-2 mb-2"
                          >
                            준비중
                          </v-btn>
                          
                          <v-btn
                            v-if="order.status === '준비중'"
                            color="blue"
                            variant="elevated"
                            size="small"
                            @click="updateStatus(index, '출발')"
                            :loading="updatingStatus[index]"
                            class="mr-2 mb-2"
                          >
                            출발
                          </v-btn>
                          
                          <v-btn
                            v-if="order.status === '출발'"
                            color="success"
                            variant="elevated"
                            size="small"
                            @click="updateStatus(index, '완료')"
                            :loading="updatingStatus[index]"
                            class="mb-2"
                          >
                            배송 완료
                          </v-btn>
                          
                          <v-icon
                            v-if="order.status === '완료'"
                            color="success"
                            size="32"
                          >
                            mdi-check-circle
                          </v-icon>
                        </div>
                      </div>
                    </v-col>
                  </v-row>
                </div>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Refresh button - positioned above feedback button -->
    <v-fab
      icon="mdi-refresh"
      location="bottom end"
      size="large"
      color="primary"
      @click="refreshOrders"
      :loading="refreshing"
      style="bottom: 80px !important;"
    />
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import type { DeliveryOrder, DeliveryStatus } from '../types';

const router = useRouter();
const authStore = useAuthStore();

// Check authentication
if (!authStore.isDeliveryAuthenticated) {
  router.push('/delivery/auth');
}

// Data states
const deliveryOrders = ref<DeliveryOrder[]>([]);
const loading = ref(true);
const refreshing = ref(false);
const updatingStatus = ref<{ [key: number]: boolean }>({});

// Auto-refresh interval
let refreshInterval: NodeJS.Timeout | null = null;

// Computed properties
const completedCount = computed(() => 
  deliveryOrders.value.filter(order => order.status === '완료').length
);

const progressPercentage = computed(() => {
  if (deliveryOrders.value.length === 0) return 0;
  return Math.round((completedCount.value / deliveryOrders.value.length) * 100);
});

onMounted(() => {
  loadOrders();
  // Set up auto-refresh every 30 seconds
  refreshInterval = setInterval(loadOrders, 30000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

const loadOrders = async (): Promise<void> => {
  try {
    // TODO: Implement API call to load orders for current staff
    // const response = await api.getDeliveryOrders(authStore.currentStaffName);
    
    // Mock data for now
    deliveryOrders.value = [
      {
        customerName: '김고객',
        phone: '010-1234-5678',
        address: '서울시 강남구 테헤란로 123',
        status: '대기',
      },
      {
        customerName: '이고객',
        phone: '010-9876-5432',
        address: '서울시 서초구 서초대로 456',
        status: '준비중',
      },
    ];
    
    console.log('Orders loaded for:', authStore.currentStaffName);
  } catch (error) {
    console.error('Failed to load orders:', error);
  } finally {
    loading.value = false;
  }
};

const refreshOrders = async (): Promise<void> => {
  refreshing.value = true;
  await loadOrders();
  refreshing.value = false;
};

const updateStatus = async (orderIndex: number, newStatus: DeliveryStatus): Promise<void> => {
  updatingStatus.value[orderIndex] = true;

  try {
    // TODO: Implement API call to update status
    // const response = await api.updateDeliveryStatus(
    //   authStore.currentStaffName,
    //   orderIndex,
    //   newStatus
    // );

    // Update local state
    deliveryOrders.value[orderIndex].status = newStatus;
    
    // If status is '완료', show completion message
    if (newStatus === '완료') {
      // TODO: This should trigger customer notification via SOLAPI
      console.log('Delivery completed for:', deliveryOrders.value[orderIndex].customerName);
    }
    
  } catch (error) {
    console.error('Failed to update status:', error);
  } finally {
    updatingStatus.value[orderIndex] = false;
  }
};

const getStatusColor = (status: DeliveryStatus): string => {
  switch (status) {
    case '대기': return 'grey';
    case '준비중': return 'orange';
    case '출발': return 'blue';
    case '완료': return 'success';
    default: return 'grey';
  }
};

// Mock QR verification for development - remove these in production
</script>