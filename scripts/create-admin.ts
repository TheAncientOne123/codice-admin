/**
 * Crea (o actualiza la contraseña de) la cuenta de administrador.
 *
 *   npx tsx --env-file=.env.local scripts/create-admin.ts <usuario> <email> <contraseña>
 *
 * El usuario es lo que escribes en el login; el email solo lo usa Supabase internamente.
 */
import {createClient} from '@supabase/supabase-js';

const [username, email, password] = process.argv.slice(2);
if (!username || !email || !password) {
  console.error('Uso: create-admin.ts <usuario> <email> <contraseña>');
  process.exit(1);
}
if (password.length < 12) {
  console.error('Usa una contraseña de al menos 12 caracteres.');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!;
const db = createClient(url, secret, {auth: {persistSession: false}});

async function main() {
  const {data: list} = await db.auth.admin.listUsers();
  let user = list?.users.find((u) => u.email === email);
  if (user) {
    const {error} = await db.auth.admin.updateUserById(user.id, {password});
    if (error) throw error;
    console.log('Contraseña actualizada.');
  } else {
    const {data, error} = await db.auth.admin.createUser({email, password, email_confirm: true});
    if (error) throw error;
    user = data.user;
    console.log('Usuario creado.');
  }
  const {error} = await db.from('admins').upsert({user_id: user!.id, username});
  if (error) throw error;
  console.log(`Administrador "${username}" listo. Añade ADMIN_USERNAME=${username} y ADMIN_EMAIL=${email} a .env.local.`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
