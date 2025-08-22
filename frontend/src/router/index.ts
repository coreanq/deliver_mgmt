import { createRouter, createWebHistory } from 'vue-router'
import QrScannerPage from '@/views/QrScannerPage.vue'
import DeliveryDashboard from '@/views/DeliveryDashboard.vue'
import AdminDashboard from '@/views/AdminDashboard.vue'

const routes = [
  {
    path: '/',
    redirect: '/admin'
  },
  {
    path: '/qr-scanner',
    name: 'QrScanner',
    component: QrScannerPage,
    meta: {
      title: '배송자 QR 스캐너',
      requiresAuth: false
    }
  },
  {
    path: '/delivery-dashboard',
    name: 'DeliveryDashboard',
    component: DeliveryDashboard,
    meta: {
      title: '배송 관리 대시보드',
      requiresAuth: true
    }
  },
  {
    path: '/admin',
    name: 'AdminDashboard',
    component: AdminDashboard,
    meta: {
      title: '관리자 대시보드',
      requiresAuth: false
    }
  },
  {
    path: '/delivery',
    redirect: '/qr-scanner'
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/qr-scanner'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// 네비게이션 가드
router.beforeEach(async (to, from, next) => {
  // 페이지 타이틀 설정
  if (to.meta?.title) {
    document.title = `${to.meta.title} - 배달 관리 시스템`
  }

  // 인증이 필요한 페이지 체크
  if (to.meta?.requiresAuth) {
    try {
      // 인증 상태 확인 (간단한 API 호출)
      const response = await fetch('/api/delivery/current-work', {
        credentials: 'include'
      })
      
      if (!response.ok) {
        // 인증되지 않은 경우 QR 스캐너로 리다이렉트
        next('/qr-scanner')
        return
      }
    } catch (error) {
      // 네트워크 오류 등의 경우도 QR 스캐너로 리다이렉트
      next('/qr-scanner')
      return
    }
  }

  next()
})

export default router