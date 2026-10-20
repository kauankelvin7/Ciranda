export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasNode {
  id: string;
  type: 'terminal';
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  sessionId?: string;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type: 'context_reference';
}

export interface CanvasGroup {
  id: string;
  title: string;
  nodeIds: string[];
}

export interface LayoutV1 {
  version: 1;
  viewport: Viewport;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  groups: CanvasGroup[];
}
