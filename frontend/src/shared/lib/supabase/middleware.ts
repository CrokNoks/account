import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest, response: NextResponse) {
  let supabaseResponse = response;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Debug headers to check environment in production
  supabaseResponse.headers.set('X-Debug-Has-Url', supabaseUrl ? 'true' : 'false');
  supabaseResponse.headers.set('X-Debug-Has-Key', supabaseKey ? 'true' : 'false');

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
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

  // Get user session
  const { data: { user } } = await supabase.auth.getUser();
  
  supabaseResponse.headers.set('X-Debug-User', user ? 'found' : 'null');

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname.includes('/login');

  // 1. If no user and not on a login page -> Redirect to /login
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirectResponse = NextResponse.redirect(url);
    
    // Transfer cookies and debug headers to redirect response
    supabaseResponse.cookies.getAll().forEach(c => redirectResponse.cookies.set(c));
    supabaseResponse.headers.forEach((v, k) => redirectResponse.headers.set(k, v));
    
    return redirectResponse;
  }

  // 2. If user exists and on a login page -> Redirect to /
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    const redirectResponse = NextResponse.redirect(url);
    
    supabaseResponse.cookies.getAll().forEach(c => redirectResponse.cookies.set(c));
    supabaseResponse.headers.forEach((v, k) => redirectResponse.headers.set(k, v));
    
    return redirectResponse;
  }

  return supabaseResponse;
}
