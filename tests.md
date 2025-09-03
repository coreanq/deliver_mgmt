# 테스트 시나리오 가이드

## 자동화 시스템 전체 테스트 시퀀스

### 전제 조건
- 개발 서버 실행: `npm run dev` (프론트엔드: 5173, 백엔드: 5001)
- Google OAuth2 연결 완료
- SOLAPI OAuth2 연결 완료
- 테스트용 스프레드시트 준비 (예: 20250825)

### 테스트 시퀀스

#### 1. 자동화 규칙 설정 테스트
1. 브라우저에서 `http://localhost:5173` 접근
2. Google OAuth2 로그인 완료
3. SOLAPI OAuth2 로그인 완료
4. 날짜 선택: 8월 25일 클릭
5. 자동화 설정 섹션에서:
   - 컬럼 선택: "배송상태"
   - 트리거 값: "배송 완료"
   - 동작: "문자메시지 발송하기"
   - 발신번호: "010-3091-7061"
   - 수신자: "고객 연락처"
   - 메시지: "#{고객명}님, 배송이 완료되었습니다. 감사합니다!"
6. "자동화 규칙 저장" 버튼 클릭
7. 저장된 규칙이 하단에 표시되는지 확인

#### 2. 담당자 모바일 인터페이스 테스트
1. 관리자 페이지에서 임의 고객의 "담당자" 버튼 클릭
2. 새 탭에서 담당자 모바일 화면 열림 확인
3. 담당자별 배송 현황 표시 확인:
   - 총 배송 건수
   - 완료된 배송 건수
   - 진행률 표시
4. 개별 고객 정보 확인:
   - 고객명, 배송지, 연락처
   - 현재 배송 상태
   - 상태별 버튼 활성화

#### 3. 배송 상태 변경 테스트

##### 3-1. Production 모드 (Google Apps Script 웹훅 설정 완료 시)
1. "배송 준비중" 상태의 고객 선택
2. "배송 출발" 버튼 클릭
3. 상태 변경 성공 메시지 확인
4. 페이지 자동 새로고침 후 상태 업데이트 확인
5. "배송 완료" 버튼 활성화 확인
6. "배송 완료" 버튼 클릭
7. 최종 상태 변경 완료 확인

##### 3-2. 직접 SMS 통합 테스트 (2025-09-01)
배송 상태 변경 시 즉시 SMS 발송되는 새로운 시스템:

1. **실제 배송 상태 변경을 통한 SMS 테스트**:
   - 담당자 모바일 화면에서 "배송 완료" 버튼 클릭
   - Google Sheets 상태 업데이트 성공 확인
   - 즉시 SMS/LMS 자동 발송 (웹훅 없음)

2. **백엔드 로그에서 확인할 내용**:
   ```
   Updated status to 배송 완료 for row X in column E in sheet 시트1
   Checking automation rules for SMS sending...
   Found 1 matching rules for user email@gmail.com
   Message length: 174 bytes, using type: LMS
   SMS sent successfully via rule: 배송상태 → 배송 완료
   ```

3. **장점**:
   - Google Apps Script 설정 불필요
   - 웹훅 지연 없이 즉시 SMS 발송
   - API 응답과 함께 SMS 처리 상태 확인 가능

#### 4. 백엔드 로그 확인
백엔드 콘솔에서 다음 로그 확인:
```
Updated status to 배송 출발 for row X in column E in sheet 시트1
Updated status to 배송 완료 for row X in column E in sheet 시트1
```

### 예상 결과

#### ✅ 정상 동작 확인사항
- 자동화 규칙 저장 성공
- 담당자 모바일 인터페이스 정상 표시
- 배송 상태 변경 성공 (준비중 → 출발 → 완료)
- Google Sheets 데이터 실시간 업데이트

#### ✅ 직접 SMS 통합 (2025-09-01 업데이트)
- **웹훅 시스템 대체**: 이제 Google Sheets 상태 업데이트 후 즉시 SMS 발송
- **자동 메시지 타입**: 90바이트 이상 시 자동으로 LMS 전송
- **Google Apps Script 불필요**: 더 이상 웹훅 설정 필요 없음

### Google Apps Script 웹훅 설정 (향후 완성 필요)

자동화 시스템을 완전히 작동시키려면 Google Sheets에 다음 스크립트 추가:

