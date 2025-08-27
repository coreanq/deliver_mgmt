<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-test-tube</v-icon>
            Google Sheets 연동 테스트
          </v-card-title>
          
          <v-card-text>
            <v-btn
              color="primary"
              @click="testGoogleSheets"
              :loading="loading"
              class="mb-4"
            >
              <v-icon start>mdi-google</v-icon>
              Google Sheets 연동 테스트
            </v-btn>

            <v-divider class="my-4" />

            <div v-if="testResult">
              <v-alert
                :type="testResult.success ? 'success' : 'error'"
                class="mb-4"
              >
                {{ testResult.message }}
              </v-alert>

              <div v-if="testResult.success && testResult.data">
                <h3 class="mb-2">연동 결과:</h3>
                <v-card variant="outlined" class="mb-4">
                  <v-card-text>
                    <p><strong>메시지:</strong> {{ testResult.data.message }}</p>
                    <p><strong>타임스탬프:</strong> {{ testResult.data.timestamp }}</p>
                  </v-card-text>
                </v-card>

                <h3 class="mb-2">테스트 스프레드시트 목록:</h3>
                <v-list>
                  <v-list-item
                    v-for="sheet in testResult.data.spreadsheets"
                    :key="sheet.id"
                    class="border mb-2"
                  >
                    <template #prepend>
                      <v-icon>mdi-file-document</v-icon>
                    </template>
                    
                    <v-list-item-title>{{ sheet.name }}</v-list-item-title>
                    <v-list-item-subtitle>ID: {{ sheet.id }}</v-list-item-subtitle>
                    
                    <template #append>
                      <v-btn
                        size="small"
                        variant="outlined"
                        @click="openSheet(sheet.url)"
                      >
                        시트 열기
                      </v-btn>
                    </template>
                  </v-list-item>
                </v-list>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const loading = ref(false);
const testResult = ref<{
  success: boolean;
  message: string;
  data?: {
    message: string;
    spreadsheets: Array<{
      id: string;
      name: string;
      url: string;
      createdTime: string;
    }>;
    timestamp: string;
  };
} | null>(null);

const testGoogleSheets = async (): Promise<void> => {
  loading.value = true;
  testResult.value = null;
  
  try {
    console.log('Testing Google Sheets integration...');
    
    const response = await fetch('http://localhost:5001/api/sheets/test', {
      credentials: 'include' // Include cookies in cross-origin requests
    });
    const result = await response.json();
    
    testResult.value = result;
    
    if (result.success) {
      console.log('Google Sheets test successful:', result.data);
    } else {
      console.error('Google Sheets test failed:', result.message);
    }
  } catch (error) {
    console.error('Test request failed:', error);
    testResult.value = {
      success: false,
      message: '테스트 요청에 실패했습니다.',
    };
  } finally {
    loading.value = false;
  }
};

const openSheet = (url: string): void => {
  window.open(url, '_blank');
};
</script>