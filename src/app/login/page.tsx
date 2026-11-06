import type {Metadata} from 'next';
import {LoginForm} from './login-form';

export const metadata: Metadata = {title: 'Entrar'};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full border border-accent/60 text-xl font-bold text-accent">
            C
          </div>
          <h1 className="text-xl font-bold">Códice Admin</h1>
          <p className="mt-1 text-sm text-muted">Panel privado de El Códice</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