```javascript
function onEdit(e) {
  const webhookUrl = 'http://localhost:5001/api/automation/trigger'; // 또는 production URL
  
  const sheet = e.source.getActiveSheet();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const range = e.range;
  const sheetName = sheet.getName();
  const spreadsheetName = spreadsheet.getName(); // "20250825"
  const spreadsheetId = spreadsheet.getId();     // "1Xb0jJIAl1VO8e6vhPifnr-XX2Jo03bGZHwaYzMut7WU"
  const columnName = sheet.getRange(1, range.getColumn()).getValue();
  const oldValue = e.oldValue || '';
  const newValue = e.value || '';
  
  // Get full row data
  const lastColumn = sheet.getLastColumn();
  const headerRange = sheet.getRange(1, 1, 1, lastColumn);
  const headers = headerRange.getValues()[0];
  
  const rowData = {};
  const rowValues = sheet.getRange(range.getRow(), 1, 1, lastColumn).getValues()[0];
  
  headers.forEach((header, index) => {
    rowData[header] = rowValues[index];
  });
  
  const payload = {
    sheetName: sheetName,              // "시트1"
    spreadsheetName: spreadsheetName,   // "20250825"
    spreadsheetId: spreadsheetId,       // "1Xb0jJIAl1VO8e6vhPifnr-XX2Jo03bGZHwaYzMut7WU"
    sheetDate: spreadsheetName,         // "20250825" (날짜 매칭용)
    rowIndex: range.getRow(),
    columnName: columnName,
    columnIndex: range.getColumn(),
    oldValue: oldValue,
    newValue: newValue,
    rowData: rowData,
    timestamp: new Date().toISOString()
  };
  
  try {
    UrlFetchApp.fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload)
    });
    
    console.log('Webhook sent successfully');
  } catch (error) {
    console.error('Failed to send webhook:', error);
  }
}
```

### 디버깅 팁

1. **백엔드 로그 모니터링**: `npm run local` 실행 중인 터미널에서 실시간 로그 확인
2. **프론트엔드 콘솔 확인**: 브라우저 개발자 도구에서 네트워크 요청 및 콘솔 로그 확인
3. **Google Sheets 연동**: 실시간으로 Google Sheets에서 데이터 변경 확인
4. **SOLAPI 잔액 확인**: SMS 발송을 위한 충분한 잔액 보유 확인

### 테스트 데이터 예시

테스트용 Google Sheets 데이터 구조:
```
| 배송지 | 고객명 | 고객 연락처 | 배송 담당자 | 배송상태 |
|--------|--------|-------------|-------------|----------|
| 주소1  | 1번 고객| 010-3091-7062| 박국철     | 배송 준비중|
| 주소2  | 2번 고객| 010-2709-1633| 박국철     | 배송 준비중|
| 주소3  | 3번 고객| 010-3091-7064| 박국철     | 배송 준비중|
| 주소4  | 4번 고객| 010-2709-1635| 박국철     | 상품 준비중|
| 주소5  | 5번 고객| 010-2709-1636| 박국철     | 배송 완료 |
```

### 성공 기준

- [x] 자동화 규칙 저장 성공
- [x] 담당자 모바일 인터페이스 정상 동작
- [x] 배송 상태 변경 성공
- [x] Google Sheets 실시간 업데이트
- [x] ~~Google Apps Script 웹훅 설정~~ (불필요 - 직접 SMS 통합으로 대체)
- [x] SMS 자동 발송 확인 (직접 통합으로 즉시 발송)

## Google OAuth2 토큰 갱신 테스트 (2025-09-03 업데이트)

### 토큰 갱신 시스템 테스트 시나리오

#### 1. 자동 토큰 갱신 테스트
**목적**: 백엔드에서 토큰 만료 5분 전 자동 갱신 확인

1. **테스트 설정**:
   - 개발자 도구에서 Application > Storage > Cookies 확인
   - `sessionId` 쿠키 존재 확인
   - 백엔드 로그에서 토큰 갱신 로그 모니터링

2. **테스트 수행**:
   - 관리자 페이지에서 API 요청 실행 (달력 날짜 선택 등)
   - 백엔드 콘솔에서 다음 로그 확인:
   ```
   Google access token refreshed successfully {
     expiryDate: "2025-09-03T10:15:30.000Z",
     expiresInSeconds: 3599
   }
   Token refreshed successfully
   ```

3. **예상 결과**:
   - 토큰 만료 5분 전 자동 갱신
   - 실제 Google OAuth2 응답의 `expiry_date` 사용 (1시간)
   - 사용자는 갱신 과정을 인지하지 못함

