/** Contenido editable de la portada y ajustes generales de El Códice (tabla site_settings). */
export type SiteSettings = {
  title: string;
  tagline: string;
  announcement: {enabled: boolean; id: string; content: string};
  hero: {buttonLabel: string; buttonHref: string};
  features: {title: string; image: string; description: string}[];
  about: {title: string; image: string; paragraphs: string[]};
  storeTitle: string;
  timelineTitle: string;
  timelineSubtitle: string;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  title: 'El Códice',
  tagline: '',
  announcement: {enabled: false, id: 'aviso', content: ''},
  hero: {buttonLabel: 'Entrar', buttonHref: '/universes'},
  features: [],
  about: {title: 'Sobre el autor', image: '', paragraphs: []},
  storeTitle: 'Adquiere mis libros',
  timelineTitle: 'Cronología de la obra',
  timelineSubtitle: '',
};

export function withDefaults(data: Partial<SiteSettings> | null | undefined): SiteSettings {
  const d = data ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...d,
    announcement: {...DEFAULT_SETTINGS.announcement, ...d.announcement},
    hero: {...DEFAULT_SETTINGS.hero, ...d.hero},
    about: {...DEFAULT_SETTINGS.about, ...d.about},
    features: d.features ?? [],
  };
}
