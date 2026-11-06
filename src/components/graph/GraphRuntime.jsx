'use client';
// Copia de authorsite2/src/components/CrSaSoGraph (vista previa del grafo en el admin).
import {useEffect, useLayoutEffect, useRef} from 'react';
import {useSigma} from '@react-sigma/core';
import {getGraphTheme, setGraphTheme} from './graphRendering';

/** Caja envolvente (coordenadas del grafo) de un conjunto de nodos. */
function graphBBox(graph, nodeIds) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of nodeIds) {
    if (!graph.hasNode(id)) continue;
    const {x, y} = graph.getNodeAttributes(id);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) return null;
  if (maxX - minX < 1) {
    minX -= 1;
    maxX += 1;
  }
  if (maxY - minY < 1) {
    minY -= 1;
    maxY += 1;
  }
  return {x: [minX, maxX], y: [minY, maxY]};
}

/** Encaja la cámara en un conjunto de nodos (coordenadas normalizadas de sigma). */
export function fitCameraToNodes(sigma, nodeIds, duration = 450) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of nodeIds) {
    const d = sigma.getNodeDisplayData(id);
    if (!d) continue;
    minX = Math.min(minX, d.x);
    maxX = Math.max(maxX, d.x);
    minY = Math.min(minY, d.y);
    maxY = Math.max(maxY, d.y);
  }
  if (!Number.isFinite(minX)) return;
  const span = Math.max(maxX - minX, maxY - minY);
  const ratio = Math.min(1.2, Math.max(0.12, span * 1.35 + 0.04));
  sigma
    .getCamera()
    .animate({x: (minX + maxX) / 2, y: (minY + maxY) / 2, ratio}, {duration, easing: 'cubicInOut'});
}

/**
 * Puente entre el estado React y sigma: tema, reductores (filtros, foco,
 * búsqueda), eventos (hover, clic, arrastre) y movimientos de cámara.
 */
export default function GraphRuntime({
  graph,
  colorMode,
  visibleNodes,
  focusId,
  focusNeighbors,
  selectedId,
  searchMatches,
  nodeColor,
  display,
  layout,
  forcesKey,
  focusRequest,
  fitRequest,
  onHover,
  onSelect,
  onOpen,
}) {
  const sigma = useSigma();
  const draggingRef = useRef(null);
  const visibleRef = useRef(visibleNodes);
  /** Fija el encuadre a los nodos visibles (los ocultos no deben deformarlo). */
  const frameVisibleRef = useRef(null);
  const justDraggedRef = useRef(false);
  const handlers = useRef({onHover, onSelect, onOpen});

  // Valores "más recientes" para los manejadores de eventos: se actualizan tras cada
  // render (antes de que el navegador pinte), nunca durante el render.
  useLayoutEffect(() => {
    visibleRef.current = visibleNodes;
    handlers.current = {onHover, onSelect, onOpen};
    frameVisibleRef.current = () => {
      const box = graphBBox(graph, visibleRef.current);
      sigma.setCustomBBox(box ?? sigma.getBBox());
    };
  });

  /* Tema (canvas no lee variables CSS). */
  useEffect(() => {
    setGraphTheme(colorMode);
    sigma.refresh();
  }, [colorMode, sigma]);

  /* Ajustes de visualización. */
  useEffect(() => {
    sigma.setSetting('labelRenderedSizeThreshold', display.labelThreshold);
  }, [display.labelThreshold, sigma]);

  /* Reductores: todo lo visual que depende del estado. */
  useEffect(() => {
    const t = getGraphTheme();
    const many = focusNeighbors && focusNeighbors.size > 24;

    sigma.setSetting('nodeReducer', (node, data) => {
      if (!visibleNodes.has(node)) return {...data, hidden: true};
      const res = {...data};
      res.size = data.baseSize * display.nodeScale;
      res.color = nodeColor(data);
      res.borderSize = 0;

      if (focusId) {
        if (node === focusId) {
          res.zIndex = 3;
          res.forceLabel = true;
          res.labelWeight = '700';
        } else if (focusNeighbors?.has(node)) {
          res.zIndex = 2;
          if (!many) res.forceLabel = true;
        } else {
          res.color = t.nodeDim;
          res.label = '';
          res.zIndex = 0;
        }
      } else if (searchMatches) {
        if (searchMatches.has(node)) {
          res.zIndex = 2;
          res.forceLabel = true;
          res.borderSize = 0.28;
          res.borderColor = t.accent;
        } else {
          res.color = t.nodeDim;
          res.label = '';
        }
      }

      if (node === selectedId) {
        res.borderSize = 0.32;
        res.borderColor = t.accent;
        res.forceLabel = true;
        res.labelWeight = '700';
        res.zIndex = 3;
      }
      if (draggingRef.current === node) res.highlighted = true;
      return res;
    });

    sigma.setSetting('edgeReducer', (edge, data) => {
      const [s, d] = graph.extremities(edge);
      if (!visibleNodes.has(s) || !visibleNodes.has(d)) return {...data, hidden: true};
      const res = {...data};
      res.type = display.curvedEdges ? 'curved' : 'line';
      res.size = 0.7 * display.edgeScale;
      res.color = t.edge;
      if (focusId) {
        if (s === focusId || d === focusId) {
          res.color = t.edgeFocus;
          res.size = 1.5 * display.edgeScale;
          res.zIndex = 1;
        } else {
          res.color = t.edgeDim;
        }
      } else if (searchMatches) {
        res.color = t.edgeDim;
      }
      return res;
    });
  }, [
    sigma,
    graph,
    colorMode,
    visibleNodes,
    focusId,
    focusNeighbors,
    selectedId,
    searchMatches,
    nodeColor,
    display.nodeScale,
    display.edgeScale,
    display.curvedEdges,
  ]);

  /* Eventos: hover, clic, doble clic y arrastre de nodos (con la simulación viva). */
  useEffect(() => {
    const container = sigma.getContainer();
    const {dragRef, reheat} = layout;

    const onEnter = ({node}) => {
      container.style.cursor = 'pointer';
      if (!draggingRef.current) handlers.current.onHover(node);
    };
    const onLeave = () => {
      if (!draggingRef.current) container.style.cursor = '';
      if (!draggingRef.current) handlers.current.onHover(null);
    };
    const onDown = ({node}) => {
      draggingRef.current = node;
      justDraggedRef.current = false;
      const a = graph.getNodeAttributes(node);
      dragRef.current = {node, x: a.x, y: a.y};
      if (!sigma.getCustomBBox()) frameVisibleRef.current();
    };
    // sigma 3: moveBody recibe {event, preventSigmaDefault}; las coordenadas van en `event`.
    const onMove = ({event: e, preventSigmaDefault}) => {
      const node = draggingRef.current;
      if (!node || !e) return;
      if (!justDraggedRef.current) {
        justDraggedRef.current = true;
        container.style.cursor = 'grabbing';
        handlers.current.onHover(node);
        reheat(0);
      }
      const pos = sigma.viewportToGraph(e);
      dragRef.current = {node, x: pos.x, y: pos.y};
      graph.mergeNodeAttributes(node, {x: pos.x, y: pos.y});
      preventSigmaDefault();
      e.original?.preventDefault();
      e.original?.stopPropagation();
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      const wasDragging = justDraggedRef.current;
      draggingRef.current = null;
      dragRef.current = null;
      container.style.cursor = '';
      if (wasDragging) {
        handlers.current.onHover(null);
        reheat(1600);
        // El clic que sigue al soltar no debe seleccionar.
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 0);
      }
    };
    const onClickNode = ({node}) => {
      if (justDraggedRef.current) return;
      handlers.current.onSelect(node);
    };
    const onDoubleClickNode = (e) => {
      e.preventSigmaDefault();
      handlers.current.onOpen(e.node);
    };
    const onClickStage = () => {
      if (!justDraggedRef.current) handlers.current.onSelect(null);
    };

    sigma.on('enterNode', onEnter);
    sigma.on('leaveNode', onLeave);
    sigma.on('downNode', onDown);
    sigma.on('moveBody', onMove);
    sigma.on('upNode', onUp);
    sigma.on('upStage', onUp);
    sigma.on('clickNode', onClickNode);
    sigma.on('doubleClickNode', onDoubleClickNode);
    sigma.on('clickStage', onClickStage);
    window.addEventListener('mouseup', onUp);
    return () => {
      sigma.off('enterNode', onEnter);
      sigma.off('leaveNode', onLeave);
      sigma.off('downNode', onDown);
      sigma.off('moveBody', onMove);
      sigma.off('upNode', onUp);
      sigma.off('upStage', onUp);
      sigma.off('clickNode', onClickNode);
      sigma.off('doubleClickNode', onDoubleClickNode);
      sigma.off('clickStage', onClickStage);
      window.removeEventListener('mouseup', onUp);
    };
  }, [sigma, graph, layout.dragRef, layout.reheat]);

  /*
   * Encuadre: mientras la simulación se asienta, sigma reencuadra solo.
   * Al detenerse se fija el encuadre para que la cámara no "respire".
   */
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !layout.running && !draggingRef.current) {
      frameVisibleRef.current();
    }
    wasRunning.current = layout.running;
  }, [layout.running, sigma]);

  const firstForces = useRef(true);
  useEffect(() => {
    if (firstForces.current) {
      firstForces.current = false;
      return;
    }
    sigma.setCustomBBox(null);
  }, [forcesKey, sigma]);

  /* Centrar en un nodo pedido desde fuera (buscador, lista de conexiones, URL). */
  useEffect(() => {
    if (!focusRequest?.id) return;
    const id = requestAnimationFrame(() => {
      const d = sigma.getNodeDisplayData(focusRequest.id);
      if (!d) return;
      const cam = sigma.getCamera();
      cam.animate(
        {x: d.x, y: d.y, ratio: Math.min(cam.getState().ratio, 0.55)},
        {duration: 500, easing: 'cubicInOut'},
      );
    });
    return () => cancelAnimationFrame(id);
  }, [focusRequest, sigma]);

  /* Encajar la vista en los nodos visibles (vista local, filtros, "Centrar"). */
  useEffect(() => {
    if (!fitRequest) return;
    const id = requestAnimationFrame(() => {
      if (fitRequest.reset) {
        frameVisibleRef.current();
        sigma.getCamera().animatedReset({duration: 450});
        return;
      }
      fitCameraToNodes(sigma, visibleNodes);
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest, sigma]);

  return null;
}
