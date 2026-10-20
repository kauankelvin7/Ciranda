import React from 'react';
import { Viewport } from '../types/canvas';

interface ToolbarProps {
  isNative: boolean;
  viewport: Viewport;
  selectedNodeIds: string[];
  hasPendingSave: boolean;
  onAddTerminal: () => void;
  onCreateGroup: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onSaveLayout: () => void;
  onOpenShortcuts: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  isNative,
  viewport,
  selectedNodeIds,
  hasPendingSave,
  onAddTerminal,
  onCreateGroup,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onSaveLayout,
  onOpenShortcuts,
}) => {
  return (
    <header className="ciranda-toolbar" role="toolbar" aria-label="Ferramentas do Canvas">
      <div className="toolbar-brand">
        <span className="brand-title">CIRANDA</span>
        <span className="brand-mode" title="Modo Profissional Padrão">PROFISSIONAL</span>
      </div>

      <div className="toolbar-status">
        {isNative ? (
          <span className="status-badge native" title="Conectado ao núcleo Rust via Tauri IPC">
            <span className="indicator-dot online" aria-hidden="true" />
            Tauri v2 · PTY Ativo
          </span>
        ) : (
          <span className="status-badge web" title="Executando no navegador web sem PTY nativo">
            <span className="indicator-dot offline" aria-hidden="true" />
            Preview Web (Sem PTY)
          </span>
        )}
      </div>

      <div className="toolbar-actions">
        <button
          type="button"
          className="toolbar-btn primary"
          onClick={onAddTerminal}
          title="Criar novo terminal (Atalho: Alt+N)"
          aria-label="Criar novo terminal"
        >
          <span className="btn-icon" aria-hidden="true">+</span>
          Novo Terminal
        </button>

        <button
          type="button"
          className="toolbar-btn"
          onClick={onCreateGroup}
          disabled={selectedNodeIds.length === 0}
          title={selectedNodeIds.length === 0 ? "Selecione ao menos um nó para agrupar" : "Agrupar nós selecionados"}
          aria-label="Criar grupo com nós selecionados"
        >
          Agrupar ({selectedNodeIds.length})
        </button>

        <div className="toolbar-divider" aria-hidden="true" />

        <div className="zoom-controls" role="group" aria-label="Controles de zoom">
          <button
            type="button"
            className="toolbar-btn icon-only"
            onClick={onZoomOut}
            title="Reduzir zoom (Atalho: Ctrl+-)"
            aria-label="Reduzir zoom"
          >
            -
          </button>
          <button
            type="button"
            className="toolbar-btn zoom-level"
            onClick={onResetZoom}
            title="Redefinir zoom para 100% (Atalho: Ctrl+0)"
            aria-label={`Zoom atual ${Math.round(viewport.zoom * 100)}%. Clique para resetar para 100%`}
          >
            {Math.round(viewport.zoom * 100)}%
          </button>
          <button
            type="button"
            className="toolbar-btn icon-only"
            onClick={onZoomIn}
            title="Aumentar zoom (Atalho: Ctrl++)"
            aria-label="Aumentar zoom"
          >
            +
          </button>
        </div>

        <div className="toolbar-divider" aria-hidden="true" />

        <button
          type="button"
          className={`toolbar-btn ${hasPendingSave ? 'highlight' : ''}`}
          onClick={onSaveLayout}
          title="Salvar layout v1 no SQLite (Atalho: Ctrl+S)"
          aria-label="Salvar layout"
        >
          {hasPendingSave ? '● Salvar Layout' : 'Layout Salvo'}
        </button>

        <button
          type="button"
          className="toolbar-btn help-btn"
          onClick={onOpenShortcuts}
          title="Visualizar atalhos de teclado (Atalho: ?)"
          aria-label="Ajuda e atalhos de teclado"
        >
          ?
        </button>
      </div>
    </header>
  );
};
