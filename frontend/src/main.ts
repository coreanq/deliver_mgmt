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
          primary: '#1976d2',
          secondary: '#424242',
          accent: '#82b1ff',
          error: '#ff5252',
          info: '#2196f3',
          success: '#4caf50',
          warning: '#ffc107',
        },
      },
      dark: {
        colors: {
          primary: '#2196f3',
          secondary: '#616161',
          accent: '#ff4081',
          error: '#ff5252',
          info: '#2196f3',
          success: '#4caf50',
          warning: '#ffc107',
        },
      },
    },
  },
});

app.use(createPinia());
app.use(router);
app.use(vuetify);

app.mount('#app');