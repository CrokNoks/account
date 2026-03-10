'use client';

import React from 'react';
import Joyride, { Step, CallBackProps, STATUS, ACTIONS, EVENTS } from 'react-joyride';
import { useUiStore, TourName } from '@/shared/model/use-ui-store';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';

const DASHBOARD_STEPS = (t: any): Step[] => [
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

const ACCOUNT_STEPS = (t: any): Step[] => [
  {
    target: 'body',
    content: t('account.intro'),
    placement: 'center',
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
    target: '[data-tour="account-type"]',
    content: t('account.type'),
  },
  {
    target: '[data-tour="nav-categories"]',
    content: t('account.categories'),
    placement: 'right',
  },
  {
    target: '[data-tour="nav-recurring"]',
    content: t('account.recurring'),
    placement: 'right',
  },
  {
    target: '[data-tour="nav-budgets"]',
    content: t('account.periods'),
    placement: 'right',
  }
];

const TRANSACTION_STEPS = (t: any): Step[] => [
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

export function AppTour() {
  const { theme } = useTheme();
  const t = useTranslations('Tour');
  const tc = useTranslations('Common');
  
  const { 
    activeTour, 
    tourRun, 
    tourStepIndex, 
    setTourStepIndex, 
    stopTour, 
    completeTour 
  } = useUiStore();

  const getSteps = (): Step[] => {
    switch (activeTour) {
      case 'dashboard': return DASHBOARD_STEPS(t);
      case 'account': return ACCOUNT_STEPS(t);
      case 'transactions': return TRANSACTION_STEPS(t);
      default: return [];
    }
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { action, index, status, type } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      completeTour(activeTour);
    } else if (([EVENTS.STEP_AFTER, EVENTS.TARGET_NOT_FOUND] as string[]).includes(type)) {
      const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      setTourStepIndex(nextStepIndex);
    } else if (type === EVENTS.TOUR_END) {
      stopTour();
    }
  };

  if (activeTour === 'none') return null;

  return (
    <Joyride
      steps={getSteps()}
      run={tourRun}
      stepIndex={tourStepIndex}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      disableScrolling={false}
      callback={handleJoyrideCallback}
      locale={{
        back: tc('back') || 'Back',
        close: tc('close') || 'Close',
        last: tc('finish') || 'Finish',
        next: tc('next') || 'Next',
        skip: tc('skip') || 'Skip',
      }}
      styles={{
        options: {
          primaryColor: 'hsl(var(--primary))',
          backgroundColor: theme === 'dark' ? '#1f2937' : '#fff',
          textColor: theme === 'dark' ? '#f3f4f6' : '#1f2937',
          arrowColor: theme === 'dark' ? '#1f2937' : '#fff',
          overlayColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
        },
        tooltip: {
          borderRadius: '0.75rem',
          padding: '1.25rem',
        },
        buttonNext: {
          borderRadius: '0.5rem',
          padding: '0.5rem 1rem',
          fontWeight: 600,
        },
        buttonBack: {
          marginRight: '0.75rem',
        }
      }}
    />
  );
}
