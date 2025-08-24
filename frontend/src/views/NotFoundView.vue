<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="6" class="text-center">
        <v-icon size="120" color="grey">mdi-emoticon-sad</v-icon>
        <h1 class="text-h3 mt-4 mb-2">404</h1>
        <p class="text-h6 mb-4">페이지를 찾을 수 없습니다</p>
        <p class="text-body-1 mb-6">요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
        
        <v-btn
          color="primary"
          size="large"
          to="/"
        >
          홈으로 돌아가기
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
// 404 Not Found page
</script>