import { type NextRequest } from 'next/server'
import { updateSession } from '@/shared/lib/supabase/middleware'
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1. Run intl middleware
  const response = intlMiddleware(request);

  // 2. Update session (Supabase)
  // Note: updateSession should return the response object it modified
  return await updateSession(request, response);
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot, e.g. `favicon.ico`
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
