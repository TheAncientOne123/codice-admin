'use client';
// Copia de authorsite2/src/components/CrSaSoGraph (vista previa del grafo en el admin).
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import FA2Layout from 'graphology-layout-forceatlas2/worker';

/**
 * Simulación ForceAtlas2 en un web worker (estilo "fuerzas" de Obsidian).
 *
 * - `reheat(ms)` arranca la simulación y la detiene pasado ese tiempo
 *   (salvo que `continuous` esté activo).
 * - `dragRef.current = {node, x, y}` fija un nodo mientras se arrastra: el resto
 *   del grafo reacciona en vivo.
 */
export default function useForceLayout(graph, {repulsion, gravity, linLog, continuous}) {
  const layoutRef = useRef(null);
  const stopTimer = useRef(null);
  const dragRef = useRef(null);
  const continuousRef = useRef(continuous);
  const [running, setRunning] = useState(false);

  useLayoutEffect(() => {
    continuousRef.current = continuous;
  }, [continuous]);

  const clearStopTimer = () => {
    if (stopTimer.current) {
      clearTimeout(stopTimer.current);
      stopTimer.current = null;
    }
  };

  const stop = useCallback(() => {
    clearStopTimer();
    layoutRef.current?.stop();
    setRunning(false);
  }, []);

  const reheat = useCallback(
    (ms = 2500) => {
      const layout = layoutRef.current;
      if (!layout) return;
      clearStopTimer();
      if (!layout.isRunning()) layout.start();
      setRunning(true);
      if (!continuousRef.current && ms > 0) {
        stopTimer.current = setTimeout(() => {
          if (!continuousRef.current && !dragRef.current) stop();
        }, ms);
      }
    },
    [stop],
  );

  /* (Re)crear el worker cuando cambian las fuerzas. */
  useEffect(() => {
    if (!graph) return undefined;
    const inferred = forceAtlas2.inferSettings(graph);
    const layout = new FA2Layout(graph, {
      settings: {
        ...inferred,
        barnesHutOptimize: graph.order > 400,
        gravity,
        scalingRatio: repulsion,
        linLogMode: linLog,
        slowDown: 4,
        strongGravityMode: false,
        adjustSizes: false,
      },
      outputReducer: (key, attrs) => {
        const drag = dragRef.current;
        if (drag && drag.node === key) return {...attrs, x: drag.x, y: drag.y};
        return attrs;
      },
    });
    layoutRef.current = layout;
    return () => {
      clearStopTimer();
      layout.kill();
      if (layoutRef.current === layout) layoutRef.current = null;
      setRunning(false);
    };
  }, [graph, repulsion, gravity, linLog]);

  /* Al cambiar fuerzas (o al montar) se recalienta la simulación. */
  useEffect(() => {
    if (!graph) return;
    reheat(continuous ? 0 : 3200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, repulsion, gravity, linLog]);

  /* Modo continuo on/off (solo ante cambios, no al montar). */
  const prevContinuous = useRef(continuous);
  useEffect(() => {
    if (prevContinuous.current === continuous) return;
    prevContinuous.current = continuous;
    if (continuous) reheat(0);
    else if (layoutRef.current?.isRunning()) reheat(1200);
  }, [continuous, reheat]);

  return useMemo(() => ({running, reheat, stop, dragRef}), [running, reheat, stop]);
}
