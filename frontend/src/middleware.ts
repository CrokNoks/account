import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/shared/lib/supabase/middleware'
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1. First, handle Supabase session and its own redirects
  // We pass a dummy response to updateSession just to get its redirect if needed
  const response = await updateSession(request, NextResponse.next());
  
  // If updateSession returned a redirect, stop here and return it
  if (response.status === 307 || response.status === 302 || response.headers.get('location')) {
    return response;
  }

  // 2. If no redirect from Supabase, run intl middleware
  // We pass the response from updateSession to preserve any cookies it might have set
  return intlMiddleware(request);
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
