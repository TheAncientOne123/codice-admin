// Copia de authorsite2/src/components/CrSaSoGraph (vista previa del grafo en el admin).
/**
 * Utilidades de render para el grafo CrSaSo (sigma 3).
 * Estilo inspirado en la vista de grafo de Obsidian: etiquetas bajo el nodo,
 * halo del color de fondo y atenuación del resto al enfocar.
 */
import {createNodeBorderProgram} from '@sigma/node-border';
import EdgeCurveProgram from '@sigma/edge-curve';
import {EdgeRectangleProgram} from 'sigma/rendering';

/** Paletas por tema. Se actualiza en caliente desde el componente (ver `setGraphTheme`). */
export const GRAPH_THEMES = {
  dark: {
    background: '#1b1b1d',
    label: '#e7e5e4',
    labelHalo: 'rgba(27, 27, 29, 0.92)',
    hoverBg: '#2a2a2d',
    hoverBorder: 'rgba(234, 185, 61, 0.55)',
    edge: 'rgba(255, 255, 255, 0.13)',
    edgeDim: 'rgba(255, 255, 255, 0.035)',
    edgeFocus: 'rgba(234, 185, 61, 0.8)',
    nodeDim: '#36363a',
    accent: '#eab93d',
  },
  light: {
    background: '#f6f6f4',
    label: '#1c1917',
    labelHalo: 'rgba(246, 246, 244, 0.95)',
    hoverBg: '#ffffff',
    hoverBorder: 'rgba(196, 159, 63, 0.7)',
    edge: 'rgba(28, 25, 23, 0.3)',
    edgeDim: 'rgba(28, 25, 23, 0.05)',
    edgeFocus: 'rgba(181, 138, 31, 0.85)',
    nodeDim: '#d9d7d3',
    accent: '#b58a1f',
  },
};

let theme = GRAPH_THEMES.dark;

export function setGraphTheme(mode) {
  theme = GRAPH_THEMES[mode] ?? GRAPH_THEMES.dark;
  return theme;
}

export function getGraphTheme() {
  return theme;
}

/** Paleta para "grupos" (comunidades Louvain). */
export const COMMUNITY_PALETTE = [
  '#38bdf8',
  '#f472b6',
  '#fbbf24',
  '#a78bfa',
  '#34d399',
  '#fb7185',
  '#60a5fa',
  '#f59e0b',
  '#2dd4bf',
  '#c084fc',
  '#a3e635',
  '#e879f9',
];

/** Radio base en px de pantalla según grado. */
export function baseNodeSize(degree) {
  const d = Math.max(0, Number(degree) || 0);
  return Math.min(18, 3.2 + Math.sqrt(d) * 1.55);
}

/** Etiqueta centrada bajo el nodo, con halo para legibilidad sobre las aristas. */
export function drawLabelBelow(context, data, settings) {
  if (!data.label) return;
  const size = data.labelSize ?? settings.labelSize;
  const weight = data.labelWeight ?? settings.labelWeight;
  context.font = `${weight} ${size}px ${settings.labelFont}`;
  const width = context.measureText(data.label).width;
  const x = data.x - width / 2;
  const y = data.y + data.size + size + 1;
  context.lineJoin = 'round';
  context.lineWidth = 3.5;
  context.strokeStyle = theme.labelHalo;
  context.strokeText(data.label, x, y);
  context.fillStyle = data.labelColor ?? theme.label;
  context.fillText(data.label, x, y);
}

/** Hover: aro dorado + píldora con el nombre bajo el nodo. */
export function drawHoverPill(context, data, settings) {
  const size = settings.labelSize + 1;
  context.font = `600 ${size}px ${settings.labelFont}`;

  context.beginPath();
  context.arc(data.x, data.y, data.size + 3.5, 0, Math.PI * 2);
  context.closePath();
  context.lineWidth = 2;
  context.strokeStyle = theme.accent;
  context.stroke();

  if (!data.label) return;
  const padX = 7;
  const h = size + 9;
  const w = context.measureText(data.label).width + padX * 2;
  const x = data.x - w / 2;
  const y = data.y + data.size + 6;
  const r = h / 2;

  context.shadowColor = 'rgba(0, 0, 0, 0.35)';
  context.shadowBlur = 10;
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
  context.fillStyle = theme.hoverBg;
  context.fill();
  context.shadowBlur = 0;
  context.lineWidth = 1;
  context.strokeStyle = theme.hoverBorder;
  context.stroke();

  context.fillStyle = theme.label;
  context.fillText(data.label, x + padX, y + h / 2 + size / 3);
}

const NodeBorderProgram = createNodeBorderProgram({
  borders: [
    {size: {attribute: 'borderSize', defaultValue: 0}, color: {attribute: 'borderColor', defaultValue: '#eab93d'}},
    {size: {fill: true}, color: {attribute: 'color'}},
  ],
});

/**
 * Ajustes estáticos de sigma. No deben cambiar entre renders: SigmaContainer
 * recrea la instancia si cambian. Lo dinámico va por `sigma.setSetting`.
 */
export const BASE_SIGMA_SETTINGS = {
  allowInvalidContainer: true,
  renderLabels: true,
  renderEdgeLabels: false,
  itemSizesReference: 'screen',
  zIndex: true,
  labelFont: 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, "Noto Sans", sans-serif',
  labelSize: 12,
  labelWeight: '500',
  labelDensity: 0.9,
  labelGridCellSize: 70,
  labelRenderedSizeThreshold: 9,
  defaultDrawNodeLabel: drawLabelBelow,
  defaultDrawNodeHover: drawHoverPill,
  defaultNodeType: 'border',
  nodeProgramClasses: {border: NodeBorderProgram},
  defaultEdgeType: 'curved',
  edgeProgramClasses: {curved: EdgeCurveProgram, line: EdgeRectangleProgram},
  minEdgeThickness: 0.6,
  minCameraRatio: 0.05,
  maxCameraRatio: 3,
  stagePadding: 40,
};
