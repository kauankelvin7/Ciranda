import type { LayoutV1, CanvasNode, CanvasEdge, CanvasGroup, Viewport } from '../types/canvas.ts';

export interface ValidationSuccess {
  valid: true;
  layout: LayoutV1;
}

export interface ValidationFailure {
  valid: false;
  error: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

export function getDefaultLayout(): LayoutV1 {
  return {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: [],
    groups: [],
  };
}

export function validateLayout(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'O payload de layout deve ser um objeto JSON não nulo.' };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.version !== 1) {
    return { valid: false, error: `Versão de layout não suportada: esperada 1, recebida ${String(obj.version)}.` };
  }

  // Validação do viewport
  if (!obj.viewport || typeof obj.viewport !== 'object') {
    return { valid: false, error: 'O layout deve conter um objeto viewport.' };
  }
  const vp = obj.viewport as Record<string, unknown>;
  if (typeof vp.x !== 'number' || !Number.isFinite(vp.x) ||
      typeof vp.y !== 'number' || !Number.isFinite(vp.y) ||
      typeof vp.zoom !== 'number' || !Number.isFinite(vp.zoom)) {
    return { valid: false, error: 'As propriedades do viewport (x, y, zoom) devem ser números finitos.' };
  }
  if (vp.zoom < 0.1 || vp.zoom > 4.0) {
    return { valid: false, error: `Zoom fora dos limites aceitáveis (0.1 - 4.0): ${vp.zoom}.` };
  }
  const viewport: Viewport = {
    x: vp.x,
    y: vp.y,
    zoom: Math.round(vp.zoom * 100) / 100,
  };

  // Validação dos nós
  if (!Array.isArray(obj.nodes)) {
    return { valid: false, error: 'A propriedade nodes deve ser uma lista.' };
  }

  const nodeMap = new Set<string>();
  const nodes: CanvasNode[] = [];

  for (let i = 0; i < obj.nodes.length; i++) {
    const n = obj.nodes[i];
    if (!n || typeof n !== 'object') {
      return { valid: false, error: `Nó no índice ${i} é inválido.` };
    }
    const nodeObj = n as Record<string, unknown>;
    if (typeof nodeObj.id !== 'string' || !nodeObj.id.trim()) {
      return { valid: false, error: `Nó no índice ${i} possui ID inválido ou vazio.` };
    }
    if (nodeMap.has(nodeObj.id)) {
      return { valid: false, error: `ID de nó duplicado encontrado: ${nodeObj.id}.` };
    }
    if (nodeObj.type !== 'terminal') {
      return { valid: false, error: `Tipo de nó desconhecido no nó ${nodeObj.id}: esperado 'terminal'.` };
    }
    if (typeof nodeObj.x !== 'number' || !Number.isFinite(nodeObj.x) ||
        typeof nodeObj.y !== 'number' || !Number.isFinite(nodeObj.y) ||
        typeof nodeObj.width !== 'number' || !Number.isFinite(nodeObj.width) ||
        typeof nodeObj.height !== 'number' || !Number.isFinite(nodeObj.height)) {
      return { valid: false, error: `Dimensões ou posição inválidas no nó ${nodeObj.id}.` };
    }
    if (nodeObj.width < 100 || nodeObj.height < 80) {
      return { valid: false, error: `Dimensões abaixo do mínimo permitido no nó ${nodeObj.id}.` };
    }

    const title = typeof nodeObj.title === 'string' && nodeObj.title.trim() ? nodeObj.title.trim() : `Terminal ${i + 1}`;
    const sessionId = typeof nodeObj.sessionId === 'string' && nodeObj.sessionId.trim() ? nodeObj.sessionId.trim() : undefined;

    nodeMap.add(nodeObj.id);
    nodes.push({
      id: nodeObj.id,
      type: 'terminal',
      x: nodeObj.x,
      y: nodeObj.y,
      width: nodeObj.width,
      height: nodeObj.height,
      title,
      sessionId,
    });
  }

  // Validação de arestas (edges / context_reference)
  if (!Array.isArray(obj.edges)) {
    return { valid: false, error: 'A propriedade edges deve ser uma lista.' };
  }

  const edgeMap = new Set<string>();
  const edgeConnections = new Set<string>();
  const edges: CanvasEdge[] = [];

  for (let i = 0; i < obj.edges.length; i++) {
    const e = obj.edges[i];
    if (!e || typeof e !== 'object') {
      return { valid: false, error: `Aresta no índice ${i} é inválida.` };
    }
    const edgeObj = e as Record<string, unknown>;
    if (typeof edgeObj.id !== 'string' || !edgeObj.id.trim()) {
      return { valid: false, error: `Aresta no índice ${i} possui ID inválido.` };
    }
    if (edgeMap.has(edgeObj.id)) {
      return { valid: false, error: `ID de aresta duplicado: ${edgeObj.id}.` };
    }
    if (edgeObj.type !== 'context_reference') {
      return { valid: false, error: `Tipo de aresta não suportado: ${String(edgeObj.type)}. Esperado 'context_reference'.` };
    }
    if (typeof edgeObj.source !== 'string' || !nodeMap.has(edgeObj.source)) {
      return { valid: false, error: `Aresta ${edgeObj.id} referencia nó de origem inexistente: ${String(edgeObj.source)}.` };
    }
    if (typeof edgeObj.target !== 'string' || !nodeMap.has(edgeObj.target)) {
      return { valid: false, error: `Aresta ${edgeObj.id} referencia nó de destino inexistente: ${String(edgeObj.target)}.` };
    }
    if (edgeObj.source === edgeObj.target) {
      return { valid: false, error: `Auto-referência proibida na aresta ${edgeObj.id} (origem e destino são o mesmo nó).` };
    }

    const pairKey = `${edgeObj.source}->${edgeObj.target}`;
    if (edgeConnections.has(pairKey)) {
      return { valid: false, error: `Conexão duplicada entre nós: ${pairKey}.` };
    }

    edgeMap.add(edgeObj.id);
    edgeConnections.add(pairKey);
    edges.push({
      id: edgeObj.id,
      source: edgeObj.source,
      target: edgeObj.target,
      type: 'context_reference',
    });
  }

  // Validação dos grupos
  if (!Array.isArray(obj.groups)) {
    return { valid: false, error: 'A propriedade groups deve ser uma lista.' };
  }

  const groupMap = new Set<string>();
  const groups: CanvasGroup[] = [];

  for (let i = 0; i < obj.groups.length; i++) {
    const g = obj.groups[i];
    if (!g || typeof g !== 'object') {
      return { valid: false, error: `Grupo no índice ${i} é inválido.` };
    }
    const groupObj = g as Record<string, unknown>;
    if (typeof groupObj.id !== 'string' || !groupObj.id.trim()) {
      return { valid: false, error: `Grupo no índice ${i} possui ID inválido.` };
    }
    if (groupMap.has(groupObj.id)) {
      return { valid: false, error: `ID de grupo duplicado: ${groupObj.id}.` };
    }
    if (!Array.isArray(groupObj.nodeIds)) {
      return { valid: false, error: `Grupo ${groupObj.id} deve conter uma lista nodeIds.` };
    }

    const validNodeIds: string[] = [];
    for (const nId of groupObj.nodeIds) {
      if (typeof nId === 'string' && nodeMap.has(nId) && !validNodeIds.includes(nId)) {
        validNodeIds.push(nId);
      }
    }

    groupMap.add(groupObj.id);
    groups.push({
      id: groupObj.id,
      title: typeof groupObj.title === 'string' && groupObj.title.trim() ? groupObj.title.trim() : `Grupo ${i + 1}`,
      nodeIds: validNodeIds,
    });
  }

  return {
    valid: true,
    layout: {
      version: 1,
      viewport,
      nodes,
      edges,
      groups,
    },
  };
}

export function parseAndValidateLayout(jsonString: string): ValidationResult {
  try {
    const parsed = JSON.parse(jsonString);
    return validateLayout(parsed);
  } catch (err) {
    return {
      valid: false,
      error: `JSON malformado no layout: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
