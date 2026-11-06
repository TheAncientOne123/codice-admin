'use client';

import '@mdxeditor/editor/style.css';
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ButtonWithTooltip,
  CreateLink,
  DiffSourceToggleWrapper,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  type MDXEditorMethods,
  Separator,
  UndoRedo,
  diffSourcePlugin,
  headingsPlugin,
  insertJsx$,
  insertMarkdown$,
  jsxPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor';
import {usePublisher} from '@mdxeditor/gurx';
import {useEffect, useMemo, useRef, useState} from 'react';
import type {LinkTarget} from '@/lib/data/content-context';
import {INSERTABLE, JSX_DESCRIPTORS} from './jsx-descriptors';
import {LinkPicker} from './link-picker';

function useDarkMode() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setDark(document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && mq.matches));
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return dark;
}

function LinkArticleButton({targets}: {targets: LinkTarget[]}) {
  const insertMarkdown = usePublisher(insertMarkdown$);
  const [open, setOpen] = useState(false);
  return (
    <>
      <ButtonWithTooltip title="Enlazar a otra ficha" onClick={() => setOpen(true)}>
        <span className="px-1 text-xs font-semibold">Ficha ↗</span>
      </ButtonWithTooltip>
      {open ? (
        <LinkPicker
          targets={targets}
          onClose={() => setOpen(false)}
          onPick={(t) => {
            insertMarkdown(`[${t.title}](${t.href})`);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

/** Inserta <br /> (Mayús+Intro no se conserva al guardar en el modo visual). */
function LineBreakButton() {
  const insertJsx = usePublisher(insertJsx$);
  return (
    <ButtonWithTooltip title="Salto de línea dentro del párrafo" onClick={() => insertJsx({name: 'br', kind: 'text', props: {}})}>
      <span className="px-1 text-xs font-semibold">↵</span>
    </ButtonWithTooltip>
  );
}

function InsertComponentMenu() {
  const insertJsx = usePublisher(insertJsx$);
  return (
    <select
      aria-label="Insertar componente"
      className="ml-1 rounded-md border border-line bg-transparent px-1.5 py-1 text-xs"
      value=""
      onChange={(e) => {
        const item = INSERTABLE.find((i) => i.name === e.target.value);
        if (item) insertJsx({name: item.name, kind: 'flow', props: item.props});
      }}
    >
      <option value="">+ Componente…</option>
      {INSERTABLE.map((i) => (
        <option key={i.name} value={i.name}>
          {i.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Editor del cuerpo (MDX). Visual por defecto, con interruptor a código.
 * Si el contenido no se puede representar en modo visual, abre en modo código.
 */
export default function MdxBodyEditor({
  markdown,
  onChange,
  targets,
  onReady,
  onParseError,
}: {
  markdown: string;
  onChange: (md: string) => void;
  targets: LinkTarget[];
  /** Acceso a getMarkdown()/setMarkdown() del editor una vez montado. */
  onReady?: (methods: MDXEditorMethods) => void;
  /** Se llama si el modo visual no puede leer el contenido (se abre en modo código). */
  onParseError?: (message: string) => void;
}) {
  const ref = useRef<MDXEditorMethods>(null);
  const dark = useDarkMode();
  const [parseError, setParseError] = useState<string | null>(null);
  const suggestions = useMemo(() => targets.map((t) => t.href), [targets]);

  useEffect(() => {
    if (ref.current) onReady?.(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parseError]);

  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      tablePlugin(),
      linkPlugin(),
      linkDialogPlugin({linkAutocompleteSuggestions: suggestions}),
      jsxPlugin({jsxComponentDescriptors: JSX_DESCRIPTORS}),
      markdownShortcutPlugin(),
      diffSourcePlugin({viewMode: parseError ? 'source' : 'rich-text'}),
      toolbarPlugin({
        toolbarContents: () => (
          <DiffSourceToggleWrapper options={['rich-text', 'source']}>
            <UndoRedo />
            <Separator />
            <BlockTypeSelect />
            <BoldItalicUnderlineToggles options={['Bold', 'Italic']} />
            <ListsToggle options={['bullet', 'number']} />
            <Separator />
            <CreateLink />
            <LinkArticleButton targets={targets} />
            <LineBreakButton />
            <InsertThematicBreak />
            <InsertTable />
            <InsertComponentMenu />
          </DiffSourceToggleWrapper>
        ),
      }),
    ],
    // El editor se recrea solo al cambiar a modo código por error de lectura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parseError],
  );

  return (
    <div>
      {parseError ? (
        <p className="mb-2 rounded-lg border border-warn/50 bg-warn/10 px-3 py-2 text-xs">
          Este artículo usa MDX que el modo visual no puede mostrar ({parseError}). Se abrió en modo código; puedes editarlo con
          normalidad.
        </p>
      ) : null}
      <MDXEditor
        key={parseError ? 'source' : 'rich'}
        ref={ref}
        markdown={markdown}
        onChange={(md, initialNormalize) => {
          if (!initialNormalize) onChange(md);
        }}
        onError={({error}) => {
          onParseError?.(error);
          setParseError((prev) => prev ?? error.slice(0, 120));
        }}
        plugins={plugins}
        className={`codice-mdx rounded-xl border border-line bg-surface ${dark ? 'dark-theme' : ''}`}
        contentEditableClassName="codice-prose"
      />
    </div>
  );
}
