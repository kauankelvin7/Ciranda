import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLayout, parseAndValidateLayout, getDefaultLayout } from '../src/services/layoutValidator.ts';

test('layoutValidator accepts valid LayoutV1 structure', () => {
  const valid = {
    version: 1,
    viewport: { x: 100, y: -50, zoom: 1.25 },
    nodes: [
      { id: 'node-1', type: 'terminal', x: 50, y: 50, width: 400, height: 300, title: 'Term 1' },
      { id: 'node-2', type: 'terminal', x: 550, y: 50, width: 400, height: 300, title: 'Term 2', sessionId: 'sess-123' },
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'node-2', type: 'context_reference' },
    ],
    groups: [
      { id: 'group-1', title: 'Equipe Alpha', nodeIds: ['node-1', 'node-2'] },
    ],
  };

  const result = validateLayout(valid);
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.layout.version, 1);
    assert.equal(result.layout.nodes.length, 2);
    assert.equal(result.layout.edges.length, 1);
    assert.equal(result.layout.groups.length, 1);
  }
});

test('layoutValidator rejects invalid version', () => {
  const invalid = { version: 2, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [], edges: [], groups: [] };
  const result = validateLayout(invalid);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.error, /não suportada/);
  }
});

test('layoutValidator rejects invalid viewport zoom or coordinates', () => {
  const invalidZoom = { version: 1, viewport: { x: 0, y: 0, zoom: 10 }, nodes: [], edges: [], groups: [] };
  const resZoom = validateLayout(invalidZoom);
  assert.equal(resZoom.valid, false);

  const invalidCoords = { version: 1, viewport: { x: NaN, y: 0, zoom: 1 }, nodes: [], edges: [], groups: [] };
  const resCoords = validateLayout(invalidCoords);
  assert.equal(resCoords.valid, false);
});

test('layout viewport respects the SQLite SESSION_API v1 zoom bounds', () => {
  const layout = getDefaultLayout();
  for (const zoom of [0.1, 1, 4]) {
    assert.equal(validateLayout({ ...layout, viewport: { x: 0, y: 0, zoom } }).valid, true);
  }
  for (const zoom of [0.09, 4.01, 5]) {
    assert.equal(validateLayout({ ...layout, viewport: { x: 0, y: 0, zoom } }).valid, false);
  }
});

test('layoutValidator rejects non-terminal node types', () => {
  const invalidType = {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [{ id: 'n1', type: 'other', x: 0, y: 0, width: 300, height: 200, title: 'X' }],
    edges: [],
    groups: [],
  };
  const result = validateLayout(invalidType);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.error, /Tipo de nó desconhecido/);
  }
});

test('layoutValidator rejects duplicate node IDs', () => {
  const duplicateNodes = {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      { id: 'node-same', type: 'terminal', x: 0, y: 0, width: 300, height: 200, title: '1' },
      { id: 'node-same', type: 'terminal', x: 100, y: 100, width: 300, height: 200, title: '2' },
    ],
    edges: [],
    groups: [],
  };
  const result = validateLayout(duplicateNodes);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.error, /duplicado/);
  }
});

test('layoutValidator rejects edges with non-existent nodes', () => {
  const brokenEdge = {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [{ id: 'n1', type: 'terminal', x: 0, y: 0, width: 300, height: 200, title: '1' }],
    edges: [{ id: 'e1', source: 'n1', target: 'n2_ghost', type: 'context_reference' }],
    groups: [],
  };
  const result = validateLayout(brokenEdge);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.error, /inexistente/);
  }
});

test('layoutValidator rejects self-referencing edge', () => {
  const selfEdge = {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [{ id: 'n1', type: 'terminal', x: 0, y: 0, width: 300, height: 200, title: '1' }],
    edges: [{ id: 'e1', source: 'n1', target: 'n1', type: 'context_reference' }],
    groups: [],
  };
  const result = validateLayout(selfEdge);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.error, /Auto-referência proibida/);
  }
});

test('layoutValidator rejects non context_reference edges', () => {
  const invalidEdgeType = {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      { id: 'n1', type: 'terminal', x: 0, y: 0, width: 300, height: 200, title: '1' },
      { id: 'n2', type: 'terminal', x: 200, y: 0, width: 300, height: 200, title: '2' },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2', type: 'task_dependency' }],
    groups: [],
  };
  const result = validateLayout(invalidEdgeType);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.error, /não suportado/);
  }
});

test('parseAndValidateLayout parses raw json or rejects syntax errors', () => {
  const validJson = JSON.stringify(getDefaultLayout());
  const parseOk = parseAndValidateLayout(validJson);
  assert.equal(parseOk.valid, true);

  const badJson = '{ invalid: true, ';
  const parseFail = parseAndValidateLayout(badJson);
  assert.equal(parseFail.valid, false);
  if (!parseFail.valid) {
    assert.match(parseFail.error, /JSON malformado/);
  }
});
