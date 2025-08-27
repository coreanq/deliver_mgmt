<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="text-h5">
            <v-icon start>mdi-cog</v-icon>
            관리자 설정
          </v-card-title>
          
          <v-card-text>
            <v-row>
              <!-- Google Sheets Integration -->
              <v-col cols="12" md="6">
                <v-card variant="outlined">
                  <v-card-title class="text-h6">
                    <v-icon start>mdi-google</v-icon>
                    구글 스프레드시트 연동
                  </v-card-title>
                  
                  <v-card-text>
                    <v-chip
                      :color="authStore.isGoogleAuthenticated ? 'success' : 'error'"
                      class="mb-4"
                    >
                      {{ authStore.isGoogleAuthenticated ? '연결됨' : '연결 안됨' }}
                    </v-chip>
                    
                    <div v-if="!authStore.isGoogleAuthenticated">
                      <p class="mb-4">구글 스프레드시트와 연동하여 주문 데이터를 관리합니다.</p>
                      <v-btn
                        color="primary"
                        variant="elevated"
                        @click="connectGoogleSheets"
                        :loading="googleLoading"
                      >
                        <v-icon start>mdi-google</v-icon>
                        구글 스프레드시트 연결하기
                      </v-btn>
                    </div>
                    
                    <div v-else>
                      <div class="d-flex align-center mb-4">
                        <p class="mb-0 mr-4">Google Sheets 연결됨</p>
                        <v-chip color="success" size="small">{{ authStore.googleSpreadsheets.length }}개 스프레드시트</v-chip>
                      </div>
                      
                      <!-- Calendar Section -->
                      <v-row class="mb-4">
                        <v-col cols="12" md="6">
                          <v-card variant="outlined">
                            <v-card-title>날짜 선택</v-card-title>
                            <v-card-text>
                              <v-date-picker
                                v-model="selectedDate"
                                @update:model-value="onDateSelected"
                                show-adjacent-months
                                :max="new Date().toISOString().split('T')[0]"
                              ></v-date-picker>
                            </v-card-text>
                          </v-card>
                        </v-col>
                        <v-col cols="12" md="6" v-if="selectedDateString">
                          <v-card variant="outlined">
                            <v-card-title>선택된 날짜</v-card-title>
                            <v-card-text>
                              <v-chip color="primary" size="large" class="mb-2">
                                {{ formatDateDisplay(selectedDateString) }}
                              </v-chip>
                              <br>
                              <small class="text-grey">시트명: {{ selectedDateString }}</small>
                            </v-card-text>
                          </v-card>
                        </v-col>
                      </v-row>

                      <!-- Data Table Section -->
                      <v-row v-if="sheetData.length > 0">
                        <v-col cols="12">
                          <v-card variant="outlined">
                            <v-card-title>
                              배달 데이터 ({{ selectedDateString }})
                              <v-chip 
                                v-if="selectedStaff !== '전체'" 
                                color="primary" 
                                size="small" 
                                class="ml-2"
                              >
                                {{ selectedStaff }}
                              </v-chip>
                              <v-spacer></v-spacer>
                              <v-chip 
                                color="info" 
                                size="small" 
                                class="mr-2"
                              >
                                {{ filteredData.length }}건
                              </v-chip>
                              <v-btn
                                size="small"
                                variant="outlined"
                                @click="refreshData"
                                :loading="dataLoading"
                              >
                                <v-icon start>mdi-refresh</v-icon>
                                새로고침
                              </v-btn>
                            </v-card-title>
                            <v-card-text>
                              <!-- Filter Controls -->
                              <v-row class="mb-4">
                                <v-col cols="12" md="2">
                                  <v-select
                                    v-model="selectedStaff"
                                    label="담당자"
                                    :items="availableStaff"
                                    prepend-inner-icon="mdi-account"
                                    variant="outlined"
                                    density="compact"
                                  ></v-select>
                                </v-col>
                                <!-- Dynamic Filter System -->
                                <v-col cols="12">
                                  <div class="d-flex align-center gap-2 mb-3">
                                    <v-btn
                                      color="primary"
                                      variant="outlined"
                                      size="small"
                                      prepend-icon="mdi-filter-plus"
                                      @click="addFilter"
                                      :disabled="activeFilters.length >= availableColumns.length"
                                    >
                                      필터 추가
                                    </v-btn>
                                    <v-btn
                                      v-if="activeFilters.length > 0"
                                      color="error"
                                      variant="outlined"
                                      size="small"
                                      prepend-icon="mdi-filter-remove"
                                      @click="clearAllFilters"
                                    >
                                      모든 필터 지우기
                                    </v-btn>
                                  </div>
                                  
                                  <!-- Active Filters -->
                                  <v-row v-if="activeFilters.length > 0" class="mb-2">
                                    <v-col 
                                      v-for="filter in activeFilters" 
                                      :key="filter.id" 
                                      cols="12" 
                                      md="4"
                                      class="pb-2"
                                    >
                                      <div class="d-flex gap-2 align-center">
                                        <v-select
                                          :model-value="filter.column"
                                          @update:model-value="updateFilterColumn(filter.id, $event)"
                                          :items="availableColumns"
                                          label="컬럼 선택"
                                          variant="outlined"
                                          density="compact"
                                          style="min-width: 120px;"
                                        ></v-select>
                                        <v-text-field
                                          :model-value="filter.value"
                                          @update:model-value="updateFilterValue(filter.id, $event)"
                                          :label="filter.column + ' 검색'"
                                          prepend-inner-icon="mdi-magnify"
                                          clearable
                                          variant="outlined"
                                          density="compact"
                                          style="flex: 2; min-width: 200px;"
                                        ></v-text-field>
                                        <v-btn
                                          icon="mdi-close"
                                          size="small"
                                          variant="text"
                                          color="error"
                                          @click="removeFilter(filter.id)"
                                        ></v-btn>
                                      </div>
                                    </v-col>
                                  </v-row>
                                </v-col>
                              </v-row>

                              <!-- Data Table -->
                              <v-data-table
                                :headers="tableHeaders"
                                :items="filteredData"
                                :items-per-page="itemsPerPage"
                                :loading="dataLoading"
                                item-value="rowIndex"
                                class="elevation-1"
                              >
                              </v-data-table>
                            </v-card-text>
                          </v-card>
                        </v-col>
                      </v-row>

                      <!-- No Data Message -->
                      <v-row v-else-if="selectedDateString && !dataLoading">
                        <v-col cols="12">
                          <v-card variant="outlined">
                            <v-card-text class="text-center py-8">
                              <v-icon size="64" color="grey-lighten-2" class="mb-4">mdi-calendar-remove</v-icon>
                              <p class="text-h6 mb-2">{{ selectedDateString }} 시트를 찾을 수 없습니다</p>
                              <p class="text-body-2 text-grey">해당 날짜의 배달 데이터가 없거나 시트가 생성되지 않았습니다.</p>
                            </v-card-text>
                          </v-card>
                        </v-col>
                      </v-row>

                      <v-btn
                        color="error"
                        variant="outlined"
                        @click="disconnectGoogleSheets"
                        class="mt-4"
                      >
                        Google 연결 해제
                      </v-btn>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>

              <!-- SOLAPI Integration -->
              <v-col cols="12" md="6">
                <v-card variant="outlined">
                  <v-card-title class="text-h6">
                    <v-icon start>mdi-message-text</v-icon>
                    SOLAPI 카카오톡 연동
                  </v-card-title>
                  
                  <v-card-text>
                    <v-chip
                      :color="authStore.isSolapiAuthenticated ? 'success' : 'error'"
                      class="mb-4"
                    >
                      {{ authStore.isSolapiAuthenticated ? '연결됨' : '연결 안됨' }}
                    </v-chip>
                    
                    <div v-if="!authStore.isSolapiAuthenticated">
                      <p class="mb-4">SOLAPI를 통해 배달 완료 알림을 고객에게 발송합니다.</p>
                      <v-btn
                        color="primary"
                        variant="elevated"
                        @click="connectSolapi"
                        :loading="solapiLoading"
                      >
                        <v-icon start>mdi-message-text</v-icon>
                        SOLAPI로 로그인
                      </v-btn>
                    </div>
                    
                    <div v-else>
                      <p class="mb-2">발신번호: {{ solapiSenderId || '로딩 중...' }}</p>
                      <p class="text-body-2 mb-4">잔액: {{ solapiBalance || '확인 중...' }}</p>
                      <v-btn
                        color="error"
                        variant="outlined"
                        @click="disconnectSolapi"
                      >
                        연결 해제
                      </v-btn>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <!-- Staff Management -->
            <v-row v-if="authStore.isGoogleAuthenticated" class="mt-4">
              <v-col cols="12">
                <v-card variant="outlined">
                  <v-card-title class="text-h6">
                    <v-icon start>mdi-account-group</v-icon>
                    배달담당자 관리
                  </v-card-title>
                  
                  <v-card-text>
                    <v-text-field
                      v-model="newStaffName"
                      label="배달담당자 이름"
                      placeholder="예: 김배달"
                      :rules="[rules.required]"
                      @keyup.enter="addStaff"
                    />
                    

                    <v-list v-if="staffList.length > 0">
                      <v-list-item
                        v-for="staff in staffList"
                        :key="staff.name"
                        class="border mb-2"
                      >
                        <template #prepend>
                          <v-icon>mdi-account</v-icon>
                        </template>
                        
                        <v-list-item-title>{{ staff.name }}</v-list-item-title>
                        
                        <template #append>
                          <v-btn
                            icon="mdi-open-in-new"
                            size="small"
                            variant="outlined"
                            color="primary"
                            @click="openStaffMobilePage(staff.name)"
                            :disabled="!selectedDateString"
                            title="모바일 페이지 열기"
                          />
                          <v-btn
                            icon="mdi-qrcode"
                            size="small"
                            variant="outlined"
                            @click="generateQR(staff.name)"
                            :disabled="!selectedDateString"
                            title="QR 코드 생성"
                          />
                        </template>
                      </v-list-item>
                    </v-list>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- QR Code Modal -->
    <v-dialog v-model="qrDialog" max-width="400">
      <v-card>
        <v-card-title class="text-center">
          <v-icon start color="primary">mdi-qrcode</v-icon>
          QR 코드
        </v-card-title>
        <v-card-text class="text-center">
          <div v-if="qrLoading" class="py-8">
            <v-progress-circular indeterminate color="primary"></v-progress-circular>
            <p class="mt-4">QR 코드 생성 중...</p>
          </div>
          <div v-else-if="qrImageData" class="py-4">
            <img :src="qrImageData" alt="QR Code" style="max-width: 100%; height: auto;" />
            <v-chip color="primary" size="small" class="mt-4">
              {{ qrStaffName }}
            </v-chip>
            <br>
            <small class="text-grey">{{ formatDateDisplay(selectedDateString) }}</small>
            <v-alert type="info" variant="tonal" class="mt-4 text-left">
              <strong>사용법:</strong><br>
              1. 카메라로 QR 코드를 스캔하세요<br>
              2. 자동으로 배달 관리 페이지가 열립니다<br>
              3. 배달 현황을 확인하고 상태를 업데이트하세요
            </v-alert>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="closeQRDialog">닫기</v-btn>
          <v-btn 
            v-if="qrImageData" 
            color="primary" 
            variant="elevated" 
            @click="downloadQRCode"
          >
            <v-icon start>mdi-download</v-icon>
            다운로드
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();

