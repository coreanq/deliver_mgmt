# EAS App Store Upload

최신 production 빌드를 App Store Connect에 업로드합니다.
ios, android 선택 가능

빌드 , 업로드:
```bash
cd /Users/charles/1git/nownwoori/app && eas build --platform ios --profile production 
cd /Users/charles/1git/nownwoori/app && eas submit --platform ios --profile production --latest
```
