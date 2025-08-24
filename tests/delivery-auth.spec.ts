import { test, expect } from '@playwright/test';

test.describe('배달담당자 인증 시스템', () => {
  test('QR 코드 없이 접근 시 오류 메시지', async ({ page }) => {
    await page.goto('/delivery/auth');
    
    // QR 파라미터 없이 접근 시 오류 메시지 확인
    await expect(page.getByText('유효하지 않은 QR 코드입니다')).toBeVisible();
  });

  test('유효한 QR 토큰으로 접근', async ({ page }) => {
    // Mock valid QR token
    const mockStaffName = '김배달';
    const mockToken = 'valid_mock_token';
    
    await page.goto(`/delivery/auth?staff=${mockStaffName}&token=${mockToken}`);
    
    // QR 인증 후 이름 입력 단계로 진행
    await expect(page.getByText('본인 확인')).toBeVisible();
    await expect(page.getByText(`QR 코드에 등록된 배달담당자명: ${mockStaffName}`)).toBeVisible();
    await expect(page.getByLabel('본인 이름 입력')).toBeVisible();
  });

  test('이름 확인 인증 - 성공 케이스', async ({ page }) => {
    const mockStaffName = '김배달';
    const mockToken = 'valid_mock_token';
    
    await page.goto(`/delivery/auth?staff=${mockStaffName}&token=${mockToken}`);
    
    // 올바른 이름 입력
    const nameInput = page.getByLabel('본인 이름 입력');
    await nameInput.fill(mockStaffName);
    
    // 확인 버튼 클릭
    await page.getByRole('button', { name: '확인' }).click();
    
    // 인증 성공 메시지 확인
    await expect(page.getByText('인증 완료')).toBeVisible();
    await expect(page.getByText(`${mockStaffName}님, 환영합니다!`)).toBeVisible();
  });

  test('이름 확인 인증 - 실패 케이스', async ({ page }) => {
    const mockStaffName = '김배달';
    const wrongName = '이배달';
    const mockToken = 'valid_mock_token';
    
    await page.goto(`/delivery/auth?staff=${mockStaffName}&token=${mockToken}`);
    
    // 잘못된 이름 입력
    const nameInput = page.getByLabel('본인 이름 입력');
    await nameInput.fill(wrongName);
    
    // 확인 버튼 클릭
    await page.getByRole('button', { name: '확인' }).click();
    
    // 오류 메시지 확인
    await expect(page.getByText('이름이 일치하지 않습니다. 다시 확인해주세요.')).toBeVisible();
  });

  test('빈 이름으로 인증 시도', async ({ page }) => {
    const mockStaffName = '김배달';
    const mockToken = 'valid_mock_token';
    
    await page.goto(`/delivery/auth?staff=${mockStaffName}&token=${mockToken}`);
    
    // 빈 이름으로 확인 버튼 클릭 시도
    const confirmButton = page.getByRole('button', { name: '확인' });
    await expect(confirmButton).toBeDisabled();
    
    // 공백만 입력했을 때
    const nameInput = page.getByLabel('본인 이름 입력');
    await nameInput.fill('   ');
    await expect(confirmButton).toBeDisabled();
  });

  test('Enter 키로 이름 확인', async ({ page }) => {
    const mockStaffName = '김배달';
    const mockToken = 'valid_mock_token';
    
    await page.goto(`/delivery/auth?staff=${mockStaffName}&token=${mockToken}`);
    
    // 이름 입력 후 Enter 키 누르기
    const nameInput = page.getByLabel('본인 이름 입력');
    await nameInput.fill(mockStaffName);
    await nameInput.press('Enter');
    
    // 인증 완료 확인
    await expect(page.getByText('인증 완료')).toBeVisible();
  });

  test('인증 완료 후 배달 목록으로 자동 이동', async ({ page }) => {
    const mockStaffName = '김배달';
    const mockToken = 'valid_mock_token';
    
    await page.goto(`/delivery/auth?staff=${mockStaffName}&token=${mockToken}`);
    
    // 인증 과정 완료
    await page.getByLabel('본인 이름 입력').fill(mockStaffName);
    await page.getByRole('button', { name: '확인' }).click();
    
    // 2초 후 배달 목록으로 리다이렉트되어야 함
    await page.waitForURL('/delivery', { timeout: 3000 });
    await expect(page).toHaveURL('/delivery');
  });

  test('모바일 환경에서 QR 스캔 UI', async ({ page }) => {
    // 모바일 뷰포트로 설정
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/delivery/auth');
    
    // 모바일에서 QR 스캔 UI 확인
    await expect(page.getByText('QR 코드를 스캔해주세요')).toBeVisible();
    
    // QR 아이콘 확인
    const qrIcon = page.locator('[data-testid="qr-icon"], .mdi-qrcode-scan').first();
    await expect(qrIcon).toBeVisible();
    
    // 텍스트가 모바일에서 읽기 좋은 크기여야 함
    const titleElement = page.getByText('배달담당자 인증');
    const fontSize = await titleElement.evaluate(el => 
      window.getComputedStyle(el).fontSize
    );
    
    // 모바일에서 적절한 폰트 크기 확인 (최소 16px)
    const fontSizeNum = parseInt(fontSize);
    expect(fontSizeNum).toBeGreaterThanOrEqual(16);
  });
});