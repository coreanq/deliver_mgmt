const getBuildDate = () => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yy}/${mm}/${dd} ${hh}:${min}`;
};

export default {
  expo: {
    name: '배매니저',
    slug: 'deliver-mgmt',
    owner: 'trydabble',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'deliver-mgmt',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.trydabble.delivermgmt',
      infoPlist: {
        NSCameraUsageDescription: '배송 완료 사진 촬영을 위해 카메라 접근이 필요합니다.',
        NSPhotoLibraryUsageDescription: '배송 완료 사진 저장을 위해 사진 라이브러리 접근이 필요합니다.',
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1a1a2e',
      },
      package: 'com.trydabble.delivermgmt',
      permissions: [
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      [
        'expo-camera',
        {
          cameraPermission: '배송 완료 사진 촬영을 위해 카메라 접근이 필요합니다.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: '배송 완료 사진 저장을 위해 사진 라이브러리 접근이 필요합니다.',
        },
      ],
      'react-native-purchases',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      buildDate: getBuildDate(),
      router: {
        origin: false,
      },
      eas: {
        projectId: '1a9764be-5f19-4f2c-bbe7-ae6cfbb5548c',
      },
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/1a9764be-5f19-4f2c-bbe7-ae6cfbb5548c',
    },
  },
};
