<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card class="pa-6">
          <v-card-title class="text-h4 text-center mb-4">
            배달 관리 시스템
          </v-card-title>
          
          <v-card-text class="text-center">
            <p class="text-h6 mb-4">구글 스프레드시트 기반 배달 관리</p>
            <p class="mb-6">관리자는 설정을 통해 시스템을 구성하고, 배달담당자는 QR 코드를 통해 접근할 수 있습니다.</p>
          </v-card-text>

          <v-card-actions class="justify-center">
            <v-btn
              color="primary"
              size="large"
              variant="elevated"
              to="/admin"
              class="ma-2"
            >
              <v-icon start>mdi-cog</v-icon>
              관리자 설정
            </v-btn>
            
            <v-btn
              color="secondary"
              size="large"
              variant="elevated"
              to="/delivery/auth"
              class="ma-2"
            >
              <v-icon start>mdi-qrcode-scan</v-icon>
              배달담당자 접속
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
// Home page component - entry point for the application
</script>