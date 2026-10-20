import test from 'node:test';
import assert from 'node:assert/strict';
import { isInteractiveKeyboardTarget, isXtermWheelTarget } from '../src/services/keyboardUtils.ts';

test('isInteractiveKeyboardTarget identifies inputs, textareas, selects, and xterm elements', () => {
  // Input padrão
  const fakeInput = { tagName: 'INPUT', isContentEditable: false };
  assert.equal(isInteractiveKeyboardTarget(fakeInput), true);

  // Textarea (incluindo o helper invisível do xterm)
  const fakeTextarea = { tagName: 'TEXTAREA', isContentEditable: false };
  assert.equal(isInteractiveKeyboardTarget(fakeTextarea), true);

  // Select
  const fakeSelect = { tagName: 'SELECT', isContentEditable: false };
  assert.equal(isInteractiveKeyboardTarget(fakeSelect), true);

  // Elemento com contenteditable
  const fakeEditable = { tagName: 'DIV', isContentEditable: true };
  assert.equal(isInteractiveKeyboardTarget(fakeEditable), true);

  // Elemento interno do xterm (tela ou caractere)
  const fakeXtermChild = {
    tagName: 'SPAN',
    isContentEditable: false,
    closest: (sel) => (sel.includes('.xterm') ? {} : null),
  };
  assert.equal(isInteractiveKeyboardTarget(fakeXtermChild), true);

  // Elementos do canvas que DEVEM disparar atalhos globais
  const fakeCanvasBg = {
    tagName: 'DIV',
    isContentEditable: false,
    closest: () => null,
  };
  assert.equal(isInteractiveKeyboardTarget(fakeCanvasBg), false);

  const fakeToolbarBtn = {
    tagName: 'BUTTON',
    isContentEditable: false,
    closest: () => null,
  };
  assert.equal(isInteractiveKeyboardTarget(fakeToolbarBtn), false);
});

test('isXtermWheelTarget detects xterm elements to preserve terminal scroll', () => {
  const xtermScrollArea = {
    closest: (sel) => (sel.includes('.xterm-scroll-area') ? {} : null),
  };
  assert.equal(isXtermWheelTarget(xtermScrollArea), true);

  const canvasBackground = {
    closest: () => null,
  };
  assert.equal(isXtermWheelTarget(canvasBackground), false);

  assert.equal(isXtermWheelTarget(null), false);
});
