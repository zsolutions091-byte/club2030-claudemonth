import { NextRequest, NextResponse } from 'next/server'

// Next.js 16: middleware was renamed to proxy. Runtime is Node.js by default.
// PRD §7.1 — Basic Auth single-user gate. Webhooks are excluded for Phase 2.

export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/webhooks/')) {
    return NextResponse.next()
  }

  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Basic ')) {
    return new NextResponse('Auth required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="tasks"' },
    })
  }

  const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':')
  const expectedUser = process.env.BASIC_AUTH_USER
  const expectedPass = process.env.BASIC_AUTH_PASS

  if (!expectedUser || !expectedPass) {
    return new NextResponse('Server misconfigured: BASIC_AUTH_USER/PASS missing', { status: 500 })
  }

  if (user !== expectedUser || pass !== expectedPass) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
