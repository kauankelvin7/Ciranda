import React from 'react';
import { CanvasEdge, CanvasNode } from '../types/canvas';

interface ContextInspectorProps {
  selectedNode: CanvasNode | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  onRemoveEdge: (edgeId: string) => void;
  onClose: () => void;
}

export const ContextInspector: React.FC<ContextInspectorProps> = ({
  selectedNode,
  nodes,
  edges,
  onRemoveEdge,
  onClose,
}) => {
  if (!selectedNode) return null;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Conexões onde o nó selecionado é o DESTINO (recebe contexto de referência)
  const incomingEdges = edges.filter(
    (e) => e.target === selectedNode.id && e.type === 'context_reference'
  );

  // Conexões onde o nó selecionado é a ORIGEM (oferece seu contexto para outro)
  const outgoingEdges = edges.filter(
    (e) => e.source === selectedNode.id && e.type === 'context_reference'
  );

  return (
    <aside
      className="ciranda-context-inspector"
      role="complementary"
      aria-label={`Inspetor de contexto para ${selectedNode.title}`}
    >
      <header className="inspector-header">
        <div className="inspector-title-area">
          <span className="inspector-badge">INSPEÇÃO DE CONTEXTO</span>
          <h3 className="inspector-node-title">{selectedNode.title}</h3>
        </div>
        <button
          type="button"
          className="inspector-close-btn"
          onClick={onClose}
          title="Fechar inspetor"
          aria-label="Fechar inspetor"
        >
          ×
        </button>
      </header>

      <div className="inspector-policy-notice" role="note">
        <strong>Política de Governança (DA-001):</strong>
        <p>
          Conexões <code>context_reference</code> servem para associar referências de contexto para inspeção explícita.
          Não executam comandos, não injetam prompts nem acionam gatilhos automaticamente.
        </p>
      </div>

      <div className="inspector-section">
        <h4>Contextos Referenciados (Entrada)</h4>
        {incomingEdges.length === 0 ? (
          <p className="inspector-empty">Nenhum nó associado como referência de contexto para este terminal.</p>
        ) : (
          <ul className="inspector-edge-list">
            {incomingEdges.map((edge) => {
              const src = nodeMap.get(edge.source);
              return (
                <li key={edge.id} className="inspector-edge-item">
                  <div className="edge-info">
                    <span className="edge-name">{src ? src.title : edge.source}</span>
                    <span className="edge-type">tipo: context_reference</span>
                  </div>
                  <button
                    type="button"
                    className="edge-unlink-btn"
                    onClick={() => onRemoveEdge(edge.id)}
                    title="Remover referência"
                    aria-label={`Desconectar ${src?.title ?? edge.source}`}
                  >
                    Desconectar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="inspector-section">
        <h4>Referenciado Por (Saída)</h4>
        {outgoingEdges.length === 0 ? (
          <p className="inspector-empty">Este terminal não está referenciado por outros nós.</p>
        ) : (
          <ul className="inspector-edge-list">
            {outgoingEdges.map((edge) => {
              const tgt = nodeMap.get(edge.target);
              return (
                <li key={edge.id} className="inspector-edge-item">
                  <div className="edge-info">
                    <span className="edge-name">{tgt ? tgt.title : edge.target}</span>
                    <span className="edge-type">tipo: context_reference</span>
                  </div>
                  <button
                    type="button"
                    className="edge-unlink-btn"
                    onClick={() => onRemoveEdge(edge.id)}
                    title="Remover referência"
                    aria-label={`Desconectar de ${tgt?.title ?? edge.target}`}
                  >
                    Desconectar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
};
