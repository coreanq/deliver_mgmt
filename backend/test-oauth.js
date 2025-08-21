#!/usr/bin/env node

const readline = require('readline');
const { exec } = require('child_process');

const API_BASE = 'http://localhost:5001/api/solapi';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function apiCall(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const curlCmd = data 
      ? `curl -s -X ${method} -H "Content-Type: application/json" -d '${JSON.stringify(data)}' ${API_BASE}${endpoint}`
      : `curl -s -X ${method} ${API_BASE}${endpoint}`;
    
    exec(curlCmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`JSON 파싱 오류: ${stdout}`));
      }
    });
  });
}

function printResult(title, result) {
  console.log(`\n📋 ${title}`);
  console.log('=' .repeat(50));
  console.log(`상태: ${result.success ? '✅ 성공' : '❌ 실패'}`);
  console.log(`메시지: ${result.message || 'N/A'}`);
  if (result.data) {
    console.log(`데이터:\n${JSON.stringify(result.data, null, 2)}`);
  }
  console.log('');
}

async function main() {
  console.log('🔐 SOLAPI OAuth2 간단 테스트 도구');
  console.log('=====================================\n');

  try {
    // 1. 설정 확인
    console.log('1. 설정 확인 중...');
    const config = await apiCall('/debug/config');
    printResult('SOLAPI 설정', config);

    // 2. 인증 상태 확인
    console.log('2. 인증 상태 확인 중...');
    const authStatus = await apiCall('/auth/status');
    printResult('인증 상태', authStatus);

    if (!authStatus.authenticated) {
      // 3. OAuth2 URL 생성
      console.log('3. OAuth2 인증 URL 생성 중...');
      const loginResult = await apiCall('/auth/login');
      printResult('OAuth2 로그인', loginResult);

      if (loginResult.success) {
        console.log(`🌐 브라우저에서 다음 URL로 이동하여 인증을 완료하세요:`);
        console.log(`${loginResult.authUrl}\n`);
        
        rl.question('인증 완료 후 Enter를 누르세요...', async (answer) => {
          // 4. 인증 후 상태 재확인
          console.log('4. 인증 완료 후 상태 확인 중...');
          const newAuthStatus = await apiCall('/auth/status');
          printResult('인증 상태 (재확인)', newAuthStatus);
          
          if (newAuthStatus.authenticated) {
            // 5. 계정 정보 조회
            console.log('5. 계정 정보 조회 중...');
            const accountInfo = await apiCall('/account');
            printResult('계정 정보', accountInfo);

            // 6. 발신번호 목록
            console.log('6. 발신번호 목록 조회 중...');
            const senders = await apiCall('/senders');
            printResult('발신번호 목록', senders);

            // 7. Hello World 테스트
            rl.question('Hello World 메시지를 보낼 번호를 입력하세요 (예: 01012345678): ', async (to) => {
              rl.question('발신번호를 입력하세요 (예: 01087654321): ', async (from) => {
                if (to && from) {
                  console.log('7. Hello World 메시지 발송 중...');
                  const messageResult = await apiCall('/send-hello-world', 'POST', { to, from });
                  printResult('Hello World 발송', messageResult);
                }
                
                console.log('\n✅ 테스트 완료!');
                rl.close();
              });
            });
          } else {
            console.log('❌ 인증이 완료되지 않았습니다.');
            rl.close();
          }
        });
      } else {
        console.log('❌ OAuth2 URL 생성 실패');
        rl.close();
      }
    } else {
      console.log('✅ 이미 인증된 상태입니다!');
      
      // 계정 정보 바로 조회
      console.log('3. 계정 정보 조회 중...');
      const accountInfo = await apiCall('/account');
      printResult('계정 정보', accountInfo);
      
      rl.close();
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    rl.close();
  }
}

main();