// Loading states
const googleLoading = ref(false);
const solapiLoading = ref(false);

// Google Sheets data
const connectedSheetName = ref<string>('');

// SOLAPI data
const solapiSenderId = ref<string>('');
const solapiBalance = ref<string>('');

// Staff management
const newStaffName = ref('');
const staffList = ref<{ name: string }[]>([]);

// Calendar and data management
const selectedDate = ref<Date | null>(null);
const selectedDateString = ref<string>('');
const sheetData = ref<any[]>([]);
const sheetDataByStaff = ref<{ [staffName: string]: any[] }>({});
const dynamicHeaders = ref<string[]>([]);
const dataLoading = ref(false);
const itemsPerPage = ref(10);
const selectedStaff = ref<string>('전체');

// Dynamic Filters system
const activeFilters = ref<Array<{id: string, column: string, value: string}>>([]);

// QR Code modal
const qrDialog = ref(false);
const qrLoading = ref(false);
const qrImageData = ref<string>('');
const qrStaffName = ref<string>('');

const tableHeaders = computed(() => {
  const baseHeaders: Array<{ title: string; key: string; width?: string }> = [
    { title: '행', key: 'rowIndex', width: '80px' },
  ];
  
  // Use dynamic headers from the actual sheet only
  if (dynamicHeaders.value.length > 0) {
    dynamicHeaders.value.forEach(header => {
      if (header !== 'rowIndex' && header !== 'staffName') {
        baseHeaders.push({ 
          title: header, 
          key: header
        });
      }
    });
  }
  
  return baseHeaders;
});

