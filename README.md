# Códice Admin

Panel privado para administrar **El Códice** (`authorsite2`).

El contenido vive en Supabase. El Códice se reconstruye con lo publicado cada vez que pulsas **Desplegar**, en unos 2–5 minutos.

```
Códice Admin (Next.js · Vercel) ──escribe──► Supabase ◄──lee lo publicado── GitHub Actions (authorsite2)
       └──── «Desplegar» ──► workflow_dispatch deploy.yml ──► sync-from-db → docusaurus build → Pages
```

## Puesta en marcha (una sola vez)

### 1. Crear la base de datos

1. Crea un proyecto en [supabase.com](https://supabase.com) (el plan gratuito basta).
2. **Authentication → Sign In / Providers → Email**:
   - desactiva **Allow new users to sign up**;
   - desactiva **Confirm email**.
3. **SQL Editor**: pega y ejecuta el contenido de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
4. **Project Settings → API**: copia
   - la URL;
   - la *publishable key* (o *anon key*);
   - la *secret key* (o *service_role key*).

### 2. Variables locales

```bash
cp .env.example .env.local   # y rellena las claves de Supabase
npm install
```

### 3. Migrar el contenido actual de El Códice

```bash
npm run import          # lee ../authorsite2 → data/snapshot.json + data/import-report.md
npm run db:load         # carga la instantánea en Supabase (usa la clave secreta)
npm run db:create-admin -- <usuario> <email> <contraseña>
```

Revisa `data/import-report.md`: enumera los enlaces rotos, las imágenes que ya no existen y las etiquetas de ficha con variantes. Todo eso se corrige después desde el panel.

Volver a cargar desde cero: `npm run db:load -- --reset`.

### 4. Probar en local

```bash
npm run dev    # http://localhost:3000 → usuario y contraseña del paso 3
```

### 5. Publicar el admin en Vercel

1. Importa este repositorio en Vercel.
2. Define las variables de `.env.example`, **excepto** `SUPABASE_SECRET_KEY`: esa clave solo se usa en tu equipo para los scripts.
3. Para `GITHUB_TOKEN`, crea en GitHub un *fine-grained personal access token*:
   - repositorio: solo `authorsite2`;
   - permiso: **Actions: Read and write**.

### 6. Conectar El Códice (corte)

En el repositorio `authorsite2`, ve a **Settings → Secrets and variables → Actions → Variables** y crea:
- `SUPABASE_URL`;
- `SUPABASE_ANON_KEY` (la clave publicable; es pública por diseño, RLS solo deja leer lo publicado).

Desde ese momento, cada build de El Códice ejecuta `npm run sync` y usa el contenido de la base de datos. Sin esas variables, el sitio sigue construyéndose con los archivos del repositorio.

## Qué hay en el panel

| Sección | Qué controla en El Códice |
|---|---|
| **Artículos** | Fichas. Se editan en modo visual o en código MDX. La ficha (Infobox) se edita con formulario. También: datos, URL, borrador / publicar / despublicar, historial y enlaces entrantes y salientes. |
| **Universos** | Visibilidad (público / próximamente / oculto), orden, textos, portada, tema y categorías. |
| **Sidebar** | Orden y entradas de la barra lateral de cada universo (arrastrar y soltar). |
| **Grafos** | Interruptor «¿Página de grafo?» por universo. Al activarlo: grupos de color, exclusiones, filtros del lector y vista previa en vivo. Los enlaces se calculan solos a partir de los artículos. |
| **Timeline** | Carriles y entradas de la cronología de la portada, con vista previa. |
| **Libros** | Orden de lectura, colores, filtro por libro y tienda de la portada. |
| **Portada** | Título, lema, aviso superior, tarjetas y «Sobre el autor». |
| **Desplegar** | Cambios pendientes, botón para reconstruir El Códice e historial de despliegues. |

## Cómo funciona por dentro

- **Borrador y publicado.** Siempre se edita el borrador. **Publicar** genera el `.mdx` final (`src/lib/content/render.ts`) y lo guarda como instantánea; eso es lo único que lee el sitio.
- **Enlaces.** Se guardan como rutas legibles (`/CrSaSo/personajes/Anya%20Rudzki`) y se indexan en `article_links`. Si renombras o mueves un artículo, se reescriben en todos los artículos que lo enlazan.
- **Seguridad.**
  - Hay un solo administrador y el registro de usuarios está desactivado.
  - RLS: solo el administrador escribe; la clave anónima solo ve lo publicado.
  - Cada Server Action vuelve a comprobar la sesión.
- **Paridad.** La migración se verificó compilando El Códice con los archivos originales y con los regenerados desde la base de datos:
  - 158/158 páginas idénticas (texto, enlaces y títulos);
  - 110/110 fichas idénticas en el navegador.
