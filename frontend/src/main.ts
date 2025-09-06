import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { ko } from 'vuetify/locale';
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';

import App from './App.vue';
import router from './router';

const app = createApp(App);

// Vuetify configuration
const vuetify = createVuetify({
  components,
  directives,
  locale: {
    locale: 'ko',
    messages: { ko },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#d73ad7',      // HomeView 보라/핑크 주 색상 (rgb(215, 58, 215))
          secondary: '#af41f0',    // HomeView 보조 색상 (rgb(175, 65, 240))  
          accent: '#ff33be',       // HomeView 액센트 색상 (rgb(255, 51, 190))
          error: '#ff5252',
          info: '#af41f0',         // 보라 계열로 변경
          success: '#4caf50',
          warning: '#ffc107',
          surface: '#f8f9fa',      // 연한 회색 배경
          background: '#ffffff',
        },
      },
      dark: {
        colors: {
          primary: '#d73ad7',      // 다크 테마도 동일한 보라/핑크 색상 유지
          secondary: '#af41f0',
          accent: '#ff33be',
          error: '#ff5252',
          info: '#af41f0',
          success: '#4caf50',
          warning: '#ffc107',
          surface: '#2a1f3d',      // 어두운 보라 배경
          background: '#1a1625',   // 어두운 배경
        },
      },
    },
  },
});

app.use(createPinia());
app.use(router);
app.use(vuetify);

app.mount('#app');