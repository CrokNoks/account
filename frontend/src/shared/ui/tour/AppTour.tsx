'use client';

import React from 'react';
import Joyride, { CallBackProps, STATUS, ACTIONS, EVENTS } from 'react-joyride';
import { useUiStore } from '@/shared/model/use-ui-store';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { DASHBOARD_STEPS } from '@/features/tour/config/dashboard-tour';
import { ACCOUNT_STEPS } from '@/features/tour/config/account-tour';
import { TRANSACTION_STEPS } from '@/features/tour/config/transactions-tour';

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
    completeTour,
    setCreateAccountDialogOpen
  } = useUiStore();

  const getSteps = () => {
    switch (activeTour) {
      case 'dashboard': return DASHBOARD_STEPS(t);
      case 'account': return ACCOUNT_STEPS(t);
      case 'transactions': return TRANSACTION_STEPS(t);
      default: return [];
    }
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { action, index, status, type } = data;

    // Logic to open/close dialogs during tours
    if (activeTour === 'account') {
      if (type === EVENTS.STEP_AFTER) {
        // After step index 1 (pointing to add-account-btn), open the dialog
        if (index === 1 && action === ACTIONS.NEXT) {
          setCreateAccountDialogOpen(true);
        } 
        // If going back from step index 2 (inside dialog), close it
        else if (index === 2 && action === ACTIONS.PREV) {
          setCreateAccountDialogOpen(false);
        }
        // After step index 4 (last field in dialog), close it to point to sidebar
        else if (index === 4 && action === ACTIONS.NEXT) {
          setCreateAccountDialogOpen(false);
        }
        // If going back from step index 5 (sidebar), reopen dialog
        else if (index === 5 && action === ACTIONS.PREV) {
          setCreateAccountDialogOpen(true);
        }
      }
    }

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      completeTour(activeTour);
    } else if (([EVENTS.STEP_AFTER, EVENTS.TARGET_NOT_FOUND] as string[]).includes(type)) {
      const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      
      // If we are opening a dialog, add a small delay to let it animate/render
      const needsDelay = activeTour === 'account' && (
        (index === 1 && action === ACTIONS.NEXT) || // Opening dialog
        (index === 5 && action === ACTIONS.PREV)    // Re-opening dialog
      );

      if (needsDelay && type !== EVENTS.TARGET_NOT_FOUND) {
        setTimeout(() => {
          setTourStepIndex(nextStepIndex);
        }, 500);
      } else if (type === EVENTS.TARGET_NOT_FOUND) {
        // If target not found, we might still be waiting for the dialog
        // Don't auto-advance, maybe retry or just stay here
        console.warn('Tour target not found, waiting...', data.step.target);
      } else {
        setTourStepIndex(nextStepIndex);
      }
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