// Form validation rules
const rules = {
  required: (value: string): boolean | string => !!value || '필수 입력 항목입니다.',
};

// Computed
const availableStaff = computed(() => {
  const staffNames = Object.keys(sheetDataByStaff.value);
  return ['전체', ...staffNames];
});

const currentDisplayData = computed(() => {
  if (selectedStaff.value === '전체') {
    return sheetData.value;
  } else {
    return sheetDataByStaff.value[selectedStaff.value] || [];
  }
});

const filteredData = computed(() => {
  return currentDisplayData.value.filter(item => {
    // Check each active filter
    return activeFilters.value.every(filter => {
      if (!filter.value || !item[filter.column]) return true;
      
      const itemValue = String(item[filter.column]).toLowerCase();
      const filterValue = filter.value.toLowerCase();
      
      return itemValue.includes(filterValue);
    });
  });
});

// Filter management methods
const addFilter = (): void => {
  const newId = `filter_${Date.now()}`;
  activeFilters.value.push({
    id: newId,
    column: availableColumns.value[0] || '',
    value: ''
  });
};

const removeFilter = (filterId: string): void => {
  activeFilters.value = activeFilters.value.filter(f => f.id !== filterId);
};

const updateFilterColumn = (filterId: string, column: string): void => {
  const filter = activeFilters.value.find(f => f.id === filterId);
  if (filter) {
    filter.column = column;
  }
};

const updateFilterValue = (filterId: string, value: string): void => {
  const filter = activeFilters.value.find(f => f.id === filterId);
  if (filter) {
    filter.value = value;
  }
};

const clearAllFilters = (): void => {
  activeFilters.value = [];
};

// Available columns for filters (exclude rowIndex)
const availableColumns = computed(() => {
  return dynamicHeaders.value.filter(header => header !== 'rowIndex' && header !== 'staffName');
});

// Google Sheets integration methods
const connectGoogleSheets = async (): Promise<void> => {
  googleLoading.value = true;
  try {
    // TODO: Implement Google OAuth2 flow
    console.log('Connecting to Google Sheets...');
    // Redirect to backend OAuth endpoint
    window.location.href = 'http://localhost:5001/api/auth/google';
  } catch (error) {
    console.error('Google Sheets connection failed:', error);
  } finally {
    googleLoading.value = false;
  }
};

const disconnectGoogleSheets = async (): Promise<void> => {
  try {
    await authStore.logoutGoogle();
    connectedSheetName.value = '';
    staffList.value = [];
  } catch (error) {
    console.error('Failed to disconnect Google Sheets:', error);
  }
};

// SOLAPI integration methods
const connectSolapi = async (): Promise<void> => {
  solapiLoading.value = true;
  try {
    // TODO: Implement SOLAPI OAuth2 flow
    console.log('Connecting to SOLAPI...');
    // Redirect to backend OAuth endpoint
    window.location.href = 'http://localhost:3000/api/solapi/auth/login';
  } catch (error) {
    console.error('SOLAPI connection failed:', error);
  } finally {
    solapiLoading.value = false;
  }
};

const disconnectSolapi = async (): Promise<void> => {
  try {
    await authStore.logoutSolapi();
    solapiSenderId.value = '';
    solapiBalance.value = '';
  } catch (error) {
    console.error('Failed to disconnect SOLAPI:', error);
  }
};

// Staff management methods
const addStaff = async (): Promise<void> => {
  if (!newStaffName.value.trim()) return;
  
  try {
    // TODO: Implement staff addition with sheet creation
    staffList.value.push({ name: newStaffName.value.trim() });
    newStaffName.value = '';
    console.log('Staff added:', staffList.value);
  } catch (error) {
    console.error('Failed to add staff:', error);
  }
};

const removeStaff = (staffName: string): void => {
  staffList.value = staffList.value.filter(staff => staff.name !== staffName);
};

const openStaffMobilePage = (staffName: string): void => {
  if (!selectedDateString.value) {
    console.warn('No date selected');
    return;
  }
  
  const mobileUrl = `/delivery/${selectedDateString.value}/${encodeURIComponent(staffName)}`;
  window.open(mobileUrl, '_blank');
};

const generateQR = async (staffName: string): Promise<void> => {
  if (!selectedDateString.value) {
    console.warn('No date selected for QR generation');
    return;
  }
  
  qrStaffName.value = staffName;
  qrDialog.value = true;
  qrLoading.value = true;
  qrImageData.value = '';
  
  try {
    const response = await fetch(
      `http://localhost:5001/api/delivery/qr/generate-mobile/${encodeURIComponent(staffName)}/${selectedDateString.value}`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      qrImageData.value = result.data.qrImage;
      console.log('QR code generated for:', staffName);
      console.log('Mobile URL:', result.data.qrUrl);
    } else {
      console.error('QR generation failed:', result.message);
      // Close modal on error
      qrDialog.value = false;
    }
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    // Close modal on error
    qrDialog.value = false;
  } finally {
    qrLoading.value = false;
  }
};

