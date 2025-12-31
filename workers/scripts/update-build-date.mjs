import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wranglerPath = join(__dirname, '..', 'wrangler.toml');

// 현재 날짜/시간 (YY/MM/DD HH:MM 형식)
const now = new Date();
const buildDate = now.toLocaleString('ko-KR', {
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).replace(/\. /g, '/').replace(/:/g, ':').replace(/\//g, '/');

// wrangler.toml 읽기
let content = readFileSync(wranglerPath, 'utf-8');

// BUILD_DATE 업데이트
content = content.replace(
  /BUILD_DATE = ".*"/,
  `BUILD_DATE = "${buildDate}"`
);

// 저장
writeFileSync(wranglerPath, content);
console.log(`BUILD_DATE updated to: ${buildDate}`);
