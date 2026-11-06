'use client';

import {useActionState} from 'react';
import {login, type LoginState} from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="card space-y-4 p-6">
      <div>
        <label htmlFor="username" className="label">
          Usuario
        </label>
        <input id="username" name="username" autoComplete="username" required className="input" autoFocus />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Contraseña
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="btn btn-primary w-full py-2">
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
