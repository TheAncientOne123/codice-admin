import {logout} from '@/app/login/actions';
import {requireAdmin} from '@/lib/auth';

export async function UserMenu() {
  const {user} = await requireAdmin();
  return (
    <form action={logout} className="flex items-center justify-between gap-2 px-2">
      <span className="truncate text-sm">
        <span className="text-muted">Sesión: </span>
        <strong>{user.username}</strong>
      </span>
      <button type="submit" className="btn btn-ghost px-2 py-1 text-xs">
        Salir
      </button>
    </form>
  );
}
