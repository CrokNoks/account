import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../../messages/fr.json';
import { LoginForm } from './login-form';

const signInWithPassword = vi.fn();
vi.mock('@/shared/lib/supabase/supabase-browser', () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));

describe('LoginForm', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Rechargement complet voulu : le middleware lit le cookie de session côté serveur
  // et le cache React Query / les stores ne doivent pas survivre à un changement d'utilisateur.
  it('does a full page load on "/" after a successful sign in', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { origin: 'http://localhost:3000', assign });
    signInWithPassword.mockResolvedValue({ error: null });

    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <LoginForm />
      </NextIntlClientProvider>,
    );
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.fr' } });
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('http://localhost:3000/'));
  });
});
