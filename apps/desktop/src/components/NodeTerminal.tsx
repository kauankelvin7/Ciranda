import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { CanvasNode } from '../types/canvas';
import { SessionState } from '../types/session';
import { TauriBackendClient, WebPreviewBackendClient } from '../services/ipc';
import { isInteractiveKeyboardTarget } from '../services/keyboardUtils';

interface NodeTerminalProps {
  node: CanvasNode;
  backend: TauriBackendClient | WebPreviewBackendClient;
  isSelected: boolean;
  isConnectingSource: boolean;
  zoom: number;
  onSelect: (e: React.MouseEvent) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, width: number, height: number) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onAssociateSession: (id: string, sessionId?: string) => void;
  onStartConnection: (sourceId: string) => void;
  onCompleteConnection: (targetId: string) => void;
  onRemoveNode: (id: string, closeSession: boolean) => void;
  onAnnounce: (message: string) => void;
}

export const NodeTerminal: React.FC<NodeTerminalProps> = ({
  node,
  backend,
  isSelected,
  isConnectingSource,
  zoom,
  onSelect,
  onMove,
  onResize,
  onUpdateTitle,
  onAssociateSession,
  onStartConnection,
  onCompleteConnection,
  onRemoveNode,
  onAnnounce,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Sessões persistidas nunca assumem 'running' cegamente após reinício; iniciam como 'interrupted'
  const [sessionState, setSessionState] = useState<SessionState>('interrupted');
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(node.sessionId);
  const isCreatingSessionRef = useRef(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(node.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const lastSeqRef = useRef<number>(0);
  const pollingTimerRef = useRef<number | null>(null);

  // Consulta session_list ao montar para verificar se a sessão restaurada ainda existe viva no backend
  useEffect(() => {
    let isMounted = true;
    async function verifyRestoredSession() {
      if (!node.sessionId || !backend.isNative) {
        if (isMounted) setSessionState('interrupted');
        return;
      }
      try {
        const liveSessions = await backend.listSessions();
        if (!isMounted) return;
        const matched = liveSessions.find((s) => s.id === node.sessionId);
        if (matched && matched.state === 'running') {
          setSessionState('running');
          setActiveSessionId(matched.id);
        } else {
          setSessionState('interrupted');
        }
      } catch {
        if (isMounted) setSessionState('interrupted');
      }
    }
    verifyRestoredSession();
    return () => {
      isMounted = false;
    };
  }, [backend, node.sessionId]);

  // Refs mutáveis para que callbacks desacoplados leiam o estado atualizado sem recriar o terminal
  const activeSessionIdRef = useRef<string | undefined>(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  const sessionStateRef = useRef<SessionState>(sessionState);
  sessionStateRef.current = sessionState;

  // Inicializa o xterm
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        selectionBackground: '#388bfd33',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
      },
      fontSize: 13,
      fontFamily: 'Consolas, "Fira Code", monospace',
      cursorBlink: true,
      convertEol: true,
      disableStdin: !backend.isNative,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;

    if (!backend.isNative) {
      term.writeln('\x1b[33m[CIRANDA PREVIEW]\x1b[0m');
      term.writeln('Ambiente Web / Preview: PTY nativo indisponível no navegador.');
      term.writeln('Execute via desktop (Tauri) para conectar ao terminal Windows.');
    }

    // Listener de digitação do usuário lê de refs sempre atualizadas sem recriar o xterm
    const onDataDisposable = term.onData((data) => {
      const curSessionId = activeSessionIdRef.current;
      const curState = sessionStateRef.current;
      if (backend.isNative && curSessionId && curState === 'running') {
        backend.writeSession(curSessionId, data).catch((err) => {
          console.error('Falha ao enviar dados para a sessão:', err);
        });
      }
    });

    return () => {
      onDataDisposable.dispose();
      term.dispose();
      xtermInstance.current = null;
      fitAddonRef.current = null;
    };
  }, [backend.isNative]); // Monta uma vez e ajusta pelo lifecycle

  // Ajusta fit do xterm ao redimensionar nó
  useEffect(() => {
    if (fitAddonRef.current && xtermInstance.current) {
      try {
        fitAddonRef.current.fit();
        if (backend.isNative && activeSessionId && sessionState === 'running') {
          const cols = xtermInstance.current.cols;
          const rows = xtermInstance.current.rows;
          backend.resizeSession(activeSessionId, cols, rows).catch(() => {
            // Ignora erro transitório de resize
          });
        }
      } catch {
        // Ignora se o elemento estiver oculto
      }
    }
  }, [node.width, node.height, activeSessionId, backend, sessionState]);

  // Criação ou reconexão explícita da sessão PTY protegida contra cliques concorrentes via trava síncrona imediata
  const handleCreateOrReconnectSession = useCallback(async () => {
    if (!backend.isNative) {
      setErrorBanner('PTY real disponível somente no app desktop nativo.');
      return;
    }
    // Trava síncrona imediata em ref para garantir single-flight mesmo antes do próximo render do React
    if (isCreatingSessionRef.current) return;
    isCreatingSessionRef.current = true;
    setIsCreatingSession(true);
    setErrorBanner(null);
    try {
      const cols = xtermInstance.current?.cols ?? 80;
      const rows = xtermInstance.current?.rows ?? 24;
      const session = await backend.createSession(cols, rows);
      setActiveSessionId(session.id);
      onAssociateSession(node.id, session.id);
      setSessionState('running');
      lastSeqRef.current = 0;
      onAnnounce(`Sessão ${session.id} criada para o terminal ${node.title}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorBanner(`Falha ao criar sessão PTY: ${msg}`);
      setSessionState('failed');
    } finally {
      isCreatingSessionRef.current = false;
      setIsCreatingSession(false);
    }
  }, [backend, node.id, node.title, onAssociateSession, onAnnounce]);

  // Encerramento explícito da sessão
  const handleCloseSession = useCallback(async () => {
    if (backend.isNative && activeSessionId) {
      try {
        await backend.closeSession(activeSessionId);
        setSessionState('closed');
        onAnnounce(`Sessão ${activeSessionId} encerrada.`);
      } catch (err) {
        console.error('Erro ao encerrar sessão:', err);
      }
    }
  }, [backend, activeSessionId, onAnnounce]);

  // Polling de leitura da sessão PTY
  useEffect(() => {
    if (!backend.isNative || !activeSessionId || sessionState !== 'running') {
      if (pollingTimerRef.current !== null) {
        window.clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return;
    }

    let isMounted = true;

    async function poll() {
      if (!isMounted || !activeSessionId) return;
      try {
        const result = await backend.readSession(activeSessionId, lastSeqRef.current);
        if (!isMounted) return;

        const hasChunks = Boolean(result.chunks && result.chunks.length > 0);
        if (hasChunks) {
          for (const chunk of result.chunks) {
            if (chunk.seq > lastSeqRef.current) {
              lastSeqRef.current = chunk.seq;
            }
            if (xtermInstance.current && chunk.data.length > 0) {
              xtermInstance.current.write(new Uint8Array(chunk.data));
            }
          }
        }

        // Se o processo encerrou/fechou/falhou, continua drenando chunks pendentes até lote vazio
        if (result.state !== 'running') {
          if (hasChunks) {
            pollingTimerRef.current = window.setTimeout(poll, 25);
            return;
          }
          // Buffer totalmente drenado
          setSessionState(result.state);
          return;
        }
      } catch (err) {
        if (!isMounted) return;
        console.warn(`Erro no polling da sessão ${activeSessionId}:`, err);
        setSessionState('interrupted');
        return;
      }

      if (isMounted && sessionState === 'running') {
        pollingTimerRef.current = window.setTimeout(poll, 80);
      }
    }

    pollingTimerRef.current = window.setTimeout(poll, 50);

    return () => {
      isMounted = false;
      if (pollingTimerRef.current !== null) {
        window.clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      // CRÍTICO: Não chamamos session_close ao desmontar componente!
      // "montar/desmontar componente nao cria/fecha sessao"
    };
  }, [backend, activeSessionId, sessionState]);

  // Drag do nó pelo cabeçalho
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input')) return;

    e.preventDefault();
    e.stopPropagation();

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startNodeX = node.x;
    const startNodeY = node.y;

    function onMouseMove(moveEvent: MouseEvent) {
      const deltaX = (moveEvent.clientX - startMouseX) / zoom;
      const deltaY = (moveEvent.clientY - startMouseY) / zoom;
      onMove(node.id, startNodeX + deltaX, startNodeY + deltaY);
    }

    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Resize do nó pelo canto inferior direito
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startWidth = node.width;
    const startHeight = node.height;

    function onMouseMove(moveEvent: MouseEvent) {
      const deltaW = (moveEvent.clientX - startMouseX) / zoom;
      const deltaH = (moveEvent.clientY - startMouseY) / zoom;
      onResize(node.id, startWidth + deltaW, startHeight + deltaH);
    }

    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const getStatusBadge = () => {
    if (!backend.isNative) {
      return <span className="node-status-badge web">preview</span>;
    }
    switch (sessionState) {
      case 'running':
        return <span className="node-status-badge running" title={`Sessão ativa: ${activeSessionId}`}>ativo</span>;
      case 'exited':
        return <span className="node-status-badge exited" title="Processo finalizado">encerrado</span>;
      case 'closed':
        return <span className="node-status-badge closed" title="Sessão fechada">fechado</span>;
      case 'failed':
        return <span className="node-status-badge failed" title="Erro no processo">falha</span>;
      case 'interrupted':
      default:
        return (
          <span className="node-status-badge interrupted" title="Sessão não conectada ou interrompida após reinício">
            interrompido
          </span>
        );
    }
  };

  return (
    <article
      className={`ciranda-canvas-node ${isSelected ? 'selected' : ''} ${isConnectingSource ? 'connecting-source' : ''}`}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: `${node.width}px`,
        height: `${node.height}px`,
      }}
      onClick={onSelect}
      aria-label={`Terminal ${node.title}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (isInteractiveKeyboardTarget(e.target)) return;
        if (e.key === 'Delete' && isSelected && !showDeleteConfirm) {
          setShowDeleteConfirm(true);
        }
      }}
    >
      {/* Porta de entrada de contexto (à esquerda) */}
      <button
        type="button"
        className="node-port port-target"
        title="Conectar contexto de outro nó a este terminal"
        aria-label={`Conectar contexto como entrada para ${node.title}`}
        onClick={(e) => {
          e.stopPropagation();
          onCompleteConnection(node.id);
        }}
      >
        <span className="port-dot" aria-hidden="true" />
      </button>

      {/* Porta de saída de contexto (à direita) */}
      <button
        type="button"
        className={`node-port port-source ${isConnectingSource ? 'active' : ''}`}
        title="Arrastar ou clicar para referenciar este terminal como contexto"
        aria-label={`Conectar ${node.title} como referência de contexto para outro terminal`}
        onClick={(e) => {
          e.stopPropagation();
          onStartConnection(node.id);
        }}
      >
        <span className="port-dot" aria-hidden="true" />
      </button>

      {/* Cabeçalho do nó */}
      <header className="node-header" onMouseDown={handleHeaderMouseDown}>
        <div className="node-title-container">
          <span className="node-icon" aria-hidden="true">💻</span>
          {isEditingTitle ? (
            <input
              type="text"
              className="node-title-input"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                onUpdateTitle(node.id, titleDraft);
                setIsEditingTitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onUpdateTitle(node.id, titleDraft);
                  setIsEditingTitle(false);
                } else if (e.key === 'Escape') {
                  setTitleDraft(node.title);
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
            />
          ) : (
            <span
              className="node-title"
              onDoubleClick={() => setIsEditingTitle(true)}
              title="Duplo clique para renomear"
            >
              {node.title}
            </span>
          )}
        </div>

        <div className="node-header-actions">
          {getStatusBadge()}

          {backend.isNative && sessionState !== 'running' && (
            <button
              type="button"
              className="node-action-btn reconnect"
              onClick={handleCreateOrReconnectSession}
              disabled={isCreatingSession}
              title={isCreatingSession ? 'Criando sessão PTY...' : 'Iniciar nova sessão PTY'}
              aria-label={`Iniciar nova sessão PTY para ${node.title}`}
            >
              {isCreatingSession ? 'Iniciando...' : 'Iniciar'}
            </button>
          )}

          {backend.isNative && sessionState === 'running' && (
            <button
              type="button"
              className="node-action-btn close-session"
              onClick={handleCloseSession}
              title="Encerrar processo da sessão"
              aria-label={`Encerrar processo da sessão para ${node.title}`}
            >
              Parar
            </button>
          )}

          <button
            type="button"
            className="node-action-btn delete"
            onClick={() => setShowDeleteConfirm(true)}
            title="Excluir nó do canvas"
            aria-label={`Excluir nó ${node.title}`}
          >
            ×
          </button>
        </div>
      </header>

      {/* Banner de erro ou aviso */}
      {errorBanner && (
        <div className="node-error-banner" role="alert">
          <span>{errorBanner}</span>
          <button type="button" onClick={() => setErrorBanner(null)} aria-label="Fechar aviso">×</button>
        </div>
      )}

      {/* Diálogo explícito de exclusão */}
      {showDeleteConfirm && (
        <div className="node-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <div className="node-dialog">
            <h4 id="dialog-title">Remover Nó</h4>
            <p>Deseja remover <strong>{node.title}</strong> do canvas?</p>
            {backend.isNative && sessionState === 'running' && (
              <p className="dialog-subtext">Este nó possui uma sessão PTY ativa.</p>
            )}
            <div className="dialog-buttons">
              {backend.isNative && sessionState === 'running' && (
                <button
                  type="button"
                  className="dialog-btn danger"
                  onClick={() => onRemoveNode(node.id, true)}
                >
                  Remover e encerrar PTY
                </button>
              )}
              <button
                type="button"
                className="dialog-btn"
                onClick={() => onRemoveNode(node.id, false)}
              >
                {backend.isNative && sessionState === 'running' ? 'Remover (manter PTY viva)' : 'Remover nó'}
              </button>
              <button
                type="button"
                className="dialog-btn cancel"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Corpo do terminal com xterm */}
      <div className="node-body">
        <div ref={terminalRef} className="xterm-container" />
      </div>

      {/* Handle de redimensionamento */}
      <div
        className="node-resize-handle"
        onMouseDown={handleResizeMouseDown}
        title="Arrastar para redimensionar"
        aria-hidden="true"
      />
    </article>
  );
};
