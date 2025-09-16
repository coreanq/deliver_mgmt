<template>
  <v-app>
    <!-- 쿠팡 광고 플로팅 바 -->
    <div class="floating-ad-bar">
      <!-- 첫 번째 광고 -->
      <iframe 
        ref="coupangIframe"
        src="https://ads-partners.coupang.com/widgets.html?id=630377&template=carousel&trackingCode=AF4322617&subId=&width=100%&height=60&tsource=" 
        width="100%" 
        height="60" 
        frameborder="0" 
        scrolling="no" 
        referrerpolicy="unsafe-url" 
        browsingtopics
        @load="onCoupangAdLoad"
        @error="onCoupangAdError">
      </iframe>
      
      <!-- 두 번째 광고 -->
      <iframe 
        ref="coupangIframe2"
        src="https://coupa.ng/cjMywN" 
        width="100%" 
        height="44" 
        frameborder="0" 
        scrolling="no" 
        referrerpolicy="unsafe-url" 
        browsingtopics
        @load="onCoupangAd2Load"
        @error="onCoupangAd2Error">
      </iframe>
    </div>
    
    <v-app-bar app color="primary" dark>
      <template #prepend>
        <img src="/logo.png" alt="Deliver Manager" height="28" style="border-radius:6px" />
      </template>
      <v-app-bar-title>배송 관리 시스템</v-app-bar-title>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>

    <!-- Global Floating Feedback Button -->
    <FloatingFeedbackButton />
  </v-app>
  
</template>

<script setup lang="ts">
// App component - main layout with Coupang Partners iframe ads
import { ref } from 'vue'
import FloatingFeedbackButton from './components/FloatingFeedbackButton.vue'

const coupangIframe = ref<HTMLIFrameElement | null>(null)
const coupangIframe2 = ref<HTMLIFrameElement | null>(null)

// 광고 이벤트 핸들러 (로그 제거)
const onCoupangAdLoad = () => {
  // 광고 1 로딩 완료
}

const onCoupangAdError = () => {
  // 광고 1 로딩 실패
}

const onCoupangAd2Load = () => {
  // 광고 2 로딩 완료
}

const onCoupangAd2Error = () => {
  // 광고 2 로딩 실패
}
</script>

<style scoped>
.floating-ad-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2000; /* v-app-bar보다 높은 z-index */
  width: 100%;
  height: 104px; /* 60px + 44px = 두 광고 합계 */
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column; /* 세로 스택 */
  align-items: center;
  justify-content: center;
}

/* v-app-bar를 광고 바 아래로 밀어내기 */
:deep(.v-app-bar) {
  top: 104px !important; /* 두 광고 높이만큼 */
}

/* v-main 컨텐츠도 광고 바 + 헤더 높이만큼 밀어내기 */
:deep(.v-main) {
  padding-top: 168px !important; /* 104px (광고 2개) + 64px (헤더) */
}
</style>
