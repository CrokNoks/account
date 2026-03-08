import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Use getSession first to be more resilient
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  const pathname = request.nextUrl.pathname;
  // Detect if current path is a login page (e.g., /fr/login, /en/login, or /login)
  const isLoginPage = pathname.endsWith('/login');
  
  // Extract locale from pathname or default to fr
  const segments = pathname.split('/');
  const locale = ['fr', 'en'].includes(segments[1]) ? segments[1] : 'fr';

  // 1. If no user and not on a login page -> Redirect to /[locale]/login
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  // 2. If user exists and on a login page -> Redirect to /[locale]/
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    return NextResponse.redirect(url);
  }

  return response;
}
