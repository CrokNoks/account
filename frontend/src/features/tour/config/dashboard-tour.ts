import { Step } from 'react-joyride';

export const DASHBOARD_STEPS = (t: any): Step[] => [
  {
    target: 'body',
    content: t('dashboard.welcome'),
    placement: 'center',
  },
  {
    target: '[data-tour="stats"]',
    content: t('dashboard.stats'),
    placement: 'top',
  },
  {
    target: '[data-tour="evolution"]',
    content: t('dashboard.evolution'),
    placement: 'top',
  },
  {
    target: '[data-tour="budget-breakdown"]',
    content: t('dashboard.breakdown'),
    placement: 'top',
  },
  {
    target: '[data-tour="transaction-list"]',
    content: t('dashboard.transactions'),
    placement: 'top',
  },
  {
    target: '[data-tour="add-transaction"]',
    content: t('dashboard.add_btn'),
    placement: 'bottom',
  }
];