#### 2. 장기간 미접속 후 재방문 테스트
**목적**: Refresh Token을 통한 자동 토큰 갱신 확인

1. **테스트 설정**:
   - Google OAuth2 로그인 완료 후 브라우저 종료
   - 1시간 이상 대기 (Access Token 만료)
   - 브라우저 재시작 및 사이트 접속

2. **테스트 수행**:
   - `http://localhost:5173/admin` 직접 접속
   - 첫 번째 API 요청 시 자동 토큰 갱신 확인
   - 백엔드 로그 모니터링:
   ```
   Google access token refreshed successfully {
     expiryDate: "2025-09-03T11:30:45.000Z",
     expiresInSeconds: 3599
   }
   ```

3. **예상 결과**:
   - 재로그인 없이 자동으로 새 Access Token 발급
   - 기존 데이터(자동화 규칙 등) 모두 유지
   - 정상적인 서비스 이용 가능

#### 3. 토큰 갱신 실패 처리 테스트
**목적**: Refresh Token 만료 시 적절한 에러 처리 확인

1. **테스트 설정** (시뮬레이션):
   - KV Storage에서 사용자 데이터의 `refreshToken` 제거
   - 또는 Google 계정에서 앱 연결 해제

2. **테스트 수행**:
   - API 요청 실행
   - 백엔드에서 401 Unauthorized 응답 확인
   - 프론트엔드에서 로그인 페이지 리다이렉트 확인

3. **예상 결과**:
   ```json
   {
     "success": false,
     "message": "인증 토큰 갱신에 실패했습니다. 다시 로그인해주세요."
   }
   ```

#### 4. 실제 만료 시간 검증 테스트
**목적**: 하드코딩된 18시간 대신 Google 실제 응답 사용 확인

1. **테스트 방법**:
   - 백엔드 로그에서 토큰 갱신 시 출력되는 만료 시간 확인
   - 실제 Google OAuth2 표준 1시간 만료 시간 반영 확인

2. **백엔드 로그 확인**:
   ```
   Google OAuth tokens obtained successfully {
     expiryDate: "2025-09-03T12:00:00.000Z",
     expiresInSeconds: 3600  // 정확히 1시간 (3600초)
   }
   ```

3. **검증 포인트**:
   - `expiresInSeconds`가 3600 (1시간)인지 확인
   - 이전의 잘못된 18시간 설정이 사용되지 않는지 확인

### 토큰 갱신 관련 Playwright E2E 테스트 케이스

#### Test Case: Google OAuth2 Token Auto-Refresh
```javascript
test('Google OAuth2 token should auto-refresh before expiry', async ({ page }) => {
  // 1. Login and verify initial token
  await page.goto('/admin');
  await page.click('text=Google 스프레드시트 연결하기');
  // ... OAuth flow completion
  
  // 2. Verify token refresh on API calls
  const responsePromise = page.waitForResponse('/api/sheets/**');
  await page.click('[data-testid="calendar-date"]');
  const response = await responsePromise;
  
  // 3. Verify successful API response (token was refreshed if needed)
  expect(response.status()).toBe(200);
});

test('Long-term session persistence after token expiry', async ({ page, context }) => {
  // 1. Complete OAuth login
  await page.goto('/admin');
  // ... complete OAuth flow
  
  // 2. Store session cookies and close browser
  const cookies = await context.cookies();
  const sessionCookie = cookies.find(c => c.name === 'sessionId');
  expect(sessionCookie).toBeTruthy();
  
  await context.close();
  
  // 3. Simulate new session with expired access token
  const newContext = await browser.newContext();
  await newContext.addCookies(cookies);
  const newPage = await newContext.newPage();
  
  // 4. Verify auto-refresh works on first API call
  await newPage.goto('/admin');
  const responsePromise = newPage.waitForResponse('/api/auth/status');
  const response = await responsePromise;
  
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.success).toBe(true);
  expect(data.data.google).toBe(true);
});
```

### 알려진 이슈

1. **CORS 이슈**: 로컬 개발 환경에서 간헐적 발생 가능
2. **Google Sheets API 지연**: 대용량 데이터 처리 시 응답 지연 가능
3. **SOLAPI 잔액 부족**: SMS 발송 실패 원인
4. **웹훅 URL**: 프로덕션 환경에서는 HTTPS URL 필요
5. **토큰 갱신 테스트**: Google OAuth2 테스트 환경에서는 실제 1시간 대기가 어려움
