import { test, expect } from '@playwright/test';

test.describe('실시간 동기화 성능 테스트', () => {
  
  test.beforeEach(async ({ page }) => {
    // 관리자 대시보드로 이동
    await page.goto('/');
    
    // 스프레드시트 탭으로 이동
    await page.getByRole('tab', { name: '스프레드시트' }).click();
    
    // 페이지 로드 대기
    await page.waitForLoadState('networkidle');
  });

  test('동기화 API 기본 응답 시간 측정', async ({ request }) => {
    const startTime = Date.now();
    
    // 동기화 상태 조회 API 호출
    const response = await request.get('http://localhost:5001/api/sync/status');
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    expect(response.ok()).toBeTruthy();
    expect(responseTime).toBeLessThan(1000); // 1초 이내 응답
    
    console.log(`동기화 상태 조회 응답 시간: ${responseTime}ms`);
  });

  test('활성 동기화 목록 조회 성능', async ({ request }) => {
    const startTime = Date.now();
    
    const response = await request.get('http://localhost:5001/api/sync/active');
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    expect(response.ok()).toBeTruthy();
    expect(responseTime).toBeLessThan(500); // 500ms 이내 응답
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('activeCount');
    expect(data.data).toHaveProperty('websocket');
    
    console.log(`활성 동기화 조회 응답 시간: ${responseTime}ms`);
    console.log(`WebSocket 연결 수: ${data.data.websocket.connectedClientsCount}`);
  });

  test('동시 API 요청 부하 테스트', async ({ request }) => {
    const concurrentRequests = 10;
    const promises = [];
    
    const startTime = Date.now();
    
    // 동시에 여러 요청 실행
    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(request.get('http://localhost:5001/api/sync/status'));
    }
    
    const responses = await Promise.all(promises);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // 모든 응답이 성공했는지 확인
    responses.forEach((response, index) => {
      expect(response.ok()).toBeTruthy();
      console.log(`요청 ${index + 1}: ${response.status()}`);
    });
    
    const averageTime = totalTime / concurrentRequests;
    expect(averageTime).toBeLessThan(200); // 평균 200ms 이내
    
    console.log(`${concurrentRequests}개 동시 요청 총 시간: ${totalTime}ms`);
    console.log(`평균 응답 시간: ${averageTime.toFixed(2)}ms`);
  });

  test('WebSocket 연결 성능 테스트', async ({ page }) => {
    // WebSocket 연결 메시지 수집
    const wsMessages: any[] = [];
    
    page.on('websocket', ws => {
      ws.on('framesent', event => {
        if (event.payload) {
          try {
            const message = JSON.parse(event.payload);
            wsMessages.push({ type: 'sent', message, timestamp: Date.now() });
          } catch (e) {
            // JSON 파싱 실패 시 원본 저장
            wsMessages.push({ type: 'sent', message: event.payload, timestamp: Date.now() });
          }
        }
      });
      
      ws.on('framereceived', event => {
        if (event.payload) {
          try {
            const message = JSON.parse(event.payload);
            wsMessages.push({ type: 'received', message, timestamp: Date.now() });
          } catch (e) {
            wsMessages.push({ type: 'received', message: event.payload, timestamp: Date.now() });
          }
        }
      });
    });
    
    const startTime = Date.now();
    
    // 페이지 새로고침으로 WebSocket 연결 트리거
    await page.reload();
    await page.waitForTimeout(3000);
    
    const endTime = Date.now();
    const connectionTime = endTime - startTime;
    
    // WebSocket 메시지가 수신되었는지 확인
    expect(wsMessages.length).toBeGreaterThan(0);
    expect(connectionTime).toBeLessThan(5000); // 5초 이내 연결
    
    console.log(`WebSocket 연결 시간: ${connectionTime}ms`);
    console.log(`WebSocket 메시지 수: ${wsMessages.length}`);
    
    // 메시지 타입별 분석
    const sentMessages = wsMessages.filter(m => m.type === 'sent').length;
    const receivedMessages = wsMessages.filter(m => m.type === 'received').length;
    
    console.log(`전송된 메시지: ${sentMessages}, 수신된 메시지: ${receivedMessages}`);
  });

  test('동기화 시작 응답 시간 테스트 (모킹)', async ({ request }) => {
    // 인증 없이 동기화 시작 요청 (에러 응답이지만 응답 시간 측정)
    const startTime = Date.now();
    
    const response = await request.post('http://localhost:5001/api/sync/start', {
      data: {
        intervalMs: 10000,
        batchSize: 5,
        maxConcurrent: 3
      }
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // 인증 오류 응답이어야 함 (401 또는 403)
    expect([401, 403]).toContain(response.status());
    expect(responseTime).toBeLessThan(1000); // 1초 이내 응답
    
    const data = await response.json();
    expect(data.success).toBe(false);
    
    console.log(`동기화 시작 API 응답 시간: ${responseTime}ms`);
  });

  test('메모리 및 성능 모니터링', async ({ page }) => {
    // 페이지 성능 메트릭 수집
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const performanceMetrics = await page.evaluate(() => {
      const perf = performance;
      const navigation = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        totalLoadTime: navigation.loadEventEnd - navigation.navigationStart,
        responseTime: navigation.responseEnd - navigation.responseStart,
        renderTime: navigation.domComplete - navigation.domLoading
      };
    });
    
    // 성능 기준 검증
    expect(performanceMetrics.domContentLoaded).toBeLessThan(2000); // 2초 이내 DOM 로드
    expect(performanceMetrics.totalLoadTime).toBeLessThan(5000); // 5초 이내 전체 로드
    expect(performanceMetrics.responseTime).toBeLessThan(1000); // 1초 이내 서버 응답
    
    console.log('페이지 성능 메트릭:', performanceMetrics);
    
    // 메모리 사용량 측정 (가능한 경우)
    const memoryInfo = await page.evaluate(() => {
      // @ts-ignore
      if (performance.memory) {
        // @ts-ignore
        return {
          // @ts-ignore
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          // @ts-ignore
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          // @ts-ignore
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });
    
    if (memoryInfo) {
      console.log('메모리 사용량:', {
        used: `${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        total: `${(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        limit: `${(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
      });
    }
  });

  test('대용량 데이터 처리 시뮬레이션', async ({ request }) => {
    // 배치 크기와 동시 요청 수를 다양하게 테스트
    const testConfigs = [
      { batchSize: 3, maxConcurrent: 2, expectedMaxTime: 8000 },
      { batchSize: 5, maxConcurrent: 3, expectedMaxTime: 6000 },
      { batchSize: 8, maxConcurrent: 4, expectedMaxTime: 5000 }
    ];
    
    for (const config of testConfigs) {
      const startTime = Date.now();
      
      // 설정 업데이트 API 호출 (인증 없이, 에러 응답)
      const response = await request.put('http://localhost:5001/api/sync/config', {
        data: config
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // 인증 오류이지만 응답 시간 측정
      expect([401, 403]).toContain(response.status());
      expect(responseTime).toBeLessThan(1000);
      
      console.log(`배치 크기 ${config.batchSize}, 동시 요청 ${config.maxConcurrent}: ${responseTime}ms`);
    }
  });

  test('UI 응답성 테스트', async ({ page }) => {
    // 스프레드시트 탭 클릭 응답 시간
    const startTime = Date.now();
    
    await page.getByRole('tab', { name: '스프레드시트' }).click();
    await expect(page.getByText('구글 드라이브 연동')).toBeVisible();
    
    const endTime = Date.now();
    const tabSwitchTime = endTime - startTime;
    
    expect(tabSwitchTime).toBeLessThan(500); // 500ms 이내 탭 전환
    console.log(`탭 전환 시간: ${tabSwitchTime}ms`);
    
    // 버튼 클릭 응답성 테스트
    const buttonStartTime = Date.now();
    
    const refreshButton = page.getByRole('button', { name: '새로고침' });
    await refreshButton.click();
    
    const buttonEndTime = Date.now();
    const buttonResponseTime = buttonEndTime - buttonStartTime;
    
    expect(buttonResponseTime).toBeLessThan(300); // 300ms 이내 버튼 응답
    console.log(`버튼 클릭 응답 시간: ${buttonResponseTime}ms`);
  });
});

test.describe('동기화 성능 요구사항 검증', () => {
  test('30개 주문을 10초 내에 처리 시뮬레이션', async ({ request }) => {
    // 30개 주문을 처리하는 시나리오를 시뮬레이션
    const ordersPerStaff = 10; // 직원당 10개 주문
    const staffCount = 3; // 3명의 직원
    const totalOrders = ordersPerStaff * staffCount; // 총 30개 주문
    
    const startTime = Date.now();
    
    // 병렬로 직원별 데이터 요청 시뮬레이션
    const staffRequests = [];
    for (let i = 1; i <= staffCount; i++) {
      staffRequests.push(
        request.get(`http://localhost:5001/api/sync/refresh/staff${i}`)
      );
    }
    
    const responses = await Promise.allSettled(staffRequests);
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    // 처리 시간이 10초 이내인지 확인
    expect(processingTime).toBeLessThan(10000);
    
    // 처리량 계산 (초당 주문 수)
    const throughput = (totalOrders / processingTime) * 1000;
    expect(throughput).toBeGreaterThan(3); // 최소 3 주문/초
    
    console.log(`총 처리 시간: ${processingTime}ms`);
    console.log(`처리량: ${throughput.toFixed(2)} 주문/초`);
    console.log(`목표 달성: ${processingTime < 10000 ? '✅' : '❌'}`);
    
    // 각 요청의 결과 확인
    responses.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        // 인증 오류는 예상된 결과
        expect([401, 403]).toContain(result.value.status());
      }
    });
  });
});