import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import en from '../../../../messages/en.json';
import { BaseAIInsightsCard } from './base-ai-insights-card';

vi.mock('react-markdown', () => ({ default: ({ children }: { children: string }) => <div>{children}</div> }));

const catalogs = { fr, en };

function renderCard(locale: 'fr' | 'en', props: { isLoading?: boolean; isError?: boolean; insights?: string | null }) {
  return render(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]}>
      <BaseAIInsightsCard
        title="t"
        icon={null}
        insights={props.insights ?? null}
        isLoading={props.isLoading ?? false}
        isError={props.isError ?? false}
        isFetching={false}
        onRefetch={() => {}}
      />
    </NextIntlClientProvider>,
  );
}

describe('BaseAIInsightsCard default messages', () => {
  it('shows the translated loading, error and empty messages in French', () => {
    const { unmount } = renderCard('fr', { isLoading: true });
    expect(screen.getByText("Génération de l'analyse en cours...")).toBeTruthy();
    unmount();
    const second = renderCard('fr', { isError: true });
    expect(screen.getByText("Impossible de charger les analyses IA pour le moment.")).toBeTruthy();
    second.unmount();
    renderCard('fr', {});
    expect(screen.getByText('Aucune analyse disponible pour le moment.')).toBeTruthy();
  });

  it('shows the English messages with the en locale', () => {
    renderCard('en', { isLoading: true });
    expect(screen.getByText('Generating the analysis...')).toBeTruthy();
  });
});
