import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/AdminView.vue'),
  },
  {
    path: '/delivery',
    name: 'Delivery',
    component: () => import('../views/DeliveryView.vue'),
  },
  {
    path: '/delivery/auth',
    name: 'DeliveryAuth',
    component: () => import('../views/DeliveryAuthView.vue'),
  },
  {
    path: '/delivery/:date/:staffName',
    name: 'StaffMobile',
    component: () => import('../views/StaffMobileView.vue'),
  },
  {
    path: '/test',
    name: 'Test',
    component: () => import('../views/TestView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFoundView.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;