import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LayoutV1 } from '../types/canvas';
import {
  createInitialLayout,
  addNode,
  updateNodePosition,
  updateNodeDimensions,
  updateNodeTitle,
  setNodeSession,
  removeNode,
  addEdge,
  removeEdge,
  createGroup,
  removeGroup,
  updateViewport,
} from '../services/canvasModel';
import { parseAndValidateLayout } from '../services/layoutValidator';
import { isInteractiveKeyboardTarget, isXtermWheelTarget } from '../services/keyboardUtils';
import { createBackendClient, TauriBackendClient, WebPreviewBackendClient } from '../services/ipc';
import { Toolbar } from './Toolbar';
import { NodeTerminal } from './NodeTerminal';
import { ConnectionLayer } from './ConnectionLayer';
import { GroupLayer } from './GroupLayer';
import { ContextInspector } from './ContextInspector';
import { ContextMenu, ContextMenuState } from './ContextMenu';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';

export const Canvas: React.FC = () => {
  const backendRef = useRef<TauriBackendClient | WebPreviewBackendClient>(createBackendClient());
  const backend = backendRef.current;

  const [layout, setLayout] = useState<LayoutV1>(createInitialLayout());
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [hasPendingSave, setHasPendingSave] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ mouseX: number; mouseY: number; vpX: number; vpY: number }>({
    mouseX: 0,
    mouseY: 0,
    vpX: 0,
    vpY: 0,
  });

  const announce = useCallback((msg: string) => {
    setAnnouncement(msg);
  }, []);

  // Carga inicial do layout a partir do backend (SQLite no Tauri, localStorage no preview)
  useEffect(() => {
    async function loadInitialLayout() {
      try {
        const rawJson = await backend.loadWorkspaceLayout();
        if (rawJson) {
          const result = parseAndValidateLayout(rawJson);
          if (result.valid) {
            setLayout(result.layout);
            announce('Layout anterior restaurado com sucesso.');
            return;
          } else {
            console.warn('Layout persistido rejeitado pela validação:', result.error);
            setErrorMessage(`Layout recuperado inválido: ${result.error}. Usando novo layout.`);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar layout:', err);
      }

      // Se não havia layout válido, inicializa com 1 terminal padrão
      const init = createInitialLayout();
      const withFirstNode = addNode(init, {
        title: 'Terminal 1',
        x: 120,
        y: 100,
        width: 560,
        height: 380,
      });
      setLayout(withFirstNode.layout);
    }

    loadInitialLayout();
  }, [backend, announce]);

  // Salvar layout
  const handleSaveLayout = useCallback(async () => {
    try {
      const json = JSON.stringify(layout, null, 2);
      await backend.saveWorkspaceLayout(json);
      setHasPendingSave(false);
      announce('Layout salvo.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Erro ao salvar layout: ${msg}`);
      announce('Falha ao salvar layout.');
    }
  }, [backend, layout, announce]);

  // Manipulação de nós
  const handleAddTerminal = useCallback(
    (customX?: number, customY?: number) => {
      const vp = layout.viewport;
      // Posiciona no centro visível se não especificado
      const targetX = customX !== undefined ? (customX - vp.x) / vp.zoom : (-vp.x + 200) / vp.zoom;
      const targetY = customY !== undefined ? (customY - vp.y) / vp.zoom : (-vp.y + 120) / vp.zoom;

      const { layout: nextLayout, node } = addNode(layout, {
        x: targetX,
        y: targetY,
      });

      setLayout(nextLayout);
      setSelectedNodeIds([node.id]);
      setHasPendingSave(true);
      announce(`Novo nó ${node.title} adicionado.`);
    },
    [layout, announce]
  );

  const handleMoveNode = useCallback((id: string, x: number, y: number) => {
    setLayout((prev) => updateNodePosition(prev, id, x, y));
    setHasPendingSave(true);
  }, []);

  const handleResizeNode = useCallback((id: string, width: number, height: number) => {
    setLayout((prev) => updateNodeDimensions(prev, id, width, height));
    setHasPendingSave(true);
  }, []);

  const handleUpdateTitle = useCallback(
    (id: string, title: string) => {
      setLayout((prev) => updateNodeTitle(prev, id, title));
      setHasPendingSave(true);
      announce(`Título atualizado para ${title}`);
    },
    [announce]
  );

  const handleAssociateSession = useCallback((id: string, sessionId?: string) => {
    setLayout((prev) => setNodeSession(prev, id, sessionId));
    setHasPendingSave(true);
  }, []);

  const handleRemoveNode = useCallback(
    async (id: string, closeSession: boolean) => {
      const nodeToRemove = layout.nodes.find((n) => n.id === id);
      if (closeSession && nodeToRemove?.sessionId && backend.isNative) {
        try {
          await backend.closeSession(nodeToRemove.sessionId);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setErrorMessage(`Falha ao encerrar sessão PTY (${nodeToRemove.sessionId}): ${msg}. Nó mantido para evitar processo descontrolado.`);
          announce('Erro: nó mantido pois o encerramento da sessão falhou.');
          return;
        }
      }

      setLayout((prev) => removeNode(prev, id));
      setSelectedNodeIds((prev) => prev.filter((nodeId) => nodeId !== id));
      setHasPendingSave(true);
      announce(`Nó ${nodeToRemove?.title ?? id} removido.`);
    },
    [layout.nodes, backend, announce]
  );

  // Conexões context_reference
  const handleStartConnection = useCallback(
    (sourceId: string) => {
      setConnectingSourceId(sourceId);
      announce(`Iniciando conexão de referência a partir de ${sourceId}. Selecione o nó de destino.`);
    },
    [announce]
  );

  const handleCompleteConnection = useCallback(
    (targetId: string) => {
      if (!connectingSourceId) return;

      const result = addEdge(layout, connectingSourceId, targetId);
      if (result.success) {
        setLayout(result.layout);
        setHasPendingSave(true);
        announce(`Referência de contexto conectada com sucesso.`);
      } else {
        setErrorMessage(result.error);
        announce(`Falha ao conectar: ${result.error}`);
      }
      setConnectingSourceId(null);
      setCursorPos(null);
    },
    [connectingSourceId, layout, announce]
  );

  const handleRemoveEdge = useCallback(
    (edgeId: string) => {
      setLayout((prev) => removeEdge(prev, edgeId));
      setSelectedEdgeId(null);
      setHasPendingSave(true);
      announce('Conexão de referência de contexto removida.');
    },
    [announce]
  );

  // Agrupamentos
  const handleCreateGroup = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const title = `Grupo ${layout.groups.length + 1}`;
    const result = createGroup(layout, title, selectedNodeIds);
    if (result.success) {
      setLayout(result.layout);
      setHasPendingSave(true);
      announce(`Grupo "${title}" criado com ${selectedNodeIds.length} nós.`);
    } else {
      setErrorMessage(result.error);
    }
  }, [layout, selectedNodeIds, announce]);

  const handleRemoveGroup = useCallback(
    (groupId: string) => {
      setLayout((prev) => removeGroup(prev, groupId));
      setHasPendingSave(true);
      announce('Grupo removido.');
    },
    [announce]
  );

  // Zoom controls
  const handleZoom = useCallback(
    (delta: number) => {
      setLayout((prev) => updateViewport(prev, { zoom: prev.viewport.zoom + delta }));
      setHasPendingSave(true);
    },
    []
  );

  const handleResetZoom = useCallback(() => {
    setLayout((prev) => updateViewport(prev, { zoom: 1 }));
    setHasPendingSave(true);
    announce('Zoom redefinido para 100%.');
  }, [announce]);

  // Pan do Canvas por mouse drag no fundo
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      // Se clicou no fundo do canvas
      const target = e.target as HTMLElement;
      if (
        target.classList.contains('canvas-viewport') ||
        target.classList.contains('ciranda-canvas') ||
        target.tagName.toLowerCase() === 'svg'
      ) {
        isPanningRef.current = true;
        panStartRef.current = {
          mouseX: e.clientX,
          mouseY: e.clientY,
          vpX: layout.viewport.x,
          vpY: layout.viewport.y,
        };
        // Limpa seleção se não segurou Shift
        if (!e.shiftKey) {
          setSelectedNodeIds([]);
          setSelectedEdgeId(null);
        }
        if (connectingSourceId) {
          setConnectingSourceId(null);
          setCursorPos(null);
        }
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.mouseX;
      const dy = e.clientY - panStartRef.current.mouseY;
      setLayout((prev) =>
        updateViewport(prev, {
          x: panStartRef.current.vpX + dx,
          y: panStartRef.current.vpY + dy,
        })
      );
    }

    if (connectingSourceId) {
      const vp = layout.viewport;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseCanvasX = (e.clientX - rect.left - vp.x) / vp.zoom;
        const mouseCanvasY = (e.clientY - rect.top - vp.y) / vp.zoom;
        setCursorPos({ x: mouseCanvasX, y: mouseCanvasY });
      }
    }
  };

  const handleCanvasMouseUp = () => {
    isPanningRef.current = false;
  };

  // Zoom via roda do mouse (wheel)
  const handleCanvasWheel = (e: React.WheelEvent) => {
    // Preserva o scroll do histórico interno do terminal xterm
    if (isXtermWheelTarget(e.target)) {
      return;
    }

    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const currentZoom = layout.viewport.zoom;
    const nextZoom = Math.max(0.2, Math.min(3.0, currentZoom * zoomFactor));

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const newX = cursorX - ((cursorX - layout.viewport.x) / currentZoom) * nextZoom;
    const newY = cursorY - ((cursorY - layout.viewport.y) / currentZoom) * nextZoom;

    setLayout((prev) =>
      updateViewport(prev, {
        x: newX,
        y: newY,
        zoom: nextZoom,
      })
    );
    setHasPendingSave(true);
  };

  // Context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Atalhos de teclado globais
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignora atalhos globais se o foco estiver no terminal xterm, input, textarea ou select
      if (isInteractiveKeyboardTarget(e.target)) return;

      if (e.key === '?' && !isShortcutsOpen) {
        e.preventDefault();
        setIsShortcutsOpen(true);
      } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        handleAddTerminal();
      } else if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSaveLayout();
      } else if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleZoom(0.1);
      } else if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        handleZoom(-0.1);
      } else if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      } else if (e.key === 'Escape') {
        if (connectingSourceId) {
          setConnectingSourceId(null);
          setCursorPos(null);
          announce('Conexão cancelada.');
        }
        if (selectedNodeIds.length > 0) {
          setSelectedNodeIds([]);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isShortcutsOpen,
    handleAddTerminal,
    handleSaveLayout,
    handleZoom,
    handleResetZoom,
    connectingSourceId,
    selectedNodeIds.length,
    announce,
  ]);

  const selectedNode =
    selectedNodeIds.length === 1
      ? layout.nodes.find((n) => n.id === selectedNodeIds[0]) ?? null
      : null;

  return (
    <div
      ref={canvasRef}
      className="ciranda-canvas"
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onWheel={handleCanvasWheel}
      onContextMenu={handleContextMenu}
      role="application"
      aria-label="Canvas Profissional CIRANDA"
    >
      {/* Barra de Ferramentas Superior */}
      <Toolbar
        isNative={backend.isNative}
        viewport={layout.viewport}
        selectedNodeIds={selectedNodeIds}
        hasPendingSave={hasPendingSave}
        onAddTerminal={() => handleAddTerminal()}
        onCreateGroup={handleCreateGroup}
        onZoomIn={() => handleZoom(0.1)}
        onZoomOut={() => handleZoom(-0.1)}
        onResetZoom={handleResetZoom}
        onSaveLayout={handleSaveLayout}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* Banner de erro geral caso haja */}
      {errorMessage && (
        <div className="canvas-error-alert" role="alert">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} aria-label="Fechar erro">
            ×
          </button>
        </div>
      )}

      {/* Região Acessível ARIA-Live para leitores de tela */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Viewport Transformado (Pan e Zoom) */}
      <div
        className="canvas-viewport"
        style={{
          transform: `translate(${layout.viewport.x}px, ${layout.viewport.y}px) scale(${layout.viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Camada de Grupos */}
        <GroupLayer
          groups={layout.groups}
          nodes={layout.nodes}
          onRemoveGroup={handleRemoveGroup}
        />

        {/* Camada de Conexões context_reference */}
        <ConnectionLayer
          edges={layout.edges}
          nodes={layout.nodes}
          connectingSourceId={connectingSourceId}
          cursorPos={cursorPos}
          selectedEdgeId={selectedEdgeId}
          onSelectEdge={setSelectedEdgeId}
          onRemoveEdge={handleRemoveEdge}
        />

        {/* Camada de Nós (Terminais) */}
        {layout.nodes.map((node) => (
          <NodeTerminal
            key={node.id}
            node={node}
            backend={backend}
            isSelected={selectedNodeIds.includes(node.id)}
            isConnectingSource={connectingSourceId === node.id}
            zoom={layout.viewport.zoom}
            onSelect={(e) => {
              e.stopPropagation();
              if (e.shiftKey) {
                setSelectedNodeIds((prev) =>
                  prev.includes(node.id) ? prev.filter((id) => id !== node.id) : [...prev, node.id]
                );
              } else {
                setSelectedNodeIds([node.id]);
              }
            }}
            onMove={handleMoveNode}
            onResize={handleResizeNode}
            onUpdateTitle={handleUpdateTitle}
            onAssociateSession={handleAssociateSession}
            onStartConnection={handleStartConnection}
            onCompleteConnection={handleCompleteConnection}
            onRemoveNode={handleRemoveNode}
            onAnnounce={announce}
          />
        ))}
      </div>

      {/* Painel Lateral de Inspeção de Contexto */}
      {selectedNode && (
        <ContextInspector
          selectedNode={selectedNode}
          nodes={layout.nodes}
          edges={layout.edges}
          onRemoveEdge={handleRemoveEdge}
          onClose={() => setSelectedNodeIds([])}
        />
      )}

      {/* Menu de Contexto */}
      <ContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onAddTerminal={(cx, cy) => handleAddTerminal(cx, cy)}
        onResetZoom={handleResetZoom}
        onSaveLayout={handleSaveLayout}
        onDeleteNode={(nodeId) => handleRemoveNode(nodeId, false)}
      />

      {/* Modal de Atalhos de Teclado */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};
