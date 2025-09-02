import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/admin'
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/AdminView.vue'),
  },
  // Delivery (legacy) and Test routes are dev-only; injected below
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
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFoundView.vue'),
  },
];

// Conditionally include dev-only routes
if (import.meta.env.DEV) {
  routes.splice(routes.length - 1, 0,
    {
      path: '/delivery',
      name: 'Delivery',
      component: () => import('../views/DeliveryView.vue'),
    },
    {
      path: '/test',
      name: 'Test',
      component: () => import('../views/TestView.vue'),
    }
  );
}

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
