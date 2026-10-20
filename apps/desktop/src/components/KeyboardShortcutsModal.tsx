import React, { useEffect, useRef } from 'react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      modalRef.current?.focus();
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Alt + N', action: 'Criar novo terminal no centro da visualização' },
    { key: 'Ctrl + S', action: 'Salvar layout v1 no banco SQLite (ou local no preview)' },
    { key: 'Ctrl + + / Ctrl + =', action: 'Aumentar zoom do canvas' },
    { key: 'Ctrl + -', action: 'Reduzir zoom do canvas' },
    { key: 'Ctrl + 0', action: 'Redefinir zoom do canvas para 100%' },
    { key: 'Delete', action: 'Excluir nó selecionado (exibe diálogo de confirmação)' },
    { key: 'Esc', action: 'Fechar modais, cancelar conexão ou desselecionar nós' },
    { key: '?', action: 'Abrir este painel de atalhos e acessibilidade' },
  ];

  return (
    <div
      className="ciranda-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="ciranda-modal"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="shortcuts-title">Atalhos de Teclado e Acessibilidade</h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Fechar janela de atalhos"
          >
            ×
          </button>
        </header>

        <div className="modal-body">
          <table className="shortcuts-table">
            <thead>
              <tr>
                <th scope="col">Atalho</th>
                <th scope="col">Ação</th>
              </tr>
            </thead>
            <tbody>
              {shortcuts.map((s) => (
                <tr key={s.key}>
                  <td>
                    <kbd>{s.key}</kbd>
                  </td>
                  <td>{s.action}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="modal-note">
            <p>
              <strong>Navegação por foco:</strong> Todos os botões, portas e terminais possuem indicadores
              visíveis de foco de alto contraste para atender às diretrizes WCAG 2.1 AA.
            </p>
          </div>
        </div>

        <footer className="modal-footer">
          <button type="button" className="toolbar-btn primary" onClick={onClose}>
            Entendido
          </button>
        </footer>
      </div>
    </div>
  );
};
