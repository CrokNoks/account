import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest, response: NextResponse) {
  // Create an unmodified response to start with
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

  // IMPORTANT: Use getSession in middleware for better performance and reliability
  // getUser is more secure but getSession is enough to check if we HAVE a session
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  
  // Debug headers
  const cookieNames = request.cookies.getAll().map(c => c.name).join(', ');
  supabaseResponse.headers.set('X-Debug-Cookie-Names', cookieNames || 'none');
  supabaseResponse.headers.set('X-Debug-User', user ? 'found' : 'null');
  supabaseResponse.headers.set('X-Debug-Path', request.nextUrl.pathname);

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === '/login' || pathname.endsWith('/login');

  // 1. If no user and not on a login page -> Redirect to /login
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirectResponse = NextResponse.redirect(url);
    // Copy cookies to the new redirect response
    supabaseResponse.cookies.getAll().forEach(c => redirectResponse.cookies.set(c));
    return redirectResponse;
  }

  // 2. If user exists and on a login page -> Redirect to /
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach(c => redirectResponse.cookies.set(c));
    return redirectResponse;
  }

  return supabaseResponse;
}
