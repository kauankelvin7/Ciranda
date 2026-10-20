import React, { useState } from 'react';
import { CanvasGroup, CanvasNode } from '../types/canvas';

interface GroupLayerProps {
  groups: CanvasGroup[];
  nodes: CanvasNode[];
  onRemoveGroup: (groupId: string) => void;
  onRenameGroup?: (groupId: string, newTitle: string) => void;
}

export const GroupLayer: React.FC<GroupLayerProps> = ({
  groups,
  nodes,
  onRemoveGroup,
}) => {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  return (
    <div className="ciranda-group-layer" aria-label="Camada de agrupamentos">
      {groups.map((group) => {
        const memberNodes = group.nodeIds
          .map((id) => nodeMap.get(id))
          .filter((n): n is CanvasNode => Boolean(n));

        if (memberNodes.length === 0) return null;

        const padding = 20;
        const minX = Math.min(...memberNodes.map((n) => n.x)) - padding;
        const minY = Math.min(...memberNodes.map((n) => n.y)) - padding - 36;
        const maxX = Math.max(...memberNodes.map((n) => n.x + n.width)) + padding;
        const maxY = Math.max(...memberNodes.map((n) => n.y + n.height)) + padding;

        const width = maxX - minX;
        const height = maxY - minY;

        return (
          <section
            key={group.id}
            className="canvas-group-card"
            style={{
              transform: `translate(${minX}px, ${minY}px)`,
              width: `${width}px`,
              height: `${height}px`,
            }}
            aria-labelledby={`group-title-${group.id}`}
          >
            <header className="group-header">
              {editingGroupId === group.id ? (
                <input
                  type="text"
                  className="group-title-input"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => {
                    if (editingTitle.trim()) {
                      group.title = editingTitle.trim();
                    }
                    setEditingGroupId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (editingTitle.trim()) group.title = editingTitle.trim();
                      setEditingGroupId(null);
                    } else if (e.key === 'Escape') {
                      setEditingGroupId(null);
                    }
                  }}
                  autoFocus
                />
              ) : (
                <h3
                  id={`group-title-${group.id}`}
                  className="group-title"
                  onDoubleClick={() => {
                    setEditingGroupId(group.id);
                    setEditingTitle(group.title);
                  }}
                  title="Duplo clique para renomear"
                >
                  {group.title}
                </h3>
              )}

              <div className="group-controls">
                <span className="group-count">{memberNodes.length} {memberNodes.length === 1 ? 'nó' : 'nós'}</span>
                <button
                  type="button"
                  className="group-btn"
                  onClick={() => onRemoveGroup(group.id)}
                  title="Desagrupar nós"
                  aria-label={`Desagrupar ${group.title}`}
                >
                  Desagrupar
                </button>
              </div>
            </header>
          </section>
        );
      })}
    </div>
  );
};
