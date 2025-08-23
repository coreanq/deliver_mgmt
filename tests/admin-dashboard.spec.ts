import { test, expect } from '@playwright/test';

test.describe('관리자 대시보드', () => {
  test('페이지 로드 및 기본 요소 확인', async ({ page }) => {
    // 관리자 대시보드 페이지로 이동
    await page.goto('/');
    
    // 페이지 제목 확인
    await expect(page).toHaveTitle(/배달 관리 시스템/);
    
    // 주요 탭 확인
    await expect(page.getByRole('tab', { name: '배달기사 관리' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '스프레드시트' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '카카오톡' })).toBeVisible();
    
    // 헤더 확인
    await expect(page.getByText('관리자 설정')).toBeVisible();
    await expect(page.getByText('배달 관리 시스템의 모든 설정을 관리합니다')).toBeVisible();
  });

  test('API 연결 상태 확인', async ({ page }) => {
    await page.goto('/');
    
    // 페이지가 로드될 때까지 대기
    await page.waitForLoadState('networkidle');
    
    // API 오류가 없는지 확인 (콘솔에서 404 오류 등 체크)
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // 페이지 새로고침하여 API 호출 트리거
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // 심각한 API 오류가 없는지 확인
    const criticalErrors = errors.filter(error => 
      error.includes('404') || 
      error.includes('500') || 
      error.includes('Network Error')
    );
    
    expect(criticalErrors.length).toBe(0);
  });

  test('Google OAuth 버튼 존재 확인', async ({ page }) => {
    await page.goto('/');
    
    // 스프레드시트 탭으로 이동
    await page.getByRole('tab', { name: '스프레드시트' }).click();
    
    // 구글 인증 버튼이 표시되는지 확인
    await expect(page.getByRole('button', { name: '구글 계정으로 인증' })).toBeVisible();
    await expect(page.getByRole('button', { name: '새 탭에서 인증' })).toBeVisible();
  });

  test('배송자 목록 섹션 확인', async ({ page }) => {
    await page.goto('/');
    
    // 기본적으로 배달기사 관리 탭이 선택되어 있음
    await expect(page.getByRole('tab', { name: '배달기사 관리' })).toHaveAttribute('aria-selected', 'true');
    
    // 배달기사 관리 섹션 헤더 확인
    await expect(page.getByText('배달기사 관리')).toBeVisible();
    
    // 배달기사 추가 버튼 확인
    await expect(page.getByRole('button', { name: '배달기사 추가' })).toBeVisible();
    
    // 배달기사 목록 테이블이 로드되는지 확인
    await expect(page.locator('table')).toBeVisible();
    
    // 테이블 헤더 확인
    await expect(page.getByText('이름')).toBeVisible();
    await expect(page.getByText('연락처')).toBeVisible();
    await expect(page.getByText('상태')).toBeVisible();
  });

  test('SOLAPI 연동 상태 확인', async ({ page }) => {
    await page.goto('/');
    
    // 카카오톡 탭으로 이동
    await page.getByRole('tab', { name: '카카오톡' }).click();
    
    // 카카오톡 관련 UI 요소가 로드될 때까지 대기
    await page.waitForLoadState('networkidle');
    
    // SOLAPI 연결 상태가 상단에 표시됨
    await expect(page.getByText('SOLAPI 미연결')).toBeVisible();
  });
});

test.describe('API 엔드포인트 테스트', () => {
  test('백엔드 API 기본 응답 확인', async ({ request }) => {
    // 백엔드 API 기본 엔드포인트 테스트
    const response = await request.get('http://localhost:5001/');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.message).toContain('배달 관리 시스템');
    expect(data.status).toBe('running');
  });

  test('배송자 목록 API 테스트', async ({ request }) => {
    const response = await request.get('http://localhost:5001/api/admin/delivery-staff');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('SOLAPI 상태 API 테스트', async ({ request }) => {
    const response = await request.get('http://localhost:5001/api/solapi/status');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(typeof data.authenticated).toBe('boolean');
  });

  test('Google OAuth URL 생성 API 테스트', async ({ request }) => {
    const response = await request.get('http://localhost:5001/api/admin/google-auth-url');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.authUrl).toContain('accounts.google.com');
    expect(data.redirectUri).toContain('localhost:5001');
  });
});