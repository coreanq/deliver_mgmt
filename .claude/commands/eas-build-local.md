# EAS production Build

local production 빌드를 실행합니다.
ios, android, all  선택 가능, all 인경우 병렬로 실행

## Android 빌드 사전 조건

### 3. Gradle 메모리 설정 (~/.gradle/gradle.properties)
```properties
org.gradle.jvmargs=-Xmx6144m -XX:MaxMetaspaceSize=2048m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
org.gradle.daemon=false
org.gradle.parallel=true
org.gradle.caching=true
```

### 4. 빌드 전 Gradle 잠금 해제 (빌드 실패 시)
```bash
pkill -9 -f gradle
rm -rf ~/.gradle/caches/journal-1
```

## 빌드 명령어

```bash
cd app && eas build --platform ios --profile production --non-interactive --local
```
