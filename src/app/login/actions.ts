'use server';

import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

export type LoginState = {error?: string};

/** Traduce el usuario del formulario al email de Supabase (o acepta un email directamente). */
function emailFor(username: string): string | null {
  const u = username.trim();
  if (u.includes('@')) return u;
  const expected = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  if (expected && u.toLowerCase() === expected) return process.env.ADMIN_EMAIL ?? null;
  return null;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');
  const email = emailFor(username);
  // Mismo mensaje para usuario o contraseña incorrectos: no revela cuál falló.
  const fail = {error: 'Usuario o contraseña incorrectos.'};
  if (!email || !password) return fail;

  const supabase = await createClient();
  const {error} = await supabase.auth.signInWithPassword({email, password});
  if (error) return fail;
  redirect('/');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
