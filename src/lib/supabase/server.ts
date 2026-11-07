import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {connection} from 'next/server';
import {supabaseEnv} from './env';

/** Cliente por petición con la sesión del usuario (RLS aplica). */
export async function createClient() {
  const cookieStore = await cookies();
  // supabase-js compara la expiración del token con Date.now(): esto debe correr solo por petición,
  // nunca en el prerender (si no, Cache Components lanza "unstable value Date.now()").
  await connection();
  const {url, key} = supabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const {name, value, options} of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy refresca la sesión.
        }
      },
    },
  });
}
