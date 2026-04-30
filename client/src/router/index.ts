import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import PendingChangesView from '../views/PendingChangesView.vue'
import HistoricView from '../views/HistoricView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
    },
    {
      path: '/pending',
      name: 'pending-changes',
      component: PendingChangesView,
    },
    {
      path: '/historic',
      name: 'historic',
      component: HistoricView,
    },
  ],
})

export default router
