import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import PendingChangesView from '../views/PendingChangesView.vue'
import HistoricView from '../views/HistoricView.vue'
import TimerView from '../views/TimerView.vue'
import BranchView from '../views/BranchView.vue'
import PullRequestView from '../views/PullRequestView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/timer',
    },
    {
      path: '/timer',
      name: 'timer',
      component: TimerView,
      children: [
        {
          path: '',
          redirect: '/timer/resumen',
        },
        {
          path: 'resumen',
          name: 'timer-summary',
          component: DashboardView,
        },
        {
          path: 'pendientes',
          name: 'timer-pending',
          component: PendingChangesView,
        },
        {
          path: 'historico',
          name: 'timer-historic',
          component: HistoricView,
        },
      ],
    },
    {
      path: '/branch',
      name: 'branch',
      component: BranchView,
    },
    {
      path: '/pull-request',
      name: 'pull-request',
      component: PullRequestView,
    },
  ],
})

export default router
