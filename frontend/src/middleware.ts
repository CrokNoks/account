import { type NextRequest } from 'next/server'
import { updateSession } from '@/shared/lib/supabase/middleware'
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1. First run Supabase logic to handle session and auth redirects
  // This will return a response (either a 200 OK or a 307 Redirect to /login)
  const supabaseResponse = await updateSession(request);

  // 2. If it's a redirect (like to /login), return it immediately
  if (supabaseResponse.status !== 200) {
    return supabaseResponse;
  }

  // 3. Otherwise, apply intl logic on top of the Supabase response
  // This will handle the locale and perform rewrites for [locale]
  return intlMiddleware(request, supabaseResponse);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt, sitemap.xml, etc.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
};
