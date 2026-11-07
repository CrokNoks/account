import { _Translator } from 'next-intl';
import { Step } from 'react-joyride';

/**
 * Étapes de la visite « tableau de bord ». Sur mobile (`desktop = false`), les blocs du bureau sont masqués :
 * l'étape Budgets pointe « Budgets à surveiller » et l'étape d'ajout pointe le « + » de la barre du bas.
 */
export const DASHBOARD_STEPS = (t: _Translator, desktop = true): Step[] => [
  {
    target: 'body',
    content: t('dashboard.welcome'),
    placement: 'center',
  },
  {
    target: '[data-tour="stats"]',
    content: t(desktop ? 'dashboard.stats' : 'dashboard.stats_mobile'),
    placement: 'top',
  },
  {
    target: desktop ? '[data-tour="budget-breakdown"]' : '[data-tour="budgets-to-watch"]',
    content: t(desktop ? 'dashboard.breakdown' : 'dashboard.breakdown_mobile'),
    placement: 'top',
  },
  {
    target: '[data-tour="to-handle"]',
    content: t('dashboard.transactions'),
    placement: 'top',
  },
  {
    target: desktop ? '[data-tour="add-transaction"]' : '[data-tour="nav-add"]',
    content: t(desktop ? 'dashboard.add_btn' : 'dashboard.add_btn_mobile'),
    placement: desktop ? 'bottom' : 'top',
  }
];
