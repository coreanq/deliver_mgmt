# EAS Update (OTA)

preview 채널에 OTA 업데이트를 배포합니다.
platform 선택 가능:ios, android
channel 선택 가능: preview, production
메시지는 최근 변경사항을 요약해서 짧게 작성합니다.

```bash
cd /Users/charles/1git/nownwoori/app && eas update --channel preview --platform ios --message "변경사항 요약" --non-interactive
```

메시지 예시:
- "광고 ID 수정"
- "버그 수정"
- "UI 개선"
