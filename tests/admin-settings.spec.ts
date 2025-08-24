import { test, expect } from '@playwright/test';

test.describe('관리자 설정 UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
  });

  test('관리자 설정 페이지 기본 UI 확인', async ({ page }) => {
    // 페이지 제목 확인
    await expect(page).toHaveTitle(/배달 관리 시스템/);
    
    // 메인 제목 확인
    await expect(page.getByRole('heading', { name: '관리자 설정' })).toBeVisible();
    
    // 구글 스프레드시트 연동 섹션 확인
    await expect(page.getByText('구글 스프레드시트 연동')).toBeVisible();
    await expect(page.getByText('연결 안됨')).toBeVisible();
    await expect(page.getByRole('button', { name: '구글 스프레드시트 연결하기' })).toBeVisible();
    
    // SOLAPI 연동 섹션 확인
    await expect(page.getByText('SOLAPI 카카오톡 연동')).toBeVisible();
    await expect(page.getByRole('button', { name: 'SOLAPI로 로그인' })).toBeVisible();
  });

  test('구글 스프레드시트 연결 버튼 클릭', async ({ page }) => {
    // 연결 버튼 클릭
    const connectButton = page.getByRole('button', { name: '구글 스프레드시트 연결하기' });
    await expect(connectButton).toBeVisible();
    
    // 버튼 클릭 시 Google OAuth URL로 리다이렉트되어야 함
    const responsePromise = page.waitForResponse('/api/auth/google');
    await connectButton.click();
    
    // OAuth 리다이렉트 확인 (실제 Google OAuth는 mock 환경에서 테스트)
    const response = await responsePromise;
    expect(response.status()).toBe(302);
  });

  test('SOLAPI 연결 버튼 클릭', async ({ page }) => {
    // SOLAPI 연결 버튼 클릭
    const solapiButton = page.getByRole('button', { name: 'SOLAPI로 로그인' });
    await expect(solapiButton).toBeVisible();
    
    // 버튼 클릭 시 SOLAPI OAuth URL로 리다이렉트되어야 함
    const responsePromise = page.waitForResponse('/api/auth/solapi');
    await solapiButton.click();
    
    // OAuth 리다이렉트 확인
    const response = await responsePromise;
    expect(response.status()).toBe(302);
  });

  test('배달담당자 추가 기능', async ({ page }) => {
    // Mock Google 인증 상태로 설정 (실제로는 OAuth 완료 후 상태)
    await page.evaluate(() => {
      // Simulate authenticated state
      window.localStorage.setItem('googleAuth', 'true');
    });
    
    await page.reload();
    
    // 배달담당자 관리 섹션이 보여야 함
    await expect(page.getByText('배달담당자 관리')).toBeVisible();
    
    // 배달담당자 이름 입력
    const nameInput = page.getByLabel('배달담당자 이름');
    await nameInput.fill('김배달');
    
    // 추가 버튼 클릭
    const addButton = page.getByRole('button', { name: '배달담당자 추가' });
    await addButton.click();
    
    // 추가된 배달담당자가 목록에 표시되어야 함
    await expect(page.getByText('김배달')).toBeVisible();
    
    // QR 코드 생성 버튼 확인
    await expect(page.getByRole('button', { name: /qrcode/ })).toBeVisible();
    
    // 삭제 버튼 확인
    await expect(page.getByRole('button', { name: /delete/ })).toBeVisible();
  });

  test('빈 이름으로 배달담당자 추가 시도', async ({ page }) => {
    // Mock Google 인증 상태
    await page.evaluate(() => {
      window.localStorage.setItem('googleAuth', 'true');
    });
    
    await page.reload();
    
    // 빈 이름으로 추가 버튼 클릭
    const addButton = page.getByRole('button', { name: '배달담당자 추가' });
    await expect(addButton).toBeDisabled();
    
    // 공백만 입력했을 때도 버튼이 비활성화되어야 함
    const nameInput = page.getByLabel('배달담당자 이름');
    await nameInput.fill('   ');
    await expect(addButton).toBeDisabled();
  });

  test('QR 코드 생성 기능', async ({ page }) => {
    // Mock Google 인증 상태 및 배달담당자 추가
    await page.evaluate(() => {
      window.localStorage.setItem('googleAuth', 'true');
    });
    
    await page.reload();
    
    // 배달담당자 추가
    const nameInput = page.getByLabel('배달담당자 이름');
    await nameInput.fill('김배달');
    await page.getByRole('button', { name: '배달담당자 추가' }).click();
    
    // QR 코드 생성 버튼 클릭
    const qrButton = page.getByRole('button', { name: /qrcode/ }).first();
    
    // API 호출 모니터링
    const responsePromise = page.waitForResponse('/api/delivery/qr/generate/**');
    await qrButton.click();
    
    // QR 생성 API 호출 확인
    const response = await responsePromise;
    expect(response.status()).toBe(200);
  });

  test('다크 모드 토글 기능', async ({ page }) => {
    // 다크 모드 토글 버튼 확인
    const themeToggle = page.getByRole('button', { name: /white-balance-sunny|weather-night/ });
    await expect(themeToggle).toBeVisible();
    
    // 다크 모드 토글
    await themeToggle.click();
    
    // 테마 변경 확인 (body 클래스 또는 CSS 변수 확인)
    // Note: Vuetify 테마 변경은 DOM 구조에 따라 다를 수 있음
  });

  test('연결 해제 기능', async ({ page }) => {
    // Mock 인증된 상태로 설정
    await page.evaluate(() => {
      window.localStorage.setItem('googleAuth', 'true');
      window.localStorage.setItem('solapiAuth', 'true');
    });
    
    await page.reload();
    
    // 연결됨 상태 확인
    await expect(page.getByText('연결됨').first()).toBeVisible();
    
    // 연결 해제 버튼 클릭
    const disconnectButton = page.getByRole('button', { name: '연결 해제' }).first();
    await disconnectButton.click();
    
    // 연결 해제 후 상태 확인
    await expect(page.getByText('연결 안됨')).toBeVisible();
  });

  test('반응형 디자인 확인 - 모바일', async ({ page }) => {
    // 모바일 뷰포트로 설정
    await page.setViewportSize({ width: 375, height: 667 });
    
    // 모바일에서도 모든 주요 요소가 보여야 함
    await expect(page.getByText('관리자 설정')).toBeVisible();
    await expect(page.getByText('구글 스프레드시트 연동')).toBeVisible();
    await expect(page.getByText('SOLAPI 카카오톡 연동')).toBeVisible();
    
    // 버튼들이 터치하기 적절한 크기여야 함
    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const boundingBox = await button.boundingBox();
      if (boundingBox) {
        // 최소 터치 타겟 크기 확인 (44px x 44px)
        expect(boundingBox.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('에러 상태 처리', async ({ page }) => {
    // 네트워크 오류 시뮬레이션
    await page.route('/api/auth/google', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: '서버 오류가 발생했습니다.',
        }),
      });
    });
    
    // 연결 버튼 클릭
    await page.getByRole('button', { name: '구글 스프레드시트 연결하기' }).click();
    
    // 에러 메시지 또는 적절한 피드백이 표시되어야 함
    // Note: 실제 구현에서는 snackbar나 alert로 에러 표시
  });
});