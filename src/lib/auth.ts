import 'server-only';
import {redirect} from 'next/navigation';
import {createClient} from './supabase/server';

export type AdminUser = {id: string; username: string};

/**
 * Capa de acceso: devuelve el admin actual o redirige a /login.
 * Debe llamarse en cada Server Action y página (no confiar en el proxy).
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {data: claims} = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect('/login');
  const {data: admin} = await supabase.from('admins').select('user_id, username').eq('user_id', userId).maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    redirect('/login?error=sin-permiso');
  }
  return {supabase, user: {id: admin.user_id as string, username: admin.username as string} satisfies AdminUser};
}
