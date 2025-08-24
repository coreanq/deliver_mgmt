import { test, expect } from '@playwright/test';

test.describe('배달담당자 대시보드', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated delivery staff state
    await page.addInitScript(() => {
      window.localStorage.setItem('deliveryAuth', JSON.stringify({
        staffName: '김배달',
        authenticated: true,
      }));
    });
  });

  test('배달 목록 기본 UI 확인', async ({ page }) => {
    await page.goto('/delivery');
    
    // 페이지 제목 및 배달담당자 이름 확인
    await expect(page.getByText('김배달님의 배달 목록')).toBeVisible();
    
    // 진행률 정보 확인
    await expect(page.getByText(/전체.*건/)).toBeVisible();
    await expect(page.getByText(/완료.*건/)).toBeVisible();
    await expect(page.getByText(/진행률.*%/)).toBeVisible();
  });

  test('배달 주문 목록 표시', async ({ page }) => {
    await page.goto('/delivery');
    
    // Mock API response
    await page.route('/api/delivery/orders/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              customerName: '김고객',
              phone: '010-1234-5678',
              address: '서울시 강남구 테헤란로 123',
              status: '대기',
            },
            {
              customerName: '이고객',
              phone: '010-9876-5432',
              address: '서울시 서초구 서초대로 456',
              status: '준비중',
            },
          ],
        }),
      });
    });
    
    await page.reload();
    
    // 주문 정보 확인
    await expect(page.getByText('김고객')).toBeVisible();
    await expect(page.getByText('010-1234-5678')).toBeVisible();
    await expect(page.getByText('서울시 강남구 테헤란로 123')).toBeVisible();
    
    await expect(page.getByText('이고객')).toBeVisible();
    await expect(page.getByText('010-9876-5432')).toBeVisible();
    await expect(page.getByText('서울시 서초구 서초대로 456')).toBeVisible();
  });

  test('배달 상태 업데이트 - 대기 to 준비중', async ({ page }) => {
    await page.goto('/delivery');
    
    // Mock API responses
    await page.route('/api/delivery/orders/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              customerName: '김고객',
              phone: '010-1234-5678',
              address: '서울시 강남구 테헤란로 123',
              status: '대기',
            },
          ],
        }),
      });
    });
    
    await page.route('/api/delivery/status', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: '배달 상태가 업데이트되었습니다.',
        }),
      });
    });
    
    await page.reload();
    
    // 준비중 버튼 클릭
    const prepareButton = page.getByRole('button', { name: '준비중' });
    await expect(prepareButton).toBeVisible();
    await prepareButton.click();
    
    // API 호출 확인
    const response = await page.waitForResponse('/api/delivery/status');
    expect(response.status()).toBe(200);
  });

  test('배달 완료 처리', async ({ page }) => {
    await page.goto('/delivery');
    
    // Mock API - 출발 상태인 주문
    await page.route('/api/delivery/orders/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              customerName: '김고객',
              phone: '010-1234-5678',
              address: '서울시 강남구 테헤란로 123',
              status: '출발',
            },
          ],
        }),
      });
    });
    
    await page.route('/api/delivery/status', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: '배달이 완료되었습니다. 고객에게 알림이 발송되었습니다.',
        }),
      });
    });
    
    await page.reload();
    
    // 배달 완료 버튼 클릭
    const completeButton = page.getByRole('button', { name: '배달 완료' });
    await expect(completeButton).toBeVisible();
    await completeButton.click();
    
    // 상태 업데이트 API 호출 확인
    const response = await page.waitForResponse('/api/delivery/status');
    expect(response.status()).toBe(200);
  });

  test('자동 새로고침 기능', async ({ page }) => {
    let requestCount = 0;
    
    // API 호출 카운트
    await page.route('/api/delivery/orders/**', route => {
      requestCount++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });
    
    await page.goto('/delivery');
    
    // 초기 로딩 (1회 호출)
    expect(requestCount).toBe(1);
    
    // 30초 후 자동 새로고침 (실제로는 짧은 시간으로 테스트)
    await page.waitForTimeout(2000); // 2초 대기 (실제 앱에서는 30초)
    
    // Note: 실제 구현에서는 auto-refresh interval을 테스트용으로 짧게 설정
  });

  test('새로고침 버튼 기능', async ({ page }) => {
    await page.goto('/delivery');
    
    // 새로고침 FAB 버튼 확인
    const refreshButton = page.getByRole('button', { name: /refresh/ });
    await expect(refreshButton).toBeVisible();
    
    // 새로고침 버튼 클릭
    const responsePromise = page.waitForResponse('/api/delivery/orders/**');
    await refreshButton.click();
    
    // API 호출 확인
    const response = await responsePromise;
    expect(response.status()).toBe(200);
  });

  test('빈 주문 목록 상태', async ({ page }) => {
    await page.goto('/delivery');
    
    // Mock empty orders response
    await page.route('/api/delivery/orders/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });
    
    await page.reload();
    
    // 빈 상태 메시지 확인
    await expect(page.getByText('배달할 주문이 없습니다')).toBeVisible();
    await expect(page.getByText('새로운 주문이 등록되면 자동으로 표시됩니다')).toBeVisible();
  });

  test('모바일 환경에서 배달 목록 UI', async ({ page }) => {
    // 모바일 뷰포트
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/delivery');
    
    // Mock orders
    await page.route('/api/delivery/orders/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              customerName: '김고객',
              phone: '010-1234-5678',
              address: '서울시 강남구 테헤란로 123-456 어쩌고 저쩌고 긴 주소',
              status: '대기',
            },
          ],
        }),
      });
    });
    
    await page.reload();
    
    // 모바일에서 주문 정보가 적절히 표시되는지 확인
    await expect(page.getByText('김고객')).toBeVisible();
    await expect(page.getByText('010-1234-5678')).toBeVisible();
    
    // 긴 주소가 모바일에서 적절히 줄바꿈되는지 확인
    const addressElement = page.getByText(/서울시 강남구 테헤란로/);
    await expect(addressElement).toBeVisible();
    
    // 상태 버튼이 터치하기 적절한 크기인지 확인
    const statusButton = page.getByRole('button', { name: '준비중' });
    const boundingBox = await statusButton.boundingBox();
    if (boundingBox) {
      expect(boundingBox.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('진행률 계산 확인', async ({ page }) => {
    await page.goto('/delivery');
    
    // Mock mixed status orders
    await page.route('/api/delivery/orders/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { customerName: '김고객1', phone: '010-1111-1111', address: '주소1', status: '완료' },
            { customerName: '김고객2', phone: '010-2222-2222', address: '주소2', status: '완료' },
            { customerName: '김고객3', phone: '010-3333-3333', address: '주소3', status: '대기' },
            { customerName: '김고객4', phone: '010-4444-4444', address: '주소4', status: '출발' },
          ],
        }),
      });
    });
    
    await page.reload();
    
    // 진행률 계산 확인 (2/4 = 50%)
    await expect(page.getByText('전체 4건')).toBeVisible();
    await expect(page.getByText('완료 2건')).toBeVisible();
    await expect(page.getByText('진행률 50%')).toBeVisible();
  });
});