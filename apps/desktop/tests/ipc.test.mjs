import test from 'node:test';
import assert from 'node:assert/strict';
import { WebPreviewBackendClient, TauriBackendClient } from '../src/services/ipc.ts';

test('WebPreviewBackendClient identifies as non-native and returns web info', async () => {
  const client = new WebPreviewBackendClient();
  assert.equal(client.isNative, false);

  const info = await client.getWorkspaceInfo();
  assert.equal(info.platform, 'web-preview');
  assert.match(info.root, /Preview/);
});

test('WebPreviewBackendClient never fakes terminal output or simulates shell', async () => {
  const client = new WebPreviewBackendClient();

  // createSession deve falhar de forma explícita
  await assert.rejects(
    async () => await client.createSession(),
    /indisponível no navegador/
  );

  // writeSession deve falhar
  await assert.rejects(
    async () => await client.writeSession(),
    /indisponível no navegador/
  );

  // readSession deve falhar
  await assert.rejects(
    async () => await client.readSession(),
    /Não há fluxo PTY/
  );
});

test('WebPreviewBackendClient stores and loads layout from localStorage mock', async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, val) => storage.set(key, val),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  };

  const client = new WebPreviewBackendClient();
  const emptyLoad = await client.loadWorkspaceLayout();
  assert.equal(emptyLoad, null);

  const sampleJson = JSON.stringify({ version: 1, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [], edges: [], groups: [] });
  await client.saveWorkspaceLayout(sampleJson);

  const loaded = await client.loadWorkspaceLayout();
  assert.equal(loaded, sampleJson);
});

test('TauriBackendClient defines exact SESSION_API commands and signatures', () => {
  const client = new TauriBackendClient();
  assert.equal(client.isNative, true);

  // Confere existência de todos os métodos exigidos por docs/SESSION_API.md
  assert.equal(typeof client.getWorkspaceInfo, 'function');
  assert.equal(typeof client.createSession, 'function');
  assert.equal(typeof client.listSessions, 'function');
  assert.equal(typeof client.writeSession, 'function');
  assert.equal(typeof client.resizeSession, 'function');
  assert.equal(typeof client.readSession, 'function');
  assert.equal(typeof client.closeSession, 'function');
  assert.equal(typeof client.loadWorkspaceLayout, 'function');
  assert.equal(typeof client.saveWorkspaceLayout, 'function');
});
