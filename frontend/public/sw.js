// Service Worker for Delivery Management System PWA
const CACHE_NAME = 'delivery-app-v1.0.0'
const OFFLINE_URL = '/offline.html'

// Assets to cache for offline use
const STATIC_CACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  // Add critical CSS and JS files here when they're built
]

// API endpoints to cache
const API_CACHE_URLS = [
  '/api/delivery/status-info',
  '/api/delivery/qr-login'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...')
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets')
        return cache.addAll(STATIC_CACHE_URLS)
      })
      .then(() => {
        console.log('[Service Worker] Static assets cached successfully')
        // Skip waiting to activate immediately
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('[Service Worker] Failed to cache static assets:', error)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('[Service Worker] Activated successfully')
        // Claim all clients immediately
        return self.clients.claim()
      })
  )
})

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Skip chrome-extension and other non-http requests
  if (!request.url.startsWith('http')) {
    return
  }

  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    // API requests - Network first, then cache
    event.respondWith(handleApiRequest(request))
  } else if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|woff|woff2)$/)) {
    // Static assets - Cache first, then network
    event.respondWith(handleStaticAsset(request))
  } else {
    // HTML pages - Network first, then cache, fallback to offline page
    event.respondWith(handlePageRequest(request))
  }
})

// API request handler - Network first strategy
async function handleApiRequest(request) {
  const cache = await caches.open(CACHE_NAME)
  
  try {
    // Try network first
    const networkResponse = await fetch(request)
    
    // If successful, cache the response for offline use
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('[Service Worker] Network failed for API, trying cache:', request.url)
    
    // Network failed, try cache
    const cachedResponse = await cache.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return offline response for API
    return new Response(
      JSON.stringify({
        success: false,
        message: '오프라인 상태입니다. 네트워크 연결을 확인해주세요.',
        offline: true
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Static asset handler - Cache first strategy
async function handleStaticAsset(request) {
  const cache = await caches.open(CACHE_NAME)
  const cachedResponse = await cache.match(request)
  
  if (cachedResponse) {
    return cachedResponse
  }
  
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.log('[Service Worker] Failed to fetch static asset:', request.url)
    throw error
  }
}

// Page request handler - Network first with offline fallback
async function handlePageRequest(request) {
  const cache = await caches.open(CACHE_NAME)
  
  try {
    // Try network first
    const networkResponse = await fetch(request)
    
    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('[Service Worker] Network failed for page, trying cache:', request.url)
    
    // Try cache
    const cachedResponse = await cache.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Fallback to offline page
    return cache.match(OFFLINE_URL) || new Response(
      '<html><body><h1>오프라인</h1><p>네트워크 연결을 확인해주세요.</p></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    )
  }
}

// Background sync for when connection is restored
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync triggered:', event.tag)
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync())
  }
})

async function doBackgroundSync() {
  try {
    // Sync any pending data when connection is restored
    console.log('[Service Worker] Performing background sync...')
    
    // You could implement queued API calls here
    // For example, sync pending order status updates
    
  } catch (error) {
    console.error('[Service Worker] Background sync failed:', error)
  }
}

// Push notification handling (for future implementation)
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event)
  
  const options = {
    body: event.data ? event.data.text() : '새로운 배달 주문이 있습니다.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '2'
    },
    actions: [
      {
        action: 'explore',
        title: '확인하기',
        icon: '/icons/checkmark.png'
      },
      {
        action: 'close',
        title: '닫기',
        icon: '/icons/xmark.png'
      }
    ]
  }
  
  event.waitUntil(
    self.registration.showNotification('배달 관리 시스템', options)
  )
})

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received.')
  
  event.notification.close()
  
  if (event.action === 'explore') {
    event.waitUntil(clients.openWindow('/delivery'))
  } else if (event.action === 'close') {
    // Just close the notification
  } else {
    // Default action - open the app
    event.waitUntil(clients.openWindow('/'))
  }
})

console.log('[Service Worker] Service Worker loaded successfully')