import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialLayout,
  addNode,
  setNodeSession,
  updateNodePosition,
  updateNodeDimensions,
} from '../src/services/canvasModel.ts';

test('setNodeSession updates layout immutably and preserves sessionId across moves and resizes', () => {
  let layout = createInitialLayout();
  const { layout: l1, node } = addNode(layout, { title: 'Terminal PTY' });
  layout = l1;
  assert.equal(layout.nodes[0].sessionId, undefined);

  // Associa sessão imutavelmente
  layout = setNodeSession(layout, node.id, 'sess-pty-real-42');
  assert.equal(layout.nodes[0].sessionId, 'sess-pty-real-42');

  // Move o nó
  layout = updateNodePosition(layout, node.id, 300, 250);
  assert.equal(layout.nodes[0].x, 300);
  assert.equal(layout.nodes[0].y, 250);
  assert.equal(layout.nodes[0].sessionId, 'sess-pty-real-42', 'sessionId deve ser preservado após mover nó');

  // Redimensiona o nó
  layout = updateNodeDimensions(layout, node.id, 640, 480);
  assert.equal(layout.nodes[0].width, 640);
  assert.equal(layout.nodes[0].height, 480);
  assert.equal(layout.nodes[0].sessionId, 'sess-pty-real-42', 'sessionId deve ser preservado após redimensionar nó');

  // Remove associação
  layout = setNodeSession(layout, node.id, undefined);
  assert.equal(layout.nodes[0].sessionId, undefined);
});
