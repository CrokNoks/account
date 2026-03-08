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
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname;
  // Detect if current path is a login page anywhere in the path
  const isLoginPage = pathname.includes('/login');

  // Helper to redirect while preserving cookies
  const redirectWithCookies = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // 1. If no user and not on a login page -> Redirect to /login
  // next-intl will then handle prefixing it to /fr/login or /en/login
  if (!user && !isLoginPage) {
    return redirectWithCookies('/login');
  }

  // 2. If user exists and on a login page -> Redirect to /
  if (user && isLoginPage) {
    return redirectWithCookies('/');
  }

  return supabaseResponse;
}
