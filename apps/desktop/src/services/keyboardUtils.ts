export function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  if (!target) return false;

  // Em ambientes de teste ou browsers onde target pode ser Element genérico
  const element = target as HTMLElement;
  if (!element.tagName) return false;

  const tag = element.tagName.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }

  if (element.isContentEditable) {
    return true;
  }

  if (typeof element.closest === 'function') {
    if (element.closest('.xterm, .xterm-helper-textarea, textarea, select, [contenteditable="true"], input')) {
      return true;
    }
  }

  return false;
}

export function isXtermWheelTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  const element = target as HTMLElement;
  if (typeof element.closest === 'function') {
    if (element.closest('.xterm, .xterm-screen, .xterm-viewport, .xterm-scroll-area')) {
      return true;
    }
  }
  return false;
}
