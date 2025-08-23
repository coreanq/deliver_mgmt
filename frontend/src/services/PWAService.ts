/**
 * PWA Service - Progressive Web App 기능 관리
 */
export class PWAService {
  private static instance: PWAService
  private swRegistration: ServiceWorkerRegistration | null = null
  private deferredPrompt: any = null
  private isInstalled = false
  
  constructor() {
    this.initializePWA()
  }
  
  static getInstance(): PWAService {
    if (!PWAService.instance) {
      PWAService.instance = new PWAService()
    }
    return PWAService.instance
  }
  
  /**
   * PWA 초기화
   */
  private async initializePWA() {
    // Service Worker 등록
    await this.registerServiceWorker()
    
    // Install prompt 이벤트 리스너
    this.setupInstallPrompt()
    
    // PWA 설치 상태 확인
    this.checkInstallationStatus()
    
    // 업데이트 확인
    this.checkForUpdates()
    
    console.log('[PWA Service] PWA 서비스가 초기화되었습니다.')
  }
  
  /**
   * Service Worker 등록
   */
  private async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[PWA Service] Service Worker를 지원하지 않는 브라우저입니다.')
      return
    }
    
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })
      
      this.swRegistration = registration
      console.log('[PWA Service] Service Worker 등록 성공:', registration.scope)
      
      // 업데이트 확인
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA Service] 새로운 버전이 사용 가능합니다.')
              this.showUpdateAvailable()
            }
          })
        }
      })
      
    } catch (error) {
      console.error('[PWA Service] Service Worker 등록 실패:', error)
    }
  }
  
  /**
   * 설치 프롬프트 설정
   */
  private setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('[PWA Service] Install prompt 이벤트 수신')
      // 브라우저 기본 설치 프롬프트 방지
      e.preventDefault()
      // 나중에 사용하기 위해 이벤트 저장
      this.deferredPrompt = e
    })
    
    // 설치 완료 감지
    window.addEventListener('appinstalled', () => {
      console.log('[PWA Service] PWA가 성공적으로 설치되었습니다.')
      this.isInstalled = true
      this.deferredPrompt = null
    })
  }
  
  /**
   * PWA 설치 상태 확인
   */
  private checkInstallationStatus() {
    // 웹 앱 매니페스트 확인
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      console.log('[PWA Service] PWA 모드로 실행 중')
      this.isInstalled = true
    }
    
    // iOS Safari 확인
    if ('standalone' in window.navigator && (window.navigator as any).standalone) {
      console.log('[PWA Service] iOS Safari PWA 모드로 실행 중')
      this.isInstalled = true
    }
  }
  
  /**
   * 설치 프롬프트 표시
   */
  async showInstallPrompt(): Promise<boolean> {
    if (!this.deferredPrompt) {
      console.log('[PWA Service] 설치 프롬프트를 사용할 수 없습니다.')
      return false
    }
    
    try {
      // 설치 프롬프트 표시
      this.deferredPrompt.prompt()
      
      // 사용자 응답 대기
      const choiceResult = await this.deferredPrompt.userChoice
      
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA Service] 사용자가 PWA 설치를 수락했습니다.')
        return true
      } else {
        console.log('[PWA Service] 사용자가 PWA 설치를 거부했습니다.')
        return false
      }
    } catch (error) {
      console.error('[PWA Service] 설치 프롬프트 표시 실패:', error)
      return false
    } finally {
      this.deferredPrompt = null
    }
  }
  
  /**
   * 설치 가능 여부 확인
   */
  canInstall(): boolean {
    return !!this.deferredPrompt && !this.isInstalled
  }
  
  /**
   * 설치됨 여부 확인
   */
  isAppInstalled(): boolean {
    return this.isInstalled
  }
  
  /**
   * 업데이트 사용 가능 알림
   */
  private showUpdateAvailable() {
    // 커스텀 이벤트 발생
    const event = new CustomEvent('pwa-update-available', {
      detail: { hasUpdate: true }
    })
    window.dispatchEvent(event)
  }
  
  /**
   * 앱 업데이트 적용
   */
  async applyUpdate(): Promise<void> {
    if (!this.swRegistration || !this.swRegistration.waiting) {
      console.log('[PWA Service] 적용할 업데이트가 없습니다.')
      return
    }
    
    try {
      // 새로운 Service Worker 활성화 요청
      this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
      
      // 페이지 새로고침
      window.location.reload()
    } catch (error) {
      console.error('[PWA Service] 업데이트 적용 실패:', error)
    }
  }
  
  /**
   * 업데이트 확인
   */
  async checkForUpdates(): Promise<void> {
    if (!this.swRegistration) {
      return
    }
    
    try {
      await this.swRegistration.update()
      console.log('[PWA Service] 업데이트 확인 완료')
    } catch (error) {
      console.error('[PWA Service] 업데이트 확인 실패:', error)
    }
  }
  
  /**
   * 오프라인 상태 확인
   */
  isOffline(): boolean {
    return !navigator.onLine
  }
  
  /**
   * 네트워크 상태 변경 리스너 등록
   */
  onNetworkStatusChange(callback: (isOnline: boolean) => void): () => void {
    const onlineHandler = () => callback(true)
    const offlineHandler = () => callback(false)
    
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    
    // 초기 상태 호출
    callback(navigator.onLine)
    
    // 클린업 함수 반환
    return () => {
      window.removeEventListener('online', onlineHandler)
      window.removeEventListener('offline', offlineHandler)
    }
  }
  
  /**
   * 앱 정보 가져오기
   */
  async getAppInfo(): Promise<{
    isInstalled: boolean
    canInstall: boolean
    isOffline: boolean
    hasUpdate: boolean
  }> {
    return {
      isInstalled: this.isAppInstalled(),
      canInstall: this.canInstall(),
      isOffline: this.isOffline(),
      hasUpdate: !!this.swRegistration?.waiting
    }
  }
  
  /**
   * PWA 배지 설정 (지원되는 브라우저에서)
   */
  async setBadge(count?: number): Promise<void> {
    if ('setAppBadge' in navigator) {
      try {
        if (count && count > 0) {
          await (navigator as any).setAppBadge(count)
          console.log(`[PWA Service] 앱 배지 설정: ${count}`)
        } else {
          await (navigator as any).clearAppBadge()
          console.log('[PWA Service] 앱 배지 제거')
        }
      } catch (error) {
        console.error('[PWA Service] 앱 배지 설정 실패:', error)
      }
    }
  }
  
  /**
   * 푸시 알림 권한 요청
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('[PWA Service] 알림을 지원하지 않는 브라우저입니다.')
      return 'denied'
    }
    
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      console.log(`[PWA Service] 알림 권한: ${permission}`)
      return permission
    }
    
    return Notification.permission
  }
  
  /**
   * 로컬 알림 표시
   */
  async showNotification(title: string, options?: NotificationOptions): Promise<void> {
    const permission = await this.requestNotificationPermission()
    
    if (permission === 'granted' && this.swRegistration) {
      try {
        await this.swRegistration.showNotification(title, {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          vibrate: [100, 50, 100],
          ...options
        })
        console.log(`[PWA Service] 알림 표시: ${title}`)
      } catch (error) {
        console.error('[PWA Service] 알림 표시 실패:', error)
      }
    }
  }
}

// PWA 서비스 싱글톤 인스턴스
export const pwaService = PWAService.getInstance()

// 타입 정의
export interface PWAStatus {
  isInstalled: boolean
  canInstall: boolean
  isOffline: boolean
  hasUpdate: boolean
}

export default pwaService