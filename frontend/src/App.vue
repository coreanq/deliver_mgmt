<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-title>배송 관리 시스템</v-app-bar-title>
      <v-spacer></v-spacer>
      <!-- 쿠팡 파트너스 광고 -->
      <div id="coupang-ad" style="width: 300px; height: 60px;"></div>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
  
</template>

<script setup lang="ts">
// App component - main layout
import { onMounted } from 'vue'

onMounted(() => {
  // 쿠팡 파트너스 스크립트 로드
  const script1 = document.createElement('script')
  script1.src = 'https://ads-partners.coupang.com/g.js'
  document.head.appendChild(script1)
  
  script1.onload = () => {
    // 스크립트 로드 완료 후 광고 초기화
    if (window.PartnersCoupang) {
      new window.PartnersCoupang.G({
        "id": 630377,
        "template": "carousel", 
        "trackingCode": "AF4322617",
        "width": "100%",
        "height": "60",
        "tsource": ""
      })
    }
  }
})

// 타입 정의
declare global {
  interface Window {
    PartnersCoupang: any
  }
}
</script>

<style scoped>
/* Global styles if needed */
</style>

