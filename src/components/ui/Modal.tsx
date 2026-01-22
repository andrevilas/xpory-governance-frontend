import type { ReactNode } from 'react';

import './modal.css';

type ModalProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function Modal({
  isOpen,
  title,
  onClose,
  children,
  className,
  bodyClassName,
}: ModalProps): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={['modal', className].filter(Boolean).join(' ')}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h3>{title}</h3>
          <button type="button" onClick={onClose}>
            Fechar
          </button>
        </header>
        <div className={['modal-body', bodyClassName].filter(Boolean).join(' ')}>
          {children}
        </div>
      </div>
    </div>
  );
}
