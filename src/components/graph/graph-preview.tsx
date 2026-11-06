'use client';

import '@react-sigma/core/lib/style.css';
import {SigmaContainer} from '@react-sigma/core';
import {UndirectedGraph} from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import {useCallback, useEffect, useMemo, useState} from 'react';
import type {Settings} from 'sigma/settings';
import type {GraphNode} from '@/lib/content/graph';
import GraphRuntime from './GraphRuntime';
import {BASE_SIGMA_SETTINGS, baseNodeSize} from './graphRendering';
import useForceLayout from './useForceLayout';

// Ajustes compartidos con El Códice (JS sin tipos estrictos).
const SETTINGS = BASE_SIGMA_SETTINGS as unknown as Partial<Settings>;

function useColorScheme() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setMode(mq.matches ? 'dark' : 'light');
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mode;
}

/**
 * Vista previa del grafo con el mismo motor que El Códice (sigma + ForceAtlas2 en worker).
 * Los colores se actualizan al instante; la estructura se reconstruye al cambiar nodos o aristas.
 */
export default function GraphPreview({
  nodes,
  edges,
  repulsion,
  gravity,
  labelThreshold,
}: {
  nodes: GraphNode[];
  edges: {source: string; target: string}[];
  repulsion: number;
  gravity: number;
  labelThreshold: number;
}) {
  const colorMode = useColorScheme();
  const [hovered, setHovered] = useState<string | null>(null);
  const structureKey = useMemo(
    () => `${nodes.map((n) => n.id).join(',')}|${edges.length}`,
    [nodes, edges],
  );

  // Grafo: solo depende de la estructura, no de los colores.
  const graph = useMemo(() => {
    const g = new UndirectedGraph();
    nodes.forEach((n, i) => {
      const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      const size = baseNodeSize(n.degree);
      // `key` repite el id: el reductor de GraphRuntime solo recibe los atributos del nodo.
      g.addNode(n.id, {key: n.id, label: n.label, x: Math.cos(angle) * 200, y: Math.sin(angle) * 200, size, baseSize: size, fixed: n.degree === 0});
    });
    for (const e of edges) if (!g.hasEdge(e.source, e.target)) g.addEdge(e.source, e.target);
    try {
      forceAtlas2.assign(g, {iterations: 60, settings: {...forceAtlas2.inferSettings(g), gravity, scalingRatio: repulsion}});
    } catch {
      /* grafo vacío */
    }
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureKey]);

  const colorById = useMemo(() => new Map(nodes.map((n) => [n.id, n.color])), [nodes]);
  const nodeColor = useCallback((data: {label: string}, id?: string) => colorById.get(id ?? '') ?? '#999', [colorById]);
  const visibleNodes = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const focusNeighbors = useMemo(() => (hovered && graph.hasNode(hovered) ? new Set(graph.neighbors(hovered)) : null), [hovered, graph]);
  const layout = useForceLayout(graph, {repulsion, gravity, linLog: false, continuous: false});

  if (!nodes.length) {
    return <div className="grid h-full place-items-center text-sm text-muted">No hay artículos publicados en este universo.</div>;
  }

  return (
    <SigmaContainer key={structureKey} graph={graph} settings={SETTINGS} style={{height: '100%', width: '100%', background: 'transparent'}}>
      <GraphRuntime
        graph={graph}
        colorMode={colorMode}
        visibleNodes={visibleNodes}
        focusId={hovered}
        focusNeighbors={focusNeighbors}
        selectedId={null}
        searchMatches={null}
        nodeColor={(data: {key: string; label: string}) => nodeColor(data, data.key)}
        display={{nodeScale: 1, edgeScale: 1, labelThreshold, curvedEdges: true}}
        layout={layout}
        forcesKey={`${repulsion}|${gravity}`}
        focusRequest={null}
        fitRequest={null}
        onHover={setHovered}
        onSelect={() => {}}
        onOpen={() => {}}
      />
    </SigmaContainer>
  );
}
