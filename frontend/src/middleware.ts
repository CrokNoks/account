import { type NextRequest } from 'next/server'
import { updateSession } from '@/shared/lib/supabase/middleware'
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1. First run the intl middleware to get locale headers and potentially redirects
  const response = intlMiddleware(request);

  // 2. Pass that response to Supabase to add auth logic and cookies
  // updateSession will now correctly merge cookies into the intl response
  return await updateSession(request, response);
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
