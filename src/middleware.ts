import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Firebase Auth uses this JWKS endpoint to publish its public keys
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

// Define protected routes (or just protect everything except public paths)
const PROTECTED_ROUTES = [
  '/dashboard',
  '/time-tracker',
  '/english-communication',
  '/dsa-tracker',
  '/jobs',
  '/habits',
  '/goals',
  '/calendar',
  '/learning-journal'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if it's a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url));
  }

  try {
    // Verify the JWT signature using Google's public keys
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`,
      audience: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });

    // Check authorization: Is the user in the approved whitelist?
    const approvedEmailsStr = process.env.APPROVED_EMAILS || "";
    const approvedEmails = approvedEmailsStr.split(",").map(e => e.trim().toLowerCase());
    
    const userEmail = typeof payload.email === "string" ? payload.email.toLowerCase() : "";

    if (!userEmail || !approvedEmails.includes(userEmail)) {
      console.warn(`Unauthorized access attempt by email: ${userEmail}`);
      // Return 403 Forbidden or redirect
      return NextResponse.redirect(new URL('/auth/sign-in?error=unauthorized', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error("JWT Verification failed:", error);
    // Invalid or expired token
    return NextResponse.redirect(new URL('/auth/sign-in', request.url));
  }
}

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
