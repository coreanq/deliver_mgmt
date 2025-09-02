<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-title>배송 관리 시스템</v-app-bar-title>
      <v-spacer></v-spacer>
      <v-btn icon @click="toggleTheme" aria-label="테마 전환">
        <v-icon>{{ isDark ? 'mdi-white-balance-sunny' : 'mdi-weather-night' }}</v-icon>
      </v-btn>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
  
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTheme } from 'vuetify';

const theme = useTheme();
const isDark = computed(() => theme.global.current.value.dark);

const toggleTheme = (): void => {
  theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark';
};
</script>

<style scoped>
/* Global styles if needed */
</style>

