// frontend/middleware.js

import { NextResponse } from 'next/server';

// Same cookie the Express API sets. Cookies are shared across localhost ports,
// so the page guard can read it without calling the API.
const SESSION_COOKIE = 'erp_session';

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isAuthPage = pathname === '/login' || pathname === '/register';

  // Not signed in: only the login and registration pages are reachable.
  if (!signedIn && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Already signed in: no reason to show the auth pages again.
  if (signedIn && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)',
  ],
};