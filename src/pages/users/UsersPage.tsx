import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { Modal } from '../../components/ui/Modal';
import { UserFormModal, UserFormState } from '../../components/users/UserFormModal';
import { changePassword } from '../../services/auth';
import { createUser, listRoles, listUsers, resetUserPassword, updateUser, UserRecord } from '../../services/users';
import './users.css';

const emptyForm: UserFormState = {
  name: '',
  email: '',
  phone: '',
  role: 'viewer',
  isActive: true,
};

const roleLabels: Record<string, string> = {
  admin_master: 'Admin Master',
  admin: 'Admin',
  operator: 'Operador',
  viewer: 'Viewer',
};

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

function formatPhone(phone?: string | null): string {
  if (!phone) {
    return '-';
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function UsersPage(): JSX.Element {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formState, setFormState] = useState<UserFormState>(emptyForm);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersResult, rolesResult] = await Promise.all([listUsers(), listRoles()]);
      setUsers(usersResult);
      setRoles(rolesResult.map((role) => role.name));
    } catch (err) {
      void err;
      setError('Não foi possível carregar usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openCreate = () => {
    setEditingUser(null);
    setFormState(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (user: UserRecord) => {
    setEditingUser(user);
    setFormState({
      name: user.name ?? '',
      email: user.email,
      phone: user.phone ?? '',
      role: user.role,
      isActive: user.isActive,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormState(emptyForm);
    setEditingUser(null);
  };

  const openPasswordModal = () => {
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordError(null);
    setIsPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordError(null);
  };

  const handleSave = async () => {
    if (!formState.name.trim() || !formState.email.trim()) {
      setError('Nome e email são obrigatórios.');
      return;
    }
    setError(null);

    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          name: formState.name.trim(),
          email: formState.email.trim(),
          phone: formState.phone ? formState.phone.trim() : null,
          role: formState.role as UserRecord['role'],
          isActive: formState.isActive,
        });
      } else {
        await createUser({
          name: formState.name.trim(),
          email: formState.email.trim(),
          phone: formState.phone ? formState.phone.trim() : undefined,
          role: formState.role as UserRecord['role'],
          isActive: formState.isActive,
        });
      }
      await loadData();
      closeModal();
    } catch (err) {
      void err;
      setError('Não foi possível salvar o usuário.');
    }
  };

  const handleToggleActive = async (user: UserRecord) => {
    try {
      await updateUser(user.id, { isActive: !user.isActive });
      await loadData();
    } catch (err) {
      void err;
      setError('Não foi possível atualizar o status.');
    }
  };

  const handleResetPassword = async (user: UserRecord) => {
    const confirmReset = window.confirm(`Enviar email de redefinição para ${user.email}?`);
    if (!confirmReset) {
      return;
    }
    try {
      await resetUserPassword(user.id);
      setToastMessage(`Reset enviado para ${user.email}`);
    } catch (err) {
      void err;
      setError('Não foi possível enviar o reset.');
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword.trim() || !passwordForm.newPassword.trim()) {
      setPasswordError('Preencha a senha atual e a nova senha.');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('A nova senha deve ter ao menos 8 caracteres.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('A confirmação não confere com a nova senha.');
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setToastMessage('Senha atualizada com sucesso.');
      closePasswordModal();
    } catch (err) {
      void err;
      setPasswordError('Não foi possível atualizar a senha.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const userCount = useMemo(() => users.length, [users]);

  return (
    <AppLayout
      title="Usuários"
      headerAction={
        <div className="header-actions">
          <button type="button" className="header-button" onClick={openPasswordModal}>
            Trocar minha senha
          </button>
          <button type="button" className="header-button primary" onClick={openCreate}>
            Novo usuário
          </button>
        </div>
      }
    >
      <div className="users-page">
        {error && <div className="inline-alert">{error}</div>}
        {loading ? (
          <div className="empty-state">Carregando...</div>
        ) : (
          <section className="card">
            <div className="card-header">
              <h2>Usuários ({userCount})</h2>
              <span className="hint">Apenas Admin Master pode editar.</span>
            </div>
            {users.length === 0 ? (
              <div className="empty-state">Nenhum usuário cadastrado.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Telefone</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name ?? '-'}</td>
                      <td>{user.email}</td>
                      <td>{formatPhone(user.phone)}</td>
                      <td>{roleLabels[user.role] ?? user.role}</td>
                      <td>{user.isActive ? 'Ativo' : 'Inativo'}</td>
                      <td className="actions">
                        <button type="button" className="link" onClick={() => openEdit(user)}>
                          Editar
                        </button>
                        <button type="button" className="link" onClick={() => handleToggleActive(user)}>
                          {user.isActive ? 'Desativar' : 'Ativar'}
                        </button>
                        <button type="button" className="link" onClick={() => handleResetPassword(user)}>
                          Resetar senha
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {toastMessage && (
          <div className="toast" role="status" onAnimationEnd={() => setToastMessage(null)}>
            {toastMessage}
          </div>
        )}
      </div>

      <UserFormModal
        isOpen={isModalOpen}
        title={editingUser ? 'Editar usuário' : 'Novo usuário'}
        roles={roles.length ? roles : ['admin_master', 'admin', 'operator', 'viewer']}
        value={formState}
        error={error}
        summary={
          editingUser ? (
            <div className="modal-summary">
              <div>
                <div className="modal-summary-title">{editingUser.name ?? editingUser.email}</div>
                <div className="modal-summary-subtitle">{editingUser.email}</div>
              </div>
              <span className="pill">{roleLabels[editingUser.role] ?? editingUser.role}</span>
            </div>
          ) : null
        }
        onChange={setFormState}
        onClose={closeModal}
        onSave={handleSave}
      />

      <Modal isOpen={isPasswordModalOpen} title="Trocar minha senha" onClose={closePasswordModal}>
        {passwordError && <div className="inline-alert">{passwordError}</div>}
        <div className="form-grid">
          <label>
            Senha atual
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
              }
            />
          </label>
          <label>
            Nova senha
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
              }
            />
          </label>
          <label>
            Confirmar nova senha
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
              }
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" onClick={handleChangePassword} disabled={passwordSaving}>
            {passwordSaving ? 'Salvando...' : 'Atualizar senha'}
          </button>
          <button type="button" className="secondary" onClick={closePasswordModal} disabled={passwordSaving}>
            Cancelar
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}
