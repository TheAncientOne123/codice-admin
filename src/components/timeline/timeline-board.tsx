'use client';
// Copia de authorsite2/src/components/WorkTimeline/WorkTimelineBoard.tsx (vista previa en el admin).
import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import clsx from 'clsx';
import type {TimelineEntry, TimelineKind, TimelineLane} from './types';
import styles from './workTimeline.module.css';

const YEAR_MS = 365.2425 * 24 * 3600 * 1000;
const SIDE_PAD = 72;
const AXIS_H = 52;
const LANE_HEAD_H = 34;
const ROW_H = 50;
const LANE_GAP = 18;
const MIN_PX_PER_YEAR = 140;
const MAX_PX_PER_YEAR = 2400;
const DEFAULT_PX_PER_YEAR = 420;

const KIND_LABEL: Record<TimelineKind, string> = {
  escritura: 'Escritura',
  publicacion: 'Publicación',
  proyecto: 'Proyecto futuro',
};

/** 'AAAA' | 'AAAA-MM' | 'AAAA-MM-DD' → ms (UTC). */
function parseDate(s: string): number {
  const [y, m = '1', d = '1'] = s.split('-');
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

function precisionOf(s: string): 'year' | 'month' | 'day' {
  const parts = s.split('-').length;
  return parts === 1 ? 'year' : parts === 2 ? 'month' : 'day';
}

function formatDate(s: string, approx?: boolean): string {
  const t = new Date(parseDate(s));
  const p = precisionOf(s);
  const opts: Intl.DateTimeFormatOptions =
    p === 'year'
      ? {year: 'numeric', timeZone: 'UTC'}
      : p === 'month'
        ? {month: 'short', year: 'numeric', timeZone: 'UTC'}
        : {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'};
  const out = new Intl.DateTimeFormat('es', opts).format(t);
  return approx ? `c. ${out}` : out;
}

function formatRange(e: TimelineEntry): string {
  if (e.kind === 'publicacion') return formatDate(e.start, e.approx);
  const from = formatDate(e.start, e.approx);
  if (e.end === null) return `${from} — en curso`;
  if (!e.end) return from;
  return `${from} — ${formatDate(e.end, e.approx)}`;
}

/** Estimación del ancho de la etiqueta (para apilar sin solapes). */
function labelWidth(e: TimelineEntry): number {
  const text = Math.max(e.title.length * 7.1, 90);
  return text + (e.cover ? 44 : 0) + 34;
}

type Placed = {
  entry: TimelineEntry;
  x0: number;
  x1: number;
  row: number;
  ongoing: boolean;
};

type LaneLayout = {lane: TimelineLane; top: number; height: number; items: Placed[]};

function isExternal(href?: string) {
  return !!href && /^https?:\/\//i.test(href);
}

export type WorkTimelineBoardProps = {
  /** Carriles y entradas. Por defecto, los de src/data/authorTimeline.ts. */
  lanes?: TimelineLane[];
  entries?: TimelineEntry[];
};

export default function WorkTimelineBoard({
  lanes: laneData = [],
  entries: entryData = [],
}: WorkTimelineBoardProps = {}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pxPerYear, setPxPerYear] = useState(DEFAULT_PX_PER_YEAR);
  // Selección inicial: la publicación más reciente.
  const [selectedId, setSelectedId] = useState<string | null>(
    () =>
      [...entryData]
        .filter((e) => e.kind === 'publicacion')
        .sort((a, b) => parseDate(b.start) - parseDate(a.start))[0]?.id ?? null,
  );
  const [dragging, setDragging] = useState(false);
  // Hora fija para todo el ciclo de vida del tablero (inicializador perezoso: render puro).
  const [today] = useState(() => Date.now());

  /* Rango temporal: medio año antes del primer hito y uno después del último. */
  const [minT, maxT] = useMemo(() => {
    let lo = Infinity;
    let hi = today;
    for (const e of entryData) {
      lo = Math.min(lo, parseDate(e.start));
      hi = Math.max(hi, parseDate(e.end ?? e.start));
    }
    const loDate = new Date(lo);
    const hiDate = new Date(hi);
    return [
      Date.UTC(loDate.getUTCFullYear(), 0, 1),
      Date.UTC(hiDate.getUTCFullYear() + 1, 0, 1),
    ];
  }, [today, entryData]);

  const xOf = useCallback(
    (t: number) => SIDE_PAD + ((t - minT) / YEAR_MS) * pxPerYear,
    [minT, pxPerYear],
  );
  const tOf = useCallback(
    (x: number) => minT + ((x - SIDE_PAD) / pxPerYear) * YEAR_MS,
    [minT, pxPerYear],
  );

  const worldWidth = xOf(maxT) + SIDE_PAD;

  /* Reparto por carriles y filas (greedy) en coordenadas de pantalla. */
  const lanes: LaneLayout[] = useMemo(() => {
    const out: LaneLayout[] = [];
    let top = AXIS_H + 12;
    for (const lane of laneData) {
      const entries = entryData.filter((e) => e.lane === lane.id).sort(
        (a, b) => parseDate(a.start) - parseDate(b.start),
      );
      const rowEnds: number[] = [];
      const items: Placed[] = entries.map((entry) => {
        const ongoing = entry.kind !== 'publicacion' && entry.end === null;
        const x0 = xOf(parseDate(entry.start));
        const x1 =
          entry.kind === 'publicacion'
            ? x0
            : xOf(ongoing ? today : parseDate(entry.end ?? entry.start));
        const extentStart = entry.kind === 'publicacion' ? x0 - 10 : x0;
        const extentEnd = Math.max(x1, x0 + labelWidth(entry));
        let row = rowEnds.findIndex((end) => end + 14 <= extentStart);
        if (row === -1) {
          row = rowEnds.length;
          rowEnds.push(extentEnd);
        } else {
          rowEnds[row] = extentEnd;
        }
        return {entry, x0, x1, row, ongoing};
      });
      const rows = Math.max(1, rowEnds.length);
      const height = LANE_HEAD_H + rows * ROW_H + 8;
      out.push({lane, top, height, items});
      top += height + LANE_GAP;
    }
    return out;
  }, [xOf, today, laneData, entryData]);

  const worldHeight = lanes.length
    ? lanes[lanes.length - 1].top + lanes[lanes.length - 1].height + 14
    : 200;

  /* Marcas del eje: años siempre; trimestres o meses según el zoom. */
  const ticks = useMemo(() => {
    const out: {x: number; label?: string; major: boolean}[] = [];
    const y0 = new Date(minT).getUTCFullYear();
    const y1 = new Date(maxT).getUTCFullYear();
    const step = pxPerYear >= 700 ? 1 : pxPerYear >= 260 ? 3 : 0;
    const monthFmt = new Intl.DateTimeFormat('es', {month: 'short', timeZone: 'UTC'});
    for (let y = y0; y <= y1; y++) {
      out.push({x: xOf(Date.UTC(y, 0, 1)), label: String(y), major: true});
      if (!step || y === y1) continue;
      for (let m = step; m < 12; m += step) {
        const t = Date.UTC(y, m, 1);
        out.push({
          x: xOf(t),
          label: pxPerYear >= 1100 || step === 3 ? monthFmt.format(t).replace('.', '') : undefined,
          major: false,
        });
      }
    }
    return out;
  }, [minT, maxT, pxPerYear, xOf]);

  /* ── Zoom anclado a un punto del viewport ── */
  const pendingScroll = useRef<number | null>(null);

  const zoomTo = useCallback(
    (next: number, anchorClientX?: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const clamped = Math.min(MAX_PX_PER_YEAR, Math.max(MIN_PX_PER_YEAR, next));
      const rect = el.getBoundingClientRect();
      const anchor = anchorClientX != null ? anchorClientX - rect.left : el.clientWidth / 2;
      const t = tOf(el.scrollLeft + anchor);
      const newX = SIDE_PAD + ((t - minT) / YEAR_MS) * clamped;
      pendingScroll.current = newX - anchor;
      setPxPerYear(clamped);
    },
    [tOf, minT],
  );

  useLayoutEffect(() => {
    if (pendingScroll.current != null && scrollRef.current) {
      scrollRef.current.scrollLeft = pendingScroll.current;
      pendingScroll.current = null;
    }
  }, [pxPerYear]);

  const centerOn = useCallback(
    (t: number, smooth = true) => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({left: xOf(t) - el.clientWidth / 2, behavior: smooth ? 'smooth' : 'auto'});
    },
    [xOf],
  );

  const fitAll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const years = (maxT - minT) / YEAR_MS;
    const next = (el.clientWidth - SIDE_PAD * 2) / years;
    pendingScroll.current = 0;
    setPxPerYear(Math.min(MAX_PX_PER_YEAR, Math.max(MIN_PX_PER_YEAR, next)));
  }, [minT, maxT]);

  /*
   * Al montar: zoom que muestre todo si cabe con holgura (pantallas anchas);
   * si no, una escala legible con "hoy" hacia la derecha para ver el pasado reciente.
   */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const years = (maxT - minT) / YEAR_MS;
    const fit = (el.clientWidth - SIDE_PAD * 2) / years;
    const next = Math.min(MAX_PX_PER_YEAR, Math.max(300, fit));
    const todayAt = SIDE_PAD + ((today - minT) / YEAR_MS) * next;
    const left = Math.max(0, todayAt - el.clientWidth * 0.72);
    if (next === pxPerYear) el.scrollLeft = left;
    else {
      pendingScroll.current = left;
      setPxPerYear(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Ctrl/⌘ + rueda = zoom (rueda normal sigue desplazando la página). */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      ev.preventDefault();
      const factor = Math.exp(-ev.deltaY * 0.0022);
      setPxPerYear((cur) => {
        const rect = el.getBoundingClientRect();
        const anchor = ev.clientX - rect.left;
        const t = minT + ((el.scrollLeft + anchor - SIDE_PAD) / cur) * YEAR_MS;
        const next = Math.min(MAX_PX_PER_YEAR, Math.max(MIN_PX_PER_YEAR, cur * factor));
        pendingScroll.current = SIDE_PAD + ((t - minT) / YEAR_MS) * next - anchor;
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, {passive: false});
    return () => el.removeEventListener('wheel', onWheel);
  }, [minT]);

  /* Arrastrar para desplazar (ratón). En táctil se usa el scroll nativo. */
  const drag = useRef<{x: number; left: number; moved: boolean} | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
    const el = scrollRef.current;
    if (!el) return;
    drag.current = {x: ev.clientX, left: el.scrollLeft, moved: false};
  };
  const onPointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = scrollRef.current;
    if (!d || !el) return;
    const dx = ev.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 4) {
      d.moved = true;
      setDragging(true);
      el.setPointerCapture(ev.pointerId);
    }
    if (d.moved) el.scrollLeft = d.left - dx;
  };
  const endDrag = (ev: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      suppressClick.current = true;
      setDragging(false);
      scrollRef.current?.releasePointerCapture?.(ev.pointerId);
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
  };

  const onKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>) => {
    if (ev.key === '+' || ev.key === '=') {
      ev.preventDefault();
      zoomTo(pxPerYear * 1.3);
    } else if (ev.key === '-') {
      ev.preventDefault();
      zoomTo(pxPerYear / 1.3);
    }
  };

  const select = (id: string) => {
    if (suppressClick.current) return;
    setSelectedId((cur) => (cur === id ? null : id));
  };

  const selected = entryData.find((e) => e.id === selectedId) ?? null;
  const selectedLane = selected ? laneData.find((l) => l.id === selected.lane) : null;
  const todayX = xOf(today);

  return (
    <div className={styles.boardWrap}>
      <div className={styles.toolbar}>
        <div className={styles.legend} aria-label="Leyenda">
          <span className={styles.legendItem}>
            <span className={clsx(styles.legendSwatch, styles.swatchBar)} aria-hidden />
            Escritura
          </span>
          <span className={styles.legendItem}>
            <span className={clsx(styles.legendSwatch, styles.swatchPin)} aria-hidden />
            Publicación
          </span>
          <span className={styles.legendItem}>
            <span className={clsx(styles.legendSwatch, styles.swatchPlanned)} aria-hidden />
            Proyecto futuro
          </span>
        </div>
        <div className={styles.controls} role="group" aria-label="Zoom de la cronología">
          <button type="button" className={styles.ctrl} onClick={() => zoomTo(pxPerYear / 1.4)} aria-label="Alejar">
            −
          </button>
          <span className={styles.zoomValue} aria-live="polite">
            {Math.round((pxPerYear / DEFAULT_PX_PER_YEAR) * 100)}%
          </span>
          <button type="button" className={styles.ctrl} onClick={() => zoomTo(pxPerYear * 1.4)} aria-label="Acercar">
            +
          </button>
          <button type="button" className={clsx(styles.ctrl, styles.ctrlText)} onClick={() => centerOn(today)}>
            Hoy
          </button>
          <button type="button" className={clsx(styles.ctrl, styles.ctrlText)} onClick={fitAll}>
            Ver todo
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={clsx(styles.board, dragging && styles.boardDragging)}
        style={{['--px-per-year' as string]: `${pxPerYear}px`, ['--world-pad' as string]: `${SIDE_PAD}px`}}
        tabIndex={0}
        role="region"
        aria-label="Cronología de escritura y publicación. Arrastra para desplazarte; Ctrl + rueda para hacer zoom."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <div className={styles.world} style={{width: worldWidth, height: worldHeight}}>
          {/* Guías verticales */}
          {ticks.map((tk) => (
            <div
              key={`g-${tk.x}`}
              className={clsx(styles.gridLine, tk.major && styles.gridLineMajor)}
              style={{left: tk.x}}
              aria-hidden
            />
          ))}

          {/* Eje */}
          <div className={styles.axis} aria-hidden>
            {ticks.map((tk) =>
              tk.label ? (
                <span
                  key={`t-${tk.x}`}
                  className={clsx(styles.tick, tk.major ? styles.tickMajor : styles.tickMinor)}
                  style={{left: tk.x}}
                >
                  {tk.label}
                </span>
              ) : null,
            )}
          </div>

          {/* Hoy */}
          <div className={styles.todayLine} style={{left: todayX}} aria-hidden>
            <span className={styles.todayPill}>Hoy</span>
          </div>

          {/* Carriles */}
          {lanes.map(({lane, top, height, items}) => (
            <section
              key={lane.id}
              className={styles.lane}
              style={{top, height, ['--lane-color' as string]: lane.color}}
              aria-label={lane.label}
            >
              <div className={styles.laneHead}>
                <span className={styles.laneDot} aria-hidden />
                {lane.href ? (
                  <a href={lane.href} className={styles.laneLink}>
                    {lane.label}
                  </a>
                ) : (
                  lane.label
                )}
              </div>

              {items.map(({entry, x0, x1, row, ongoing}) => {
                const y = LANE_HEAD_H + row * ROW_H;
                const isSel = entry.id === selectedId;
                if (entry.kind === 'publicacion') {
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className={clsx(styles.pin, isSel && styles.selected)}
                      style={{left: x0, top: y}}
                      onClick={() => select(entry.id)}
                      aria-pressed={isSel}
                    >
                      <span className={styles.pinDiamond} aria-hidden />
                      <span className={styles.pinCard}>
                        {entry.cover ? (
                          <img className={styles.pinCover} src={entry.cover} alt="" loading="lazy" draggable={false} />
                        ) : null}
                        <span className={styles.itemText}>
                          <span className={styles.itemTitle}>{entry.title}</span>
                          <span className={styles.itemDate}>{formatDate(entry.start, entry.approx)}</span>
                        </span>
                      </span>
                    </button>
                  );
                }
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={clsx(
                      styles.bar,
                      entry.kind === 'proyecto' && styles.barPlanned,
                      ongoing && styles.barOngoing,
                      isSel && styles.selected,
                    )}
                    style={{left: x0, top: y, width: Math.max(x1 - x0, 10)}}
                    onClick={() => select(entry.id)}
                    aria-pressed={isSel}
                  >
                    <span className={styles.itemText}>
                      <span className={styles.itemTitle}>{entry.title}</span>
                      <span className={styles.itemDate}>{formatRange(entry)}</span>
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </div>

      <p className={styles.hint}>
        Arrastra para recorrer la línea · <kbd>Ctrl</kbd> + rueda o los botones para hacer zoom · haz clic en un hito para ver detalles.
      </p>

      <div className={styles.detail} aria-live="polite">
        {selected && selectedLane ? (
          <article className={styles.detailCard} style={{['--lane-color' as string]: selectedLane.color}}>
            {selected.cover ? (
              <img className={styles.detailCover} src={selected.cover} alt={`Portada de ${selected.title}`} loading="lazy" />
            ) : null}
            <div className={styles.detailBody}>
              <p className={styles.detailKicker}>
                <span className={styles.laneDot} aria-hidden />
                {selectedLane.label} · {KIND_LABEL[selected.kind]}
              </p>
              <h3 className={styles.detailTitle}>{selected.title}</h3>
              <p className={styles.detailDate}>
                {formatRange(selected)}
                {selected.approx ? <span className={styles.approx}>fecha aproximada</span> : null}
              </p>
              {selected.description ? <p className={styles.detailText}>{selected.description}</p> : null}
              {selected.href ? (
                isExternal(selected.href) ? (
                  <a className={styles.detailLink} href={selected.href} target="_blank" rel="noopener noreferrer">
                    Ver en tienda →
                  </a>
                ) : (
                  <span className={styles.detailLink}>Enlace: {selected.href}</span>
                )
              ) : null}
            </div>
            <button type="button" className={styles.detailClose} onClick={() => setSelectedId(null)} aria-label="Cerrar detalle">
              ×
            </button>
          </article>
        ) : (
          <p className={styles.detailEmpty}>Selecciona un elemento de la cronología.</p>
        )}
      </div>
    </div>
  );
}
