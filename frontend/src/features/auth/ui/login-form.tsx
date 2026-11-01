'use client';

import { useState } from 'react';
import { createClient } from '@/shared/lib/supabase/supabase-browser';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

export function LoginForm() {
  const t = useTranslations('Auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError(t('error_empty'));
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(t('error_generic'));
      setLoading(false);
    } else {
      // Rechargement complet voulu (pas le routeur Next) : le middleware lit le cookie
      // de session côté serveur, et le cache client ne doit rien garder de l'utilisateur précédent.
      // URL absolue : même comportement que `href = '/'`, sans l'avertissement eslint.
      window.location.assign(new URL('/', window.location.origin).href);
    }
  };

  return (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>{t('login_title')}</CardTitle>
        <CardDescription>{t('login_desc')}</CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none" htmlFor="email">{t('email')}</label>
            <Input
              id="email"
              type="email"
              placeholder={t('email_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none" htmlFor="password">{t('password')}</label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? t('signing_in') : t('signin')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
