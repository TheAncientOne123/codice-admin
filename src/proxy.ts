import {createServerClient} from '@supabase/ssr';
import {NextResponse, type NextRequest} from 'next/server';
import {supabaseEnv} from '@/lib/supabase/env';

/**
 * Refresca la sesión de Supabase en cada petición y hace una comprobación optimista:
 * sin sesión → /login. La autorización real se repite en cada acción (lib/auth.ts) y en RLS.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({request});
  const {url, key} = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const {name, value} of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({request});
        for (const {name, value, options} of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {data} = await supabase.auth.getClaims();
  const isLogin = request.nextUrl.pathname === '/login';

  if (!data?.claims && !isLogin) {
    const to = request.nextUrl.clone();
    to.pathname = '/login';
    to.search = '';
    return NextResponse.redirect(to);
  }
  if (data?.claims && isLogin) {
    const to = request.nextUrl.clone();
    to.pathname = '/';
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
