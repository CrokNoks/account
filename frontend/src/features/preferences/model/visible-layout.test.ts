import { describe, expect, it } from 'vitest';
import { ALL_AVAILABLE_WIDGETS, WIDGET_COMPONENTS } from '../config/dashboard-widgets';
import { visibleLayout } from './visible-layout';

const known = ALL_AVAILABLE_WIDGETS.map((w) => w.id);

// Disposition enregistrée avant la suppression des analyses IA : contient `insights`.
const saved = [
  { id: 'stat-bank', width: 2, desktopVisible: true, mobileVisible: false },
  { id: 'insights', width: 12, desktopVisible: true, mobileVisible: true },
  { id: 'breakdown', width: 6, desktopVisible: false, mobileVisible: true },
  { id: 'transactions', width: 12 },
];

// Disposition enregistrée avant la suppression des objectifs d'épargne : contient `savings`.
const savedWithSavings = [
  { id: 'stat-bank', width: 2, desktopVisible: true, mobileVisible: false },
  { id: 'savings', width: 6, desktopVisible: true, mobileVisible: true },
  { id: 'breakdown', width: 6, desktopVisible: false, mobileVisible: true },
  { id: 'transactions', width: 12 },
];

describe('visibleLayout', () => {
  it('retire insights sans toucher ordre, largeur et visibilité des autres widgets', () => {
    expect(visibleLayout(saved, known)).toEqual([saved[0], saved[2], saved[3]]);
  });

  it('insights n’est ni un widget connu (donc ni actif ni ajoutable en édition) ni affichable', () => {
    expect(known).not.toContain('insights');
    expect(WIDGET_COMPONENTS['insights']).toBeUndefined();
  });

  it('le mode édition ne liste pas insights avec son id brut', () => {
    const active = visibleLayout(saved, known).map((w) => w.id);
    const addable = known.filter((id) => !active.includes(id));
    expect(active).not.toContain('insights');
    expect(addable).not.toContain('insights');
  });

  it('savings enregistré : ignoré en affichage et en édition, les autres widgets restent intacts', () => {
    expect(known).not.toContain('savings');
    expect(WIDGET_COMPONENTS['savings']).toBeUndefined();

    // L'édition part de cette liste et l'enregistrement renvoie `tempLayout` : savings n'y est plus.
    const active = visibleLayout(savedWithSavings, known);
    expect(active).toEqual([savedWithSavings[0], savedWithSavings[2], savedWithSavings[3]]);
    const addable = known.filter((id) => !active.map((w) => w.id).includes(id));
    expect(addable).not.toContain('savings');
  });

  // Réduction du tableau de bord : 6 cartes de solde → 3, Top Dépenses et Pulse retirés.
  it('ignore les widgets retirés et garde la visibilité mobile des cartes conservées', () => {
    const removed = ['stat-start', 'stat-expenses', 'stat-forecast', 'pulse', 'top-expenses'];
    const savedBefore = [
      { id: 'stat-start', width: 2, desktopVisible: true, mobileVisible: false },
      { id: 'stat-income', width: 2, desktopVisible: true, mobileVisible: false },
      { id: 'stat-bank', width: 2, desktopVisible: true, mobileVisible: true },
      { id: 'stat-forecast', width: 2, desktopVisible: true, mobileVisible: false },
      { id: 'top-expenses', width: 4, desktopVisible: true, mobileVisible: false },
      { id: 'pulse', width: 6, desktopVisible: true, mobileVisible: true },
      { id: 'upcoming', width: 4, desktopVisible: true, mobileVisible: true },
    ];

    for (const id of removed) {
      expect(known).not.toContain(id);
      expect(WIDGET_COMPONENTS[id]).toBeUndefined();
    }
    expect(visibleLayout(savedBefore, known)).toEqual([savedBefore[1], savedBefore[2], savedBefore[6]]);
  });
});
