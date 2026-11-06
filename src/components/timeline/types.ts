/** Mismos tipos que authorsite2/src/data/authorTimeline.ts. */
export type TimelineKind = 'escritura' | 'publicacion' | 'proyecto';
export type TimelineLane = {id: string; label: string; color: string; href?: string};
export type TimelineEntry = {
  id: string;
  lane: TimelineLane['id'];
  kind: TimelineKind;
  title: string;
  start: string;
  end?: string | null;
  approx?: boolean;
  description?: string;
  href?: string;
  cover?: string;
};
