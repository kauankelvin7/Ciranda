import React, { useEffect, useRef } from 'react';

export interface ContextMenuState {
  x: number;
  y: number;
  nodeId?: string;
}

interface ContextMenuProps {
  menu: ContextMenuState | null;
  onClose: () => void;
  onAddTerminal: (canvasX: number, canvasY: number) => void;
  onResetZoom: () => void;
  onSaveLayout: () => void;
  nodeTitle?: string;
  onDeleteNode?: (nodeId: string) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  menu,
  onClose,
  onAddTerminal,
  onResetZoom,
  onSaveLayout,
  nodeTitle,
  onDeleteNode,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    if (menu) {
      window.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  return (
    <div
      ref={menuRef}
      className="ciranda-context-menu"
      style={{ left: `${menu.x}px`, top: `${menu.y}px` }}
      role="menu"
      aria-label="Menu de contexto do canvas"
    >
      {menu.nodeId ? (
        <>
          <div className="menu-header" role="presentation">
            Nó: {nodeTitle ?? menu.nodeId}
          </div>
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => {
              if (onDeleteNode && menu.nodeId) onDeleteNode(menu.nodeId);
              onClose();
            }}
          >
            Excluir Nó
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => {
              onAddTerminal(menu.x, menu.y);
              onClose();
            }}
          >
            Novo Terminal Aqui
          </button>
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => {
              onResetZoom();
              onClose();
            }}
          >
            Redefinir Zoom (100%)
          </button>
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => {
              onSaveLayout();
              onClose();
            }}
          >
            Salvar Layout
          </button>
        </>
      )}
    </div>
  );
};
