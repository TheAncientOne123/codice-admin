'use client';

import {GenericJsxEditor, type JsxComponentDescriptor, type JsxEditorProps} from '@mdxeditor/editor';

/**
 * Componentes de El Códice que pueden aparecer en el cuerpo de un artículo.
 * Cada uno se edita como formulario (GenericJsxEditor) dentro del editor visual.
 * `source` se omite: los imports los genera el renderizador al publicar.
 */

function FichaPlaceholder() {
  return (
    <div className="my-2 rounded-lg border border-dashed border-accent/60 bg-accent/5 px-4 py-3 text-sm">
      <strong>Ficha (Infobox)</strong> — se coloca aquí. Edítala en la pestaña «Ficha».
    </div>
  );
}

function LineBreakMarker() {
  return (
    <span className="mx-0.5 rounded bg-accent/15 px-1 text-xs text-accent" title="Salto de línea">
      ↵
    </span>
  );
}

function Labeled(label: string) {
  return function LabeledEditor(props: JsxEditorProps) {
    return (
      <div className="codice-jsx my-2 rounded-lg border border-line bg-surface-2 p-2">
        <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
        <GenericJsxEditor {...props} />
      </div>
    );
  };
}

const s = (name: string) => ({name, type: 'string' as const});
const n = (name: string) => ({name, type: 'number' as const});
const e = (name: string) => ({name, type: 'expression' as const});

export const JSX_DESCRIPTORS: JsxComponentDescriptor[] = [
  {name: 'FichaInfobox', kind: 'flow', props: [], hasChildren: false, Editor: FichaPlaceholder},
  {
    name: 'WikiFloatFigure', kind: 'flow', hasChildren: false, Editor: Labeled('Figura flotante'),
    props: [s('image'), s('src'), s('alt'), s('caption'), s('subtitle'), s('align'), s('size'), s('credit'), s('author'), s('source'), s('width')],
  },
  {name: 'YouTubeEmbed', kind: 'flow', hasChildren: false, Editor: Labeled('Vídeo de YouTube'), props: [s('id'), s('url'), s('title'), n('start'), e('showWatchLink')]},
  {
    name: 'CardsFromFolder', kind: 'flow', hasChildren: false, Editor: Labeled('Buscador de fichas'),
    props: [s('folder'), s('pluginId'), e('filterDimensions'), e('excludeIds'), s('descriptionFallback'), s('searchPlaceholder')],
  },
  {name: 'FamilyMemberGrid', kind: 'flow', hasChildren: false, Editor: Labeled('Miembros de la familia'), props: [s('pluginId'), e('members')]},
  {name: 'FeaturedArticle', kind: 'flow', hasChildren: false, Editor: Labeled('Artículo destacado'), props: [s('docId'), s('pluginId'), s('title'), s('to')]},
  {name: 'RecentArticles', kind: 'flow', hasChildren: false, Editor: Labeled('Artículos recientes'), props: [s('pluginId'), n('limit')]},
  {name: 'CardTicker', kind: 'flow', hasChildren: false, Editor: Labeled('Carrusel de tarjetas'), props: [e('cards'), n('speed'), e('pauseOnHover')]},
  {name: 'BestiaryCard', kind: 'flow', hasChildren: true, Editor: Labeled('Tarjeta de bestiario'), props: [s('title'), s('to'), e('image')]},
  {name: 'Infobox', kind: 'flow', hasChildren: false, Editor: Labeled('Ficha adicional'), props: [s('title'), s('caption'), e('image'), e('images'), e('rows')]},
  {name: 'BookRoll', kind: 'flow', hasChildren: false, Editor: Labeled('Carrete de libros'), props: []},
  {name: 'LibrosHub', kind: 'flow', hasChildren: false, Editor: Labeled('Orden de lectura'), props: []},
  {name: 'BookManuscriptStats', kind: 'flow', hasChildren: false, Editor: Labeled('Estadísticas del manuscrito'), props: []},
  {name: 'BookDocHeader', kind: 'flow', hasChildren: false, Editor: Labeled('Cabecera de libro'), props: []},
  {name: 'Link', kind: 'text', hasChildren: true, Editor: GenericJsxEditor, props: [s('to')]},
  // Salto de línea forzado: el editor visual no conserva "dos espacios + Intro", así que se usa <br />.
  {name: 'br', kind: 'text', hasChildren: false, props: [], Editor: LineBreakMarker},
  // Cualquier otra etiqueta (p. ej. <div style={…} />): editable como JSX genérico.
  {name: '*', kind: 'flow', hasChildren: true, Editor: Labeled('Elemento JSX'), props: []},
];

/** Plantillas del menú «Insertar componente». */
export const INSERTABLE: {label: string; name: string; props: Record<string, string | {type: 'expression'; value: string}>}[] = [
  {label: 'Figura flotante (imagen)', name: 'WikiFloatFigure', props: {image: 'https://', alt: '', caption: '', align: 'right', size: 'md'}},
  {label: 'Vídeo de YouTube', name: 'YouTubeEmbed', props: {url: 'https://www.youtube.com/watch?v=', title: ''}},
  {label: 'Buscador de fichas (carpeta)', name: 'CardsFromFolder', props: {folder: 'personajes', pluginId: 'cronicas'}},
  {label: 'Miembros de familia', name: 'FamilyMemberGrid', props: {pluginId: 'cronicas', members: {type: 'expression', value: "['personajes/Nombre']"}}},
  {label: 'Artículo destacado', name: 'FeaturedArticle', props: {docId: 'personajes/Nombre', pluginId: 'cronicas'}},
  {label: 'Artículos recientes', name: 'RecentArticles', props: {pluginId: 'cronicas', limit: '3'}},
  {label: 'Carrusel de tarjetas', name: 'CardTicker', props: {cards: {type: 'expression', value: "[{ icon: '📖', title: 'Título', text: 'Texto', to: '/ruta' }]"}}},
  {label: 'Carrete de libros', name: 'BookRoll', props: {}},
  {label: 'Orden de lectura (libros)', name: 'LibrosHub', props: {}},
  {label: 'Marcador de la ficha', name: 'FichaInfobox', props: {}},
];
