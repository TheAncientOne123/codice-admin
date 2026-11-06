/**
 * Componentes que puede usar un artículo de El Códice y su import en el sitio.
 * El renderizador añade los imports según lo que aparece en el MDX final.
 */
export const COMPONENT_IMPORTS: Record<string, string> = {
  Link: '@docusaurus/Link',
  BrowserOnly: '@docusaurus/BrowserOnly',
  Infobox: '@site/src/components/Infobox',
  FamilyMemberGrid: '@site/src/components/FamilyMemberGrid',
  CardsFromFolder: '@site/src/components/Cards/CardsFromFolder',
  WikiFloatFigure: '@site/src/components/WikiFloatFigure/WikiFloatFigure',
  YouTubeEmbed: '@site/src/components/YouTubeEmbed',
  RecentArticles: '@site/src/components/UniverseHome/RecentArticles',
  CardTicker: '@site/src/components/CardTicker/CardTicker',
  LibrosHub: '@site/src/components/Books/LibrosHub',
  FeaturedArticle: '@site/src/components/FeaturedArticle/FeaturedArticle',
  BookRoll: '@site/src/components/BooksRoll/BookRoll',
  BookManuscriptStats: '@site/src/components/Books/BookManuscriptStats',
  BookDocHeader: '@site/src/components/Books/BookDocHeader',
  BestiaryCard: '@site/src/components/BestiaryCard',
};

/** Orden estable de imports en el archivo generado. */
const IMPORT_ORDER = Object.keys(COMPONENT_IMPORTS);

export function usedComponents(mdx: string): string[] {
  return IMPORT_ORDER.filter((name) => new RegExp(`<${name}[\\s/>]`).test(mdx));
}

export function importLines(mdx: string): string[] {
  return usedComponents(mdx).map((name) => `import ${name} from '${COMPONENT_IMPORTS[name]}';`);
}
