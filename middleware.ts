import { withAuth } from 'next-auth/middleware';
import { NextRequest, NextResponse } from 'next/server';

export default withAuth(
  function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.nextauth.token;

    // Jika sudah authenticated dan coba akses root (/), redirect ke dashboard
    if (pathname === '/' && token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Jika belum authenticated dan coba akses protected routes, akan di-handle oleh withAuth
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Protected routes - hanya bisa diakses jika authenticated
        if (pathname.startsWith('/dashboard') || pathname.startsWith('/calendar')) {
          return !!token;
        }

        // Public routes
        return true;
      },
    },
    pages: {
      signIn: '/',
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
