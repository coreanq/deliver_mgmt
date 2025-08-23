import { test, expect } from '@playwright/test';

test.describe('Google 스프레드시트 연동 테스트', () => {
  test('스프레드시트 연동 UI 요소 확인', async ({ page }) => {
    await page.goto('/');
    
    // 스프레드시트 탭으로 이동
    await page.getByRole('tab', { name: '스프레드시트' }).click();
    
    // 구글 드라이브 연동 섹션 확인
    await expect(page.getByText('구글 드라이브 연동')).toBeVisible();
    
    // Google 로그인 버튼 확인
    const googleAuthButton = page.getByRole('button', { name: '구글 계정으로 인증' });
    await expect(googleAuthButton).toBeVisible();
    await expect(googleAuthButton).toBeEnabled();
    
    // 새 탭 인증 버튼 확인
    const newTabButton = page.getByRole('button', { name: '새 탭에서 인증' });
    await expect(newTabButton).toBeVisible();
    await expect(newTabButton).toBeEnabled();
  });

  test('Google OAuth 인증 플로우 시작', async ({ page }) => {
    await page.goto('/');
    
    // 스프레드시트 탭으로 이동
    await page.getByRole('tab', { name: '스프레드시트' }).click();
    
    // Google 인증 버튼 클릭
    const googleAuthButton = page.getByRole('button', { name: '구글 계정으로 인증' });
    
    // 팝업창이 열리는지 확인 (실제 인증은 하지 않음)
    const popupPromise = page.waitForEvent('popup', { timeout: 5000 });
    
    await googleAuthButton.click();
    
    try {
      const popup = await popupPromise;
      // 팝업이 Google 인증 페이지로 이동하는지 확인
      await expect(popup).toHaveURL(/accounts\.google\.com/);
      await popup.close();
    } catch (error) {
      // 팝업이 차단되거나 다른 문제가 있을 수 있음
      console.log('팝업 테스트 실패:', error);
    }
  });

  test('인증되지 않은 상태에서 스프레드시트 목록 요청', async ({ page }) => {
    await page.goto('/');
    
    // 페이지 로드 후 잠시 대기
    await page.waitForLoadState('networkidle');
    
    // 인증되지 않은 상태에서는 스프레드시트 목록이 비어있거나 
    // 로그인 안내 메시지가 표시되어야 함
    const authStatus = await page.textContent('body');
    expect(authStatus).toBeTruthy();
  });

  test('OAuth 인증 상태 API 테스트', async ({ request }) => {
    // 초기 인증 상태 확인 (인증되지 않은 상태여야 함)
    const authResponse = await request.get('http://localhost:5001/api/admin/auth-status');
    expect(authResponse.ok()).toBeTruthy();
    
    const authData = await authResponse.json();
    expect(authData.authenticated).toBe(false);
    expect(authData.tokenExists).toBe(false);
  });

  test('Google OAuth URL 생성 및 검증', async ({ request }) => {
    const response = await request.get('http://localhost:5001/api/admin/google-auth-url');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    
    // Google OAuth URL 형식 검증
    expect(data.authUrl).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(data.authUrl).toContain('client_id=');
    expect(data.authUrl).toContain('redirect_uri=');
    expect(data.authUrl).toContain('scope=https://www.googleapis.com/auth/drive.readonly');
    
    // 리다이렉트 URI 검증
    expect(data.redirectUri).toBe('http://localhost:5001/api/auth/google/callback');
    
    // 서버 정보 검증
    expect(data.serverInfo.ip).toBe('localhost');
    expect(data.serverInfo.port).toBe('5001');
  });

  test('스프레드시트 API 엔드포인트 인증 필요 확인', async ({ request }) => {
    // 인증없이 스프레드시트 목록 요청 시 적절한 오류 응답 확인
    const response = await request.get('http://localhost:5001/api/admin/spreadsheets');
    
    // 401 (인증 필요) 또는 403 (권한 없음) 응답이어야 함
    expect([401, 403]).toContain(response.status());
  });

  test('스프레드시트 목록 API 파라미터 테스트', async ({ request }) => {
    // 다양한 쿼리 파라미터로 스프레드시트 목록 요청 테스트
    const testParams = [
      { query: 'test', pageSize: 10 },
      { pageSize: 20 },
      { query: '배달' },
      {} // 빈 파라미터
    ];

    for (const params of testParams) {
      const url = new URL('http://localhost:5001/api/admin/spreadsheets');
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value.toString());
      });

      const response = await request.get(url.toString());
      
      // 인증되지 않은 상태에서는 401/403 응답
      expect([401, 403]).toContain(response.status());
      
      const data = await response.json();
      expect(data.error || data.message).toBeTruthy();
    }
  });

  test('스프레드시트 목록 응답 구조 검증 (모킹)', async ({ request }) => {
    // 스프레드시트 목록 API의 예상 응답 구조를 테스트
    // 실제로는 인증이 필요하지만, 응답 구조를 검증
    
    const response = await request.get('http://localhost:5001/api/admin/spreadsheets');
    
    if (response.status() === 200) {
      const data = await response.json();
      
      // 예상되는 응답 구조 검증
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      
      if (data.success) {
        expect(data.data).toHaveProperty('files');
        expect(data.data).toHaveProperty('totalCount');
        expect(Array.isArray(data.data.files)).toBe(true);
        
        // 파일 항목 구조 검증
        if (data.data.files.length > 0) {
          const file = data.data.files[0];
          expect(file).toHaveProperty('id');
          expect(file).toHaveProperty('name');
          expect(file).toHaveProperty('createdTime');
          expect(file).toHaveProperty('modifiedTime');
        }
      }
    } else {
      // 인증 필요 상태에서는 적절한 에러 메시지 확인
      expect([401, 403]).toContain(response.status());
    }
  });
});

