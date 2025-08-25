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
                      <p class="mb-2">사용 가능한 스프레드시트:</p>
                      <div v-if="authStore.googleSpreadsheets.length > 0" class="mb-4">
                        <v-list>
                          <v-list-item
                            v-for="sheet in authStore.googleSpreadsheets"
                            :key="sheet.id"
                            class="border mb-2"
                          >
                            <template #prepend>
                              <v-icon>mdi-file-spreadsheet</v-icon>
                            </template>
                            
                            <v-list-item-title>{{ sheet.name }}</v-list-item-title>
                            <v-list-item-subtitle>{{ sheet.createdTime }}</v-list-item-subtitle>
                            
                            <template #append>
                              <v-btn
                                size="small"
                                variant="outlined"
                                @click="connectToSheet(sheet)"
                                :disabled="authStore.connectedSpreadsheet?.id === sheet.id"
                                :color="authStore.connectedSpreadsheet?.id === sheet.id ? 'success' : 'primary'"
                              >
                                {{ authStore.connectedSpreadsheet?.id === sheet.id ? '연결됨' : '연결' }}
                              </v-btn>
                            </template>
                          </v-list-item>
                        </v-list>
                      </div>
                      <div v-else class="mb-4">
                        <p class="text-body-2">스프레드시트를 불러오는 중...</p>
                      </div>
                      <v-btn
                        color="error"
                        variant="outlined"
                        @click="disconnectGoogleSheets"
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
                    
                    <v-btn
                      color="primary"
                      @click="addStaff"
                      :disabled="!newStaffName.trim()"
                      class="mb-4"
                    >
                      <v-icon start>mdi-plus</v-icon>
                      배달담당자 추가
                    </v-btn>

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
                            icon="mdi-qrcode"
                            size="small"
                            variant="outlined"
                            @click="generateQR(staff.name)"
                          />
                          <v-btn
                            icon="mdi-delete"
                            size="small"
                            color="error"
                            variant="outlined"
                            @click="removeStaff(staff.name)"
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
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useRoute } from 'vue-router';

const authStore = useAuthStore();
const route = useRoute();

// Loading states
const googleLoading = ref(false);
const solapiLoading = ref(false);

// Google Sheets data
const connectedSheetName = ref<string>('');
const connectedSheetId = ref<string>('');

// SOLAPI data
const solapiSenderId = ref<string>('');
const solapiBalance = ref<string>('');

// Staff management
const newStaffName = ref('');
const staffList = ref<{ name: string }[]>([]);

// Form validation rules
const rules = {
  required: (value: string): boolean | string => !!value || '필수 입력 항목입니다.',
};

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

const generateQR = (staffName: string): void => {
  // TODO: Implement QR code generation and download
  console.log('Generating QR for:', staffName);
};

// Spreadsheet connection
const connectToSheet = async (sheet: any): Promise<void> => {
  try {
    console.log('Connecting to sheet:', sheet);
    
    const response = await fetch('http://localhost:5001/api/sheets/connect', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spreadsheetId: sheet.id,
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      connectedSheetId.value = sheet.id;
      connectedSheetName.value = sheet.name;
      // Refresh auth status to update connected spreadsheet state
      await authStore.checkAuthStatus();
      console.log('Successfully connected to spreadsheet:', result);
    } else {
      console.error('Failed to connect:', result.message);
    }
  } catch (error) {
    console.error('Failed to connect to sheet:', error);
  }
};

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