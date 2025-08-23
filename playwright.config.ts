import { defineConfig, devices } from '@playwright/test';

/**
 * 배달 관리 시스템 E2E 테스트 설정
 */
export default defineConfig({
  testDir: './tests',
  /* 테스트 실행 시 병렬로 실행할 최대 작업자 수 */
  fullyParallel: true,
  /* CI에서 실패 시 재시도 방지 */
  forbidOnly: !!process.env.CI,
  /* CI에서만 재시도 */
  retries: process.env.CI ? 2 : 0,
  /* 로컬에서는 1개, CI에서는 병렬 실행 */
  workers: process.env.CI ? 1 : undefined,
  /* 리포터 설정 */
  reporter: 'html',
  /* 모든 테스트에 대한 공통 설정 */
  use: {
    /* 실패 시 스크린샷 */
    screenshot: 'only-on-failure',
    /* 실패 시 동영상 */
    video: 'retain-on-failure',
    /* Base URL 설정 */
    baseURL: 'http://localhost:3000',
    /* 각 테스트 트레이스 수집 */
    trace: 'on-first-retry',
  },

  /* 프로젝트별 브라우저 설정 */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* 모바일 테스트 */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* 로컬 개발 서버 설정 */
  webServer: [
    {
      command: 'npm run dev:backend',
      port: 5001,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000, // 2분
    },
    {
      command: 'npm run dev:frontend',
      port: 3000, 
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000, // 2분
    },
  ],
});