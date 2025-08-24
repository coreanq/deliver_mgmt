<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="6" lg="4">
        <v-card class="pa-6">
          <v-card-title class="text-h5 text-center mb-4">
            배달담당자 인증
          </v-card-title>

          <!-- QR Token Verification Step -->
          <div v-if="!isQRVerified">
            <v-card-text class="text-center">
              <v-icon size="64" color="primary" class="mb-4">mdi-qrcode-scan</v-icon>
              <p class="text-h6 mb-4">QR 코드를 스캔해주세요</p>
              <p class="text-body-2 mb-4">
                QR 코드를 스캔하거나 링크를 통해 접속하셨다면 자동으로 인증이 진행됩니다.
              </p>
            </v-card-text>
            
            <v-alert
              v-if="qrError"
              type="error"
              class="mb-4"
            >
              {{ qrError }}
            </v-alert>
          </div>

          <!-- Name Verification Step -->
          <div v-else-if="!isNameVerified">
            <v-card-text>
              <p class="text-h6 mb-4 text-center">본인 확인</p>
              <p class="mb-4">QR 코드에 등록된 배달담당자명: <strong>{{ staffNameFromQR }}</strong></p>
              <p class="mb-4">보안을 위해 본인 이름을 정확히 입력해주세요.</p>
              
              <v-text-field
                v-model="inputName"
                label="본인 이름 입력"
                placeholder="예: 김배달"
                :rules="[rules.required]"
                @keyup.enter="verifyName"
                autofocus
              />
              
              <v-alert
                v-if="nameError"
                type="error"
                class="mb-4"
              >
                {{ nameError }}
              </v-alert>
            </v-card-text>

            <v-card-actions class="justify-center">
              <v-btn
                color="primary"
                size="large"
                @click="verifyName"
                :loading="verifying"
                :disabled="!inputName.trim()"
              >
                확인
              </v-btn>
            </v-card-actions>
          </div>

          <!-- Authentication Success -->
          <div v-else>
            <v-card-text class="text-center">
              <v-icon size="64" color="success" class="mb-4">mdi-check-circle</v-icon>
              <p class="text-h6 mb-2">인증 완료</p>
              <p class="mb-4">{{ staffNameFromQR }}님, 환영합니다!</p>
              <p class="text-body-2 mb-4">배달 목록 페이지로 이동합니다.</p>
            </v-card-text>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// Authentication states
const isQRVerified = ref(false);
const isNameVerified = ref(false);
const staffNameFromQR = ref('');
const inputName = ref('');
const verifying = ref(false);

// Error states
const qrError = ref('');
const nameError = ref('');

// Form validation rules
const rules = {
  required: (value: string): boolean | string => !!value || '이름을 입력해주세요.',
};

onMounted(() => {
  verifyQRToken();
});

const verifyQRToken = async (): Promise<void> => {
  const staff = route.query.staff as string;
  const token = route.query.token as string;

  if (!staff || !token) {
    qrError.value = '유효하지 않은 QR 코드입니다. 올바른 QR 코드를 스캔해주세요.';
    return;
  }

  try {
    // TODO: Implement QR token verification API call
    // const response = await api.verifyQRToken(staff, token);
    
    // Mock verification for now
    staffNameFromQR.value = staff;
    isQRVerified.value = true;
    
    console.log('QR verified for staff:', staff);
  } catch (error) {
    console.error('QR verification failed:', error);
    qrError.value = 'QR 코드 인증에 실패했습니다. 다시 시도해주세요.';
  }
};

const verifyName = async (): Promise<void> => {
  if (!inputName.value.trim()) return;
  
  verifying.value = true;
  nameError.value = '';

  try {
    // Check if input name matches the staff name from QR
    if (inputName.value.trim() !== staffNameFromQR.value) {
      nameError.value = '이름이 일치하지 않습니다. 다시 확인해주세요.';
      return;
    }

    // TODO: Implement final authentication API call
    // const response = await api.authenticateDeliveryStaff(staffNameFromQR.value);
    
    // Set authentication state
    authStore.setDeliveryAuth(staffNameFromQR.value);
    isNameVerified.value = true;
    
    // Redirect to delivery dashboard after 2 seconds
    setTimeout(() => {
      router.push('/delivery');
    }, 2000);
    
  } catch (error) {
    console.error('Name verification failed:', error);
    nameError.value = '인증에 실패했습니다. 다시 시도해주세요.';
  } finally {
    verifying.value = false;
  }
};
</script>