import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {default: 'Códice Admin', template: '%s · Códice Admin'},
  description: 'Panel privado de administración de El Códice.',
  robots: {index: false, follow: false},
};

export default function RootLayout({children}: LayoutProps<'/'>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