const closeQRDialog = (): void => {
  qrDialog.value = false;
  qrImageData.value = '';
  qrStaffName.value = '';
};

const downloadQRCode = (): void => {
  if (qrImageData.value && qrStaffName.value && selectedDateString.value) {
    const link = document.createElement('a');
    link.href = qrImageData.value;
    link.download = `qr-${qrStaffName.value}-${selectedDateString.value}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Calendar and data methods
const onDateSelected = (date: Date | null): void => {
  if (date) {
    selectedDate.value = date;
    selectedDateString.value = formatDateToYYYYMMDD(date);
    loadSheetData(selectedDateString.value);
  }
};

const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const formatDateDisplay = (dateString: string): string => {
  if (dateString.length === 8) {
    const year = dateString.slice(0, 4);
    const month = dateString.slice(4, 6);
    const day = dateString.slice(6, 8);
    return `${year}년 ${month}월 ${day}일`;
  }
  return dateString;
};

const loadSheetData = async (dateString: string): Promise<void> => {
  if (!dateString) return;
  
  dataLoading.value = true;
  try {
    // Load data grouped by staff
    const staffResponse = await fetch(`http://localhost:5001/api/sheets/date/${dateString}/by-staff`, {
      method: 'GET',
      credentials: 'include',
    });
    
    const staffResult = await staffResponse.json();
    
    if (staffResult.success) {
      sheetDataByStaff.value = staffResult.data || {};
      dynamicHeaders.value = staffResult.headers || [];
      // Clear existing filters when loading new data
      activeFilters.value = [];
      
      // Flatten all staff data for "전체" view
      const allData = Object.values(sheetDataByStaff.value).flat();
      sheetData.value = allData;
      
      // Update staff list from actual sheet data
      const detectedStaff = Object.keys(sheetDataByStaff.value).map(name => ({ name }));
      staffList.value = detectedStaff;
      
      console.log('Sheet data by staff loaded:', staffResult.data);
      console.log('Headers:', dynamicHeaders.value);
      console.log('Total items:', allData.length);
      console.log('Detected staff:', detectedStaff);
    } else {
      // Fallback to original API for backwards compatibility
      const response = await fetch(`http://localhost:5001/api/sheets/date/${dateString}`, {
        method: 'GET',
        credentials: 'include',
      });
      
      const result = await response.json();
      
      if (result.success) {
        sheetData.value = result.data || [];
        dynamicHeaders.value = result.headers || [];
        // Clear existing filters when loading new data
        activeFilters.value = [];
        
        sheetDataByStaff.value = {};
        staffList.value = [];
        console.log('Sheet data loaded (fallback):', result.data);
        console.log('Headers (fallback):', dynamicHeaders.value);
      } else {
        sheetData.value = [];
        sheetDataByStaff.value = {};
        dynamicHeaders.value = [];
        staffList.value = [];
        console.warn('No data found for date:', dateString, result.message);
      }
    }
  } catch (error) {
    console.error('Failed to load sheet data:', error);
    sheetData.value = [];
    sheetDataByStaff.value = {};
    dynamicHeaders.value = [];
    staffList.value = [];
  } finally {
    dataLoading.value = false;
  }
};

const refreshData = (): void => {
  if (selectedDateString.value) {
    loadSheetData(selectedDateString.value);
  }
};



// Removed unused functions for simplified workflow

// Initialize and check auth status
onMounted(async () => {
  await authStore.checkAuthStatus();
  
  // Check URL parameters for OAuth callbacks
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('google_auth') === 'success') {
    console.log('Google authentication successful');
    await authStore.checkAuthStatus(); // Refresh status
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  if (urlParams.get('solapi_auth') === 'success') {
    console.log('SOLAPI authentication successful');  
    await authStore.checkAuthStatus(); // Refresh status
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});

// Watch for auth status changes to update UI data
watch(() => authStore.isGoogleAuthenticated, (newValue) => {
  if (newValue) {
    // Load Google Sheets data
    connectedSheetName.value = 'Connected Spreadsheet';
  } else {
    connectedSheetName.value = '';
    staffList.value = [];
  }
});

watch(() => authStore.isSolapiAuthenticated, (newValue) => {
  if (newValue) {
    // Load SOLAPI data
    solapiSenderId.value = 'Loading...';
    solapiBalance.value = 'Loading...';
  } else {
    solapiSenderId.value = '';
    solapiBalance.value = '';
  }
});
</script>