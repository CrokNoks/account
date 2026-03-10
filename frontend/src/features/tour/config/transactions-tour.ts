import { Step } from 'react-joyride';

export const TRANSACTION_STEPS = (t: any): Step[] => [
  {
    target: '[data-tour="tx-date"]',
    content: t('transactions.date'),
  },
  {
    target: '[data-tour="tx-description"]',
    content: t('transactions.description'),
  },
  {
    target: '[data-tour="tx-amount"]',
    content: t('transactions.amount'),
  },
  {
    target: '[data-tour="tx-pending"]',
    content: t('transactions.pending'),
  },
  {
    target: '[data-tour="tx-shortcuts"]',
    content: t('transactions.shortcuts'),
  }
];
