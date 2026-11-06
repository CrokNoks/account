import { Step } from 'react-joyride';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ACCOUNT_STEPS = (t: any): Step[] => [
  {
    target: 'body',
    content: t('account.intro'),
    placement: 'center',
  },
  {
    target: '[data-tour="add-account-btn"]',
    content: t('account.create_btn'),
  },
  {
    target: '[data-tour="account-name"]',
    content: t('account.name'),
  },
  {
    target: '[data-tour="account-balance"]',
    content: t('account.balance'),
  },
  {
    target: '[data-tour="nav-settings"]',
    content: t('account.settings'),
    placement: 'right',
  },
  {
    target: '[data-tour="nav-budgets"]',
    content: t('account.periods'),
    placement: 'right',
  }
];
