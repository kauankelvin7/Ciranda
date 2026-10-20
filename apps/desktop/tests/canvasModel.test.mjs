import test from 'node:test';
import assert from 'node:assert/strict';
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
} from '../src/services/canvasModel.ts';

test('createInitialLayout produces a valid empty LayoutV1 structure', () => {
  const layout = createInitialLayout();
  assert.equal(layout.version, 1);
  assert.deepEqual(layout.viewport, { x: 0, y: 0, zoom: 1 });
  assert.equal(layout.nodes.length, 0);
  assert.equal(layout.edges.length, 0);
  assert.equal(layout.groups.length, 0);
});

test('addNode adds a terminal node with default and custom values', () => {
  let layout = createInitialLayout();
  const res1 = addNode(layout, { title: 'T1' });
  layout = res1.layout;

  assert.equal(layout.nodes.length, 1);
  assert.equal(res1.node.type, 'terminal');
  assert.equal(res1.node.title, 'T1');
  assert.ok(res1.node.width >= 320);
  assert.ok(res1.node.height >= 220);

  const res2 = addNode(layout, { x: 400, y: 300, width: 600, height: 450, title: 'T2', sessionId: 's-99' });
  layout = res2.layout;

  assert.equal(layout.nodes.length, 2);
  assert.equal(res2.node.x, 400);
  assert.equal(res2.node.y, 300);
  assert.equal(res2.node.width, 600);
  assert.equal(res2.node.height, 450);
  assert.equal(res2.node.sessionId, 's-99');
});

test('updateNodePosition, updateNodeDimensions and updateNodeTitle modify node in-place', () => {
  let layout = createInitialLayout();
  const { layout: l1, node } = addNode(layout);
  layout = l1;

  layout = updateNodePosition(layout, node.id, 250.7, 180.2);
  assert.equal(layout.nodes[0].x, 251);
  assert.equal(layout.nodes[0].y, 180);

  layout = updateNodeDimensions(layout, node.id, 500.4, 350.8);
  assert.equal(layout.nodes[0].width, 500);
  assert.equal(layout.nodes[0].height, 351);

  layout = updateNodeTitle(layout, node.id, '  Terminal Principal  ');
  assert.equal(layout.nodes[0].title, 'Terminal Principal');

  layout = setNodeSession(layout, node.id, 'new-session-42');
  assert.equal(layout.nodes[0].sessionId, 'new-session-42');
});

test('removeNode removes node and cleans up corresponding edges and groups', () => {
  let layout = createInitialLayout();
  const n1 = addNode(layout, { title: 'Node 1' });
  layout = n1.layout;
  const n2 = addNode(layout, { title: 'Node 2' });
  layout = n2.layout;

  // Adiciona aresta e grupo
  const edgeRes = addEdge(layout, n1.node.id, n2.node.id);
  assert.equal(edgeRes.success, true);
  if (edgeRes.success) layout = edgeRes.layout;

  const groupRes = createGroup(layout, 'Time A', [n1.node.id, n2.node.id]);
  assert.equal(groupRes.success, true);
  if (groupRes.success) layout = groupRes.layout;

  assert.equal(layout.nodes.length, 2);
  assert.equal(layout.edges.length, 1);
  assert.equal(layout.groups[0].nodeIds.length, 2);

  // Remove n1
  layout = removeNode(layout, n1.node.id);

  assert.equal(layout.nodes.length, 1);
  assert.equal(layout.nodes[0].id, n2.node.id);
  assert.equal(layout.edges.length, 0); // aresta conectada a n1 foi removida
  assert.deepEqual(layout.groups[0].nodeIds, [n2.node.id]); // n1 removido do grupo
});

test('addEdge enforces validation: rejects self-connection, missing nodes, duplicate edges', () => {
  let layout = createInitialLayout();
  const n1 = addNode(layout, { title: 'N1' });
  layout = n1.layout;
  const n2 = addNode(layout, { title: 'N2' });
  layout = n2.layout;

  // Auto conexão
  const selfRes = addEdge(layout, n1.node.id, n1.node.id);
  assert.equal(selfRes.success, false);
  if (!selfRes.success) assert.match(selfRes.error, /a ele mesmo/);

  // Nó inexistente
  const ghostRes = addEdge(layout, n1.node.id, 'ghost-node');
  assert.equal(ghostRes.success, false);
  if (!ghostRes.success) assert.match(ghostRes.error, /não existe/);

  // Conexão válida
  const okRes = addEdge(layout, n1.node.id, n2.node.id);
  assert.equal(okRes.success, true);
  if (okRes.success) {
    layout = okRes.layout;
    assert.equal(okRes.edge.type, 'context_reference');
    assert.equal(okRes.edge.source, n1.node.id);
    assert.equal(okRes.edge.target, n2.node.id);
  }

  // Duplicata
  const dupRes = addEdge(layout, n1.node.id, n2.node.id);
  assert.equal(dupRes.success, false);
  if (!dupRes.success) assert.match(dupRes.error, /já está conectada/);

  // Remoção de aresta
  if (okRes.success) {
    layout = removeEdge(layout, okRes.edge.id);
    assert.equal(layout.edges.length, 0);
  }
});

test('createGroup and removeGroup manage groups correctly', () => {
  let layout = createInitialLayout();
  const n1 = addNode(layout, { title: 'N1' });
  layout = n1.layout;

  // Título vazio rejeitado
  const emptyRes = createGroup(layout, '   ', [n1.node.id]);
  assert.equal(emptyRes.success, false);

  // Criação com sucesso
  const groupRes = createGroup(layout, 'Grupo Terminais', [n1.node.id]);
  assert.equal(groupRes.success, true);
  if (groupRes.success) {
    layout = groupRes.layout;
    assert.equal(layout.groups.length, 1);
    assert.equal(layout.groups[0].title, 'Grupo Terminais');

    // Remoção do grupo
    layout = removeGroup(layout, groupRes.group.id);
    assert.equal(layout.groups.length, 0);
    assert.equal(layout.nodes.length, 1); // Nós não são removidos ao remover grupo
  }
});

test('updateViewport applies pan and zoom clamping', () => {
  let layout = createInitialLayout();

  layout = updateViewport(layout, { x: 150.4, y: -80.9 });
  assert.equal(layout.viewport.x, 150);
  assert.equal(layout.viewport.y, -81);

  // Zoom clamp inferior (0.2)
  layout = updateViewport(layout, { zoom: 0.05 });
  assert.equal(layout.viewport.zoom, 0.2);

  // Zoom clamp superior (3.0)
  layout = updateViewport(layout, { zoom: 8.5 });
  assert.equal(layout.viewport.zoom, 3.0);
});
