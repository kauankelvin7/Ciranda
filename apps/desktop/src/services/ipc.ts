import { invoke } from '@tauri-apps/api/core';
import type { SessionInfo, SessionReadResult, WorkspaceInfo } from '../types/session.ts';

export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

const WEB_STORAGE_KEY = 'ciranda_layout_v1_preview';

export class TauriBackendClient {
  readonly isNative = true;

  async getWorkspaceInfo(): Promise<WorkspaceInfo> {
    return await invoke<WorkspaceInfo>('workspace_info');
  }

  async createSession(cols: number, rows: number, cwd?: string): Promise<SessionInfo> {
    return await invoke<SessionInfo>('session_create', { cwd, cols, rows });
  }

  async listSessions(): Promise<SessionInfo[]> {
    return await invoke<SessionInfo[]>('session_list');
  }

  async writeSession(sessionId: string, data: string): Promise<void> {
    await invoke<void>('session_write', { sessionId, data });
  }

  async resizeSession(sessionId: string, cols: number, rows: number): Promise<void> {
    await invoke<void>('session_resize', { sessionId, cols, rows });
  }

  async readSession(sessionId: string, afterSeq: number): Promise<SessionReadResult> {
    return await invoke<SessionReadResult>('session_read', { sessionId, afterSeq });
  }

  async closeSession(sessionId: string): Promise<void> {
    await invoke<void>('session_close', { sessionId });
  }

  async loadWorkspaceLayout(): Promise<string | null> {
    return await invoke<string | null>('workspace_load');
  }

  async saveWorkspaceLayout(layoutJson: string): Promise<void> {
    await invoke<void>('workspace_save', { layoutJson });
  }
}

export class WebPreviewBackendClient {
  readonly isNative = false;

  async getWorkspaceInfo(): Promise<WorkspaceInfo> {
    return {
      root: '(Ambiente Web / Preview)',
      platform: 'web-preview',
    };
  }

  async createSession(): Promise<SessionInfo> {
    throw new Error(
      'Runtime PTY nativo indisponível no navegador. Execute a aplicação desktop CIRANDA com Tauri v2 para iniciar sessões reais no Windows.'
    );
  }

  async listSessions(): Promise<SessionInfo[]> {
    return [];
  }

  async writeSession(): Promise<void> {
    throw new Error('Terminal real indisponível no navegador web.');
  }

  async resizeSession(): Promise<void> {
    // No-op no preview
    return Promise.resolve();
  }

  async readSession(): Promise<SessionReadResult> {
    throw new Error('Não há fluxo PTY para leitura no navegador web.');
  }

  async closeSession(): Promise<void> {
    return Promise.resolve();
  }

  async loadWorkspaceLayout(): Promise<string | null> {
    try {
      return localStorage.getItem(WEB_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  async saveWorkspaceLayout(layoutJson: string): Promise<void> {
    try {
      localStorage.setItem(WEB_STORAGE_KEY, layoutJson);
    } catch (err) {
      throw new Error(
        `Falha ao persistir layout no armazenamento local: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      );
    }
  }
}

export function createBackendClient(): TauriBackendClient | WebPreviewBackendClient {
  if (isTauriEnvironment()) {
    return new TauriBackendClient();
  }
  return new WebPreviewBackendClient();
}
