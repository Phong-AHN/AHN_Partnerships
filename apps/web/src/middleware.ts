import { NextResponse, type NextRequest } from 'next/server';

/**
 * A visitor with no session cookie at all is sent to sign-in remembering
 * where they were going, so a link pasted from Slack lands on the right page
 * after the magic link. This only looks at whether the cookie exists - the
 * session itself is checked against the database by the app layout, which
 * stays the real gate.
 */
const SESSION_COOKIE = 'partners_session';

export function middleware(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const url = request.nextUrl.clone();
  url.pathname = '/sign-in';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except sign-in itself, API routes and static files.
  matcher: ['/((?!sign-in|api|_next/|favicon\\.ico|.*\\.(?:png|svg|ico|jpg|webp|txt)$).*)'],
};
