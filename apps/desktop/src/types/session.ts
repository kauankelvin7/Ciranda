export type SessionState = 'running' | 'exited' | 'closed' | 'failed' | 'interrupted';

export interface SessionInfo {
  id: string;
  cwd: string;
  state: 'running' | 'exited' | 'closed' | 'failed';
  cols: number;
  rows: number;
}

export interface SessionChunk {
  seq: number;
  data: number[];
}

export interface SessionReadResult {
  sessionId: string;
  chunks: SessionChunk[];
  state: 'running' | 'exited' | 'closed' | 'failed';
  truncated: boolean;
}

export interface WorkspaceInfo {
  root: string;
  platform: string;
}