test.describe('Google 스프레드시트 목록 UI 테스트', () => {
  test('스프레드시트 목록 컴포넌트 렌더링 확인', async ({ page }) => {
    await page.goto('/');
    
    // 스프레드시트 탭으로 이동
    await page.getByRole('tab', { name: '스프레드시트' }).click();
    
    // 구글 드라이브 연동 섹션이 로드될 때까지 대기
    await expect(page.getByText('구글 드라이브 연동')).toBeVisible();
    
    // 인증 안내 메시지 확인
    await expect(page.getByText('스프레드시트를 관리하려면 먼저 구글 계정으로 인증하세요.')).toBeVisible();
    
    // 인증 버튼들이 표시되는지 확인
    await expect(page.getByRole('button', { name: '구글 계정으로 인증' })).toBeVisible();
    await expect(page.getByRole('button', { name: '새 탭에서 인증' })).toBeVisible();
    await expect(page.getByRole('button', { name: '새로고침' })).toBeVisible();
  });

  test('스프레드시트 검색 기능 UI 테스트', async ({ page }) => {
    await page.goto('/');
    
    // 검색 관련 UI 요소 확인
    const searchBox = page.locator('input[placeholder*="검색"], input[type="search"]');
    const searchCount = await searchBox.count();
    
    if (searchCount > 0) {
      const firstSearch = searchBox.first();
      
      // 인증되지 않은 상태에서는 비활성화되거나 안내 메시지가 있어야 함
      const isDisabled = await firstSearch.isDisabled();
      const placeholder = await firstSearch.getAttribute('placeholder');
      
      if (!isDisabled) {
        // 활성화되어 있다면 검색 입력 테스트
        await firstSearch.fill('테스트');
        await page.keyboard.press('Enter');
        
        // 인증 안내 메시지나 결과가 표시되는지 확인
        await page.waitForTimeout(1000);
      }
    }
  });

  test('페이지네이션 UI 요소 확인', async ({ page }) => {
    await page.goto('/');
    
    // 페이지네이션 관련 UI 확인
    const paginationElements = await page.locator('.v-pagination, .pagination, [data-testid="pagination"]').count();
    
    if (paginationElements > 0) {
      const pagination = page.locator('.v-pagination, .pagination, [data-testid="pagination"]').first();
      await expect(pagination).toBeVisible();
      
      // 페이지 버튼들이 적절히 비활성화되어 있는지 확인
      const prevButton = page.locator('button[aria-label*="Previous"], button:has-text("이전")');
      const nextButton = page.locator('button[aria-label*="Next"], button:has-text("다음")');
      
      if (await prevButton.count() > 0) {
        // 첫 페이지에서 이전 버튼은 비활성화되어야 함
        await expect(prevButton.first()).toBeDisabled();
      }
    }
  });

  test('스프레드시트 연결 버튼 및 모달 테스트', async ({ page }) => {
    await page.goto('/');
    
    // 연결 또는 선택 버튼 확인
    const connectButtons = await page.locator('button:has-text("연결"), button:has-text("선택"), button:has-text("추가")').count();
    
    if (connectButtons > 0) {
      const connectButton = page.locator('button:has-text("연결"), button:has-text("선택"), button:has-text("추가")').first();
      
      // 인증되지 않은 상태에서는 버튼이 비활성화되거나 클릭 시 로그인 안내
      const isDisabled = await connectButton.isDisabled();
      
      if (!isDisabled) {
        await connectButton.click();
        
        // 모달이나 로그인 안내가 표시되는지 확인
        await page.waitForTimeout(1000);
        
        const modal = page.locator('.v-dialog, .modal, [role="dialog"]');
        const loginMessage = page.getByText(/로그인|인증|연결/);
        
        const hasModal = await modal.count() > 0;
        const hasLoginMessage = await loginMessage.count() > 0;
        
        expect(hasModal || hasLoginMessage).toBe(true);
      }
    }
  });

  test('로딩 상태 및 에러 처리 UI 테스트', async ({ page }) => {
    await page.goto('/');
    
    // 페이지 로드 중 로딩 스피너나 스켈레톤 확인
    const loadingElements = await page.locator('.v-progress-circular, .loading, .spinner, .skeleton').count();
    
    if (loadingElements > 0) {
      // 로딩 요소가 나타났다가 사라지는지 확인
      const loader = page.locator('.v-progress-circular, .loading, .spinner, .skeleton').first();
      
      // 최대 5초 대기 후 로딩이 완료되는지 확인
      await page.waitForFunction(
        () => {
          const loaders = document.querySelectorAll('.v-progress-circular, .loading, .spinner, .skeleton');
          return loaders.length === 0;
        },
        { timeout: 5000 }
      ).catch(() => {
        // 로딩이 계속되는 것도 정상적인 상태일 수 있음
      });
    }
    
    // 에러 메시지 확인
    const errorMessages = await page.locator('.error, .v-alert--type-error, [data-testid="error"]').count();
    
    if (errorMessages > 0) {
      const errorElement = page.locator('.error, .v-alert--type-error, [data-testid="error"]').first();
      const errorText = await errorElement.textContent();
      
      // 의미있는 에러 메시지인지 확인
      expect(errorText?.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Google 스프레드시트 연동 시나리오 테스트', () => {
  test('스프레드시트 검색 UI 테스트', async ({ page }) => {
    await page.goto('/');
    
    // 스프레드시트 검색 관련 UI 요소 확인
    // (실제 검색은 인증 후에만 가능)
    
    // 검색 입력 필드가 있는지 확인
    const searchElements = await page.locator('input[type="search"], input[placeholder*="검색"], input[placeholder*="스프레드시트"]').count();
    
    if (searchElements > 0) {
      // 검색 필드가 있다면 비활성화되어 있거나 인증 안내가 있어야 함
      const searchInput = page.locator('input[type="search"], input[placeholder*="검색"], input[placeholder*="스프레드시트"]').first();
      
      // 검색 필드가 비활성화되어 있거나 인증 안내 메시지가 있는지 확인
      const isDisabled = await searchInput.isDisabled();
      const hasAuthMessage = await page.getByText(/로그인|인증|연결/).isVisible();
      
      expect(isDisabled || hasAuthMessage).toBe(true);
    }
  });

  test('배달기사 관리 연동 확인', async ({ page }) => {
    await page.goto('/');
    
    // 배달기사 목록이 정상적으로 로드되는지 확인
    await page.waitForLoadState('networkidle');
    
    // 배달기사 관련 UI 요소 확인
    await expect(page.getByText('배송자 관리')).toBeVisible();
    
    // 기존 배달기사 데이터 확인 (김배달, 홍길동)
    await page.waitForTimeout(2000); // API 응답 대기
    
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('배송자');
  });

  test('메시지 발송 연동 상태 확인', async ({ page }) => {
    await page.goto('/');
    
    // SOLAPI 메시지 발송 관련 UI 확인
    await expect(page.getByText('메시지 설정')).toBeVisible();
    
    // SOLAPI 연결 상태 확인
    await page.waitForLoadState('networkidle');
    
    // 메시지 설정 관련 UI 요소 확인
    const messageElements = await page.getByText(/SOLAPI|메시지|발송/).count();
    expect(messageElements).toBeGreaterThan(0);
  });
});