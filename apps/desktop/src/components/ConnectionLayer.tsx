import React from 'react';
import { CanvasEdge, CanvasNode } from '../types/canvas';

interface ConnectionLayerProps {
  edges: CanvasEdge[];
  nodes: CanvasNode[];
  connectingSourceId: string | null;
  cursorPos: { x: number; y: number } | null;
  selectedEdgeId: string | null;
  onSelectEdge: (id: string | null) => void;
  onRemoveEdge: (id: string) => void;
}

export const ConnectionLayer: React.FC<ConnectionLayerProps> = ({
  edges,
  nodes,
  connectingSourceId,
  cursorPos,
  selectedEdgeId,
  onSelectEdge,
  onRemoveEdge,
}) => {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Calcula ponto central de conexão na borda direita do source e borda esquerda do target
  function getPortCoords(sourceNode: CanvasNode, targetNode: CanvasNode) {
    const isSourceToLeft = sourceNode.x + sourceNode.width / 2 <= targetNode.x + targetNode.width / 2;

    const startX = isSourceToLeft ? sourceNode.x + sourceNode.width : sourceNode.x;
    const startY = sourceNode.y + sourceNode.height / 2;

    const endX = isSourceToLeft ? targetNode.x : targetNode.x + targetNode.width;
    const endY = targetNode.y + targetNode.height / 2;

    return { startX, startY, endX, endY };
  }

  function createBezierPath(sx: number, sy: number, ex: number, ey: number): string {
    const dx = Math.abs(ex - sx) * 0.5;
    const offset = Math.max(40, dx);
    const cp1x = sx + (ex >= sx ? offset : -offset);
    const cp1y = sy;
    const cp2x = ex + (ex >= sx ? -offset : offset);
    const cp2y = ey;

    return `M ${sx} ${sy} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${ex} ${ey}`;
  }

  return (
    <svg className="ciranda-connection-layer" aria-label="Camada de conexões context_reference">
      <defs>
        <marker
          id="arrowhead-context"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#3b82f6" />
        </marker>
        <marker
          id="arrowhead-selected"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#60a5fa" />
        </marker>
      </defs>

      {/* Arestas existentes */}
      {edges.map((edge) => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);

        if (!sourceNode || !targetNode) return null;

        const { startX, startY, endX, endY } = getPortCoords(sourceNode, targetNode);
        const pathData = createBezierPath(startX, startY, endX, endY);
        const isSelected = selectedEdgeId === edge.id;

        // Ponto médio para o marcador de exclusão e rótulo
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        return (
          <g key={edge.id} className={`edge-group ${isSelected ? 'selected' : ''}`}>
            {/* Linha de clique larga invisível para facilitar seleção */}
            <path
              d={pathData}
              className="edge-hitbox"
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge(isSelected ? null : edge.id);
              }}
            />
            {/* Linha visível */}
            <path
              d={pathData}
              className={`edge-line ${isSelected ? 'selected' : ''}`}
              markerEnd={isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead-context)'}
            />
            {/* Rótulo de contexto e ação de exclusão */}
            <foreignObject
              x={midX - 70}
              y={midY - 14}
              width={140}
              height={28}
              className="edge-foreign-obj"
            >
              <div className={`edge-badge ${isSelected ? 'active' : ''}`}>
                <span className="edge-type-label" title="Referência de contexto">ref_ctx</span>
                <button
                  type="button"
                  className="edge-remove-btn"
                  title="Desconectar referência de contexto"
                  aria-label={`Remover conexão entre ${sourceNode.title} e ${targetNode.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveEdge(edge.id);
                  }}
                >
                  ×
                </button>
              </div>
            </foreignObject>
          </g>
        );
      })}

      {/* Linha interativa durante processo de conexão */}
      {connectingSourceId && cursorPos && (() => {
        const sourceNode = nodeMap.get(connectingSourceId);
        if (!sourceNode) return null;
        const startX = sourceNode.x + sourceNode.width;
        const startY = sourceNode.y + sourceNode.height / 2;
        const pathData = createBezierPath(startX, startY, cursorPos.x, cursorPos.y);

        return (
          <path
            d={pathData}
            className="edge-preview-line"
            markerEnd="url(#arrowhead-context)"
          />
        );
      })()}
    </svg>
  );
};
