import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import PendingChangesView from '../views/PendingChangesView.vue'
import HistoricView from '../views/HistoricView.vue'
import TimerView from '../views/TimerView.vue'
import BranchView from '../views/BranchView.vue'
import PullRequestView from '../views/PullRequestView.vue'
import PricingView from '../views/PricingView.vue'
import CreateStoryView from '../views/CreateStoryView.vue'
import TicketsView from '../views/TicketsView.vue'
import TicketsListView from '../views/TicketsListView.vue'
import TicketsSummaryView from '../views/TicketsSummaryView.vue'

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
      path: '/stories',
      name: 'stories',
      component: CreateStoryView,
    },
    {
      path: '/create-story',
      redirect: '/stories',
    },
    {
      path: '/tickets',
      name: 'tickets',
      component: TicketsView,
      children: [
        {
          path: '',
          redirect: '/tickets/lista',
        },
        {
          path: 'lista',
          name: 'tickets-list',
          component: TicketsListView,
        },
        {
          path: 'resumen',
          name: 'tickets-summary',
          component: TicketsSummaryView,
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
    {
      path: '/pricing',
      name: 'pricing',
      component: PricingView,
    },
  ],
})

export default router
