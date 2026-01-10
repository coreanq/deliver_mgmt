# EAS App Store Upload

최신 이미지를 App Store Connect에 업로드합니다.
ios, android 선택 가능 
fastlane 사용 
app/app_key.json 파일에서 키값을 가져와서 사용 
app/credential.json 파일에서 인증 정보 사용


# App Store Upload
fastlane run upload_to_app_store \
    ipa:"./builds/app.ipa" \
    api_key_path:"./api_key.json" \
    skip_screenshots:true \
    skip_metadata:true \
    force:true
## Play Store Upload
fastlane run upload_to_play_store \
    package_name="com.your.package.id" \
    json_key="./google-key.json" \
    aab="./builds/app.aab" \
    track="internal" \
    skip_upload_screenshots:true \
    skip_upload_metadata:true