'use client';

import React from 'react';
import Joyride, { CallBackProps, STATUS, ACTIONS, EVENTS } from 'react-joyride';
import { useUiStore } from '@/shared/model/use-ui-store';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { DASHBOARD_STEPS } from '@/features/tour/config/dashboard-tour';
import { ACCOUNT_STEPS } from '@/features/tour/config/account-tour';
import { nextIndexOnMissingTarget } from '@/features/tour/config/tour-flow';
import { tourLocale, tourStyles } from '@/features/tour/config/tour-ui';
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
    setCreateAccountDialogOpen,
    setCreateTransactionDrawerOpen
  } = useUiStore();

  // La visite « transactions » s'appuie sur le tiroir de création : on l'ouvre au démarrage.
  // Joyride ne réessaie pas une cible absente au démarrage : on ne lance la visite qu'une fois le tiroir rendu.
  const [drawerReady, setDrawerReady] = React.useState(false);
  React.useEffect(() => {
    if (activeTour !== 'transactions' || !tourRun) return;
    setCreateTransactionDrawerOpen(true);
    const timer = setTimeout(() => setDrawerReady(true), 500);
    return () => {
      clearTimeout(timer);
      setDrawerReady(false);
    };
  }, [activeTour, tourRun, setCreateTransactionDrawerOpen]);

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
      if (activeTour === 'transactions') setCreateTransactionDrawerOpen(false);
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
        const skipTo = nextIndexOnMissingTarget(activeTour, index, action === ACTIONS.PREV ? 'prev' : 'next');
        if (skipTo === null) {
          // Étape qui attend l'ouverture d'un panneau : on reste sur place.
          console.warn('Tour target not found, waiting...', data.step.target);
        } else if (skipTo >= getSteps().length) {
          if (activeTour === 'transactions') setCreateTransactionDrawerOpen(false);
          completeTour(activeTour);
        } else {
          setTourStepIndex(Math.max(skipTo, 0));
        }
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
      run={tourRun && (activeTour !== 'transactions' || drawerReady)}
      stepIndex={tourStepIndex}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      disableScrolling={false}
      callback={handleJoyrideCallback}
      locale={tourLocale(tc, t.raw('next_with_progress') as string)}
      styles={tourStyles(theme === 'dark')}
    />
  );
}
