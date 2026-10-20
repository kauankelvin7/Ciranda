import type { LayoutV1, CanvasNode, CanvasEdge, CanvasGroup, Viewport } from '../types/canvas.ts';

export function createInitialLayout(): LayoutV1 {
  return {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: [],
    groups: [],
  };
}

export function addNode(
  layout: LayoutV1,
  options?: Partial<Omit<CanvasNode, 'id' | 'type'>>
): { layout: LayoutV1; node: CanvasNode } {
  const index = layout.nodes.length + 1;
  const id = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Posicionamento escalonado para não sobrepor exatamente nós anteriores
  const offsetX = (layout.nodes.length % 5) * 40;
  const offsetY = (layout.nodes.length % 5) * 40;

  const newNode: CanvasNode = {
    id,
    type: 'terminal',
    x: options?.x ?? (100 + offsetX),
    y: options?.y ?? (100 + offsetY),
    width: Math.max(320, options?.width ?? 520),
    height: Math.max(220, options?.height ?? 360),
    title: options?.title ?? `Terminal ${index}`,
    sessionId: options?.sessionId,
  };

  return {
    layout: {
      ...layout,
      nodes: [...layout.nodes, newNode],
    },
    node: newNode,
  };
}

export function updateNodePosition(
  layout: LayoutV1,
  id: string,
  x: number,
  y: number
): LayoutV1 {
  return {
    ...layout,
    nodes: layout.nodes.map((node) =>
      node.id === id ? { ...node, x: Math.round(x), y: Math.round(y) } : node
    ),
  };
}

export function updateNodeDimensions(
  layout: LayoutV1,
  id: string,
  width: number,
  height: number
): LayoutV1 {
  const clampedW = Math.max(280, Math.round(width));
  const clampedH = Math.max(180, Math.round(height));

  return {
    ...layout,
    nodes: layout.nodes.map((node) =>
      node.id === id ? { ...node, width: clampedW, height: clampedH } : node
    ),
  };
}

export function updateNodeTitle(
  layout: LayoutV1,
  id: string,
  title: string
): LayoutV1 {
  const trimmed = title.trim();
  if (!trimmed) return layout;

  return {
    ...layout,
    nodes: layout.nodes.map((node) =>
      node.id === id ? { ...node, title: trimmed } : node
    ),
  };
}

export function setNodeSession(
  layout: LayoutV1,
  id: string,
  sessionId?: string
): LayoutV1 {
  return {
    ...layout,
    nodes: layout.nodes.map((node) =>
      node.id === id ? { ...node, sessionId } : node
    ),
  };
}

export function removeNode(layout: LayoutV1, id: string): LayoutV1 {
  return {
    ...layout,
    nodes: layout.nodes.filter((node) => node.id !== id),
    edges: layout.edges.filter((edge) => edge.source !== id && edge.target !== id),
    groups: layout.groups.map((group) => ({
      ...group,
      nodeIds: group.nodeIds.filter((nodeId) => nodeId !== id),
    })),
  };
}

export function addEdge(
  layout: LayoutV1,
  source: string,
  target: string
): { success: true; layout: LayoutV1; edge: CanvasEdge } | { success: false; error: string } {
  if (source === target) {
    return { success: false, error: 'Não é permitido conectar um nó a ele mesmo.' };
  }

  const sourceExists = layout.nodes.some((n) => n.id === source);
  const targetExists = layout.nodes.some((n) => n.id === target);

  if (!sourceExists) {
    return { success: false, error: `Nó de origem "${source}" não existe no canvas.` };
  }
  if (!targetExists) {
    return { success: false, error: `Nó de destino "${target}" não existe no canvas.` };
  }

  const alreadyConnected = layout.edges.some(
    (e) => e.source === source && e.target === target && e.type === 'context_reference'
  );
  if (alreadyConnected) {
    return { success: false, error: 'Esta referência de contexto já está conectada.' };
  }

  const edge: CanvasEdge = {
    id: `edge-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    source,
    target,
    type: 'context_reference',
  };

  return {
    success: true,
    layout: {
      ...layout,
      edges: [...layout.edges, edge],
    },
    edge,
  };
}

export function removeEdge(layout: LayoutV1, edgeId: string): LayoutV1 {
  return {
    ...layout,
    edges: layout.edges.filter((e) => e.id !== edgeId),
  };
}

export function createGroup(
  layout: LayoutV1,
  title: string,
  nodeIds: string[]
): { success: true; layout: LayoutV1; group: CanvasGroup } | { success: false; error: string } {
  const trimmed = title.trim();
  if (!trimmed) {
    return { success: false, error: 'O grupo deve ter um título não vazio.' };
  }

  const validIds = nodeIds.filter((id) => layout.nodes.some((n) => n.id === id));
  if (validIds.length === 0) {
    return { success: false, error: 'O grupo deve conter ao menos um nó válido existente.' };
  }

  const group: CanvasGroup = {
    id: `group-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: trimmed,
    nodeIds: validIds,
  };

  return {
    success: true,
    layout: {
      ...layout,
      groups: [...layout.groups, group],
    },
    group,
  };
}

export function removeGroup(layout: LayoutV1, groupId: string): LayoutV1 {
  return {
    ...layout,
    groups: layout.groups.filter((g) => g.id !== groupId),
  };
}

export function updateViewport(
  layout: LayoutV1,
  viewportUpdate: Partial<Viewport>
): LayoutV1 {
  const current = layout.viewport;
  const nextZoom =
    viewportUpdate.zoom !== undefined
      ? Math.max(0.2, Math.min(3.0, Math.round(viewportUpdate.zoom * 100) / 100))
      : current.zoom;

  return {
    ...layout,
    viewport: {
      x: viewportUpdate.x !== undefined ? Math.round(viewportUpdate.x) : current.x,
      y: viewportUpdate.y !== undefined ? Math.round(viewportUpdate.y) : current.y,
      zoom: nextZoom,
    },
  };
}
