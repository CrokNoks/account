import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest, response: NextResponse) {
  let supabaseResponse = response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // This will potentially call setAll if the session needs refreshing
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname.includes('/login');
  
  // Robust locale extraction
  const segments = pathname.split('/');
  const locale = ['fr', 'en'].includes(segments[1]) ? segments[1] : 'fr';

  // Helper to redirect while preserving cookies from the modified response
  const redirectWithCookies = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    const redirectResponse = NextResponse.redirect(url);
    
    // Copy all cookies (including the new/refreshed ones from Supabase)
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    
    // Add a debug header to see where we are redirecting
    redirectResponse.headers.set('X-Auth-Redirect', path);
    
    return redirectResponse;
  }

  // 1. If no user and not on a login page -> Redirect to /[locale]/login
  if (!user && !isLoginPage) {
    return redirectWithCookies(`/${locale}/login`);
  }

  // 2. If user exists and on a login page -> Redirect to /[locale]
  if (user && isLoginPage) {
    return redirectWithCookies(`/${locale}`);
  }

  return supabaseResponse;
}
