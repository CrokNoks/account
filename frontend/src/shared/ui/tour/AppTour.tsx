'use client';

import React from 'react';
import Joyride, { CallBackProps, STATUS, ACTIONS, EVENTS } from 'react-joyride';
import { useUiStore } from '@/shared/model/use-ui-store';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { DASHBOARD_STEPS } from '@/features/tour/config/dashboard-tour';
import { ACCOUNT_STEPS } from '@/features/tour/config/account-tour';
import { accountDialogAction, nextIndexOnMissingTarget } from '@/features/tour/config/tour-flow';
import { tourLocale, tourStyles } from '@/features/tour/config/tour-ui';
import { useIsDesktop } from '@/shared/lib/use-is-desktop';
import { TRANSACTION_STEPS } from '@/features/tour/config/transactions-tour';

export function AppTour() {
  const { theme } = useTheme();
  const t = useTranslations('Tour');
  const tc = useTranslations('Common');
  const desktop = useIsDesktop();
  
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

  // Sur mobile, le dialogue de création de compte ne doit jamais rester ouvert à la fin de la visite
  // « compte » (terminée, passée ou interrompue) : il masquerait la barre du bas.
  const previousTour = React.useRef(activeTour);
  React.useEffect(() => {
    if (previousTour.current === 'account' && activeTour !== 'account' && !desktop) {
      setCreateAccountDialogOpen(false);
    }
    previousTour.current = activeTour;
  }, [activeTour, desktop, setCreateAccountDialogOpen]);

  const getSteps = () => {
    switch (activeTour) {
      case 'dashboard': return DASHBOARD_STEPS(t, desktop);
      case 'account': return ACCOUNT_STEPS(t, desktop);
      case 'transactions': return TRANSACTION_STEPS(t);
      default: return [];
    }
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { action, index, status, type } = data;

    // Logic to open/close dialogs during tours
    if (activeTour === 'account') {
      if (type === EVENTS.STEP_AFTER) {
        const dialog = accountDialogAction(index, action === ACTIONS.PREV ? 'prev' : 'next', desktop);
        if (dialog) setCreateAccountDialogOpen(dialog === 'open');
      }
    }

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      if (activeTour === 'transactions') setCreateTransactionDrawerOpen(false);
      if (activeTour === 'account' && !desktop) setCreateAccountDialogOpen(false);
      completeTour(activeTour);
    } else if (([EVENTS.STEP_AFTER, EVENTS.TARGET_NOT_FOUND] as string[]).includes(type)) {
      const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      
      // If we are opening a dialog, add a small delay to let it animate/render; on mobile the closing one
      // too, so the bottom bar is free when the « Plus » step is shown.
      const dialog = activeTour === 'account' ? accountDialogAction(index, action === ACTIONS.PREV ? 'prev' : 'next', desktop) : null;
      const needsDelay = dialog === 'open' || (!desktop && dialog === 'close');

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
          if (activeTour === 'account' && !desktop) setCreateAccountDialogOpen(false);
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
