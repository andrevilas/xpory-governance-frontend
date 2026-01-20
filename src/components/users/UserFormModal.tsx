import type { ReactNode } from 'react';

import { Modal } from '../ui/Modal';
import './user-form-modal.css';

export type UserFormState = {
  name: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
};

type UserFormModalProps = {
  isOpen: boolean;
  title: string;
  roles: string[];
  value: UserFormState;
  error?: string | null;
  summary?: ReactNode;
  onChange: (next: UserFormState) => void;
  onClose: () => void;
  onSave: () => void;
};

export function UserFormModal({
  isOpen,
  title,
  roles,
  value,
  error,
  summary,
  onChange,
  onClose,
  onSave,
}: UserFormModalProps): JSX.Element {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onClose}>
      <div className="user-form-modal">
        {summary}
        {error && <div className="inline-alert">{error}</div>}
        <div className="form-grid">
          <label>
            Nome
            <input
              type="text"
              value={value.name}
              onChange={(event) => onChange({ ...value, name: event.target.value })}
              placeholder="Nome completo"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={value.email}
              onChange={(event) => onChange({ ...value, email: event.target.value })}
              placeholder="usuario@xpory.com"
            />
          </label>
          <label>
            Telefone (BR)
            <input
              type="tel"
              value={value.phone}
              onChange={(event) => onChange({ ...value, phone: event.target.value })}
              placeholder="(11) 91234-5678"
            />
          </label>
          <label>
            Role
            <select
              value={value.role}
              onChange={(event) => onChange({ ...value, role: event.target.value })}
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={value.isActive}
              onChange={(event) => onChange({ ...value, isActive: event.target.checked })}
            />
            Ativo
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="header-button" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="header-button primary" onClick={onSave}>
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}
