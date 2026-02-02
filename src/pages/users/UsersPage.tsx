import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { Modal } from '../../components/ui/Modal';
import { UserFormModal, UserFormState } from '../../components/users/UserFormModal';
import { changePassword } from '../../services/auth';
import { fetchInstances } from '../../services/instances';
import { fetchStacksLocal, StackLocal } from '../../services/stacksLocal';
import {
  createUser,
  getUserPermissions,
  listRoles,
  listUsers,
  resetUserPassword,
  setUserPassword,
  updateUser,
  updateUserPermissions,
  UserPermissions,
  UserRecord,
} from '../../services/users';
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

type AdminPasswordFormState = {
  newPassword: string;
  confirmPassword: string;
};

type PermissionFormState = UserPermissions;

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
  const [adminPasswordUser, setAdminPasswordUser] = useState<UserRecord | null>(null);
  const [adminPasswordForm, setAdminPasswordForm] = useState<AdminPasswordFormState>({
    newPassword: '',
    confirmPassword: '',
  });
  const [adminPasswordError, setAdminPasswordError] = useState<string | null>(null);
  const [adminPasswordSaving, setAdminPasswordSaving] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<UserRecord | null>(null);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [permissionsForm, setPermissionsForm] = useState<PermissionFormState>({ instanceIds: [], stackIds: [] });
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [instances, setInstances] = useState<Array<{ id: string; name: string }>>([]);
  const [stacksLocal, setStacksLocal] = useState<StackLocal[]>([]);

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

  const openAdminPasswordModal = (user: UserRecord) => {
    setAdminPasswordUser(user);
    setAdminPasswordForm({ newPassword: '', confirmPassword: '' });
    setAdminPasswordError(null);
  };

  const closeAdminPasswordModal = () => {
    setAdminPasswordUser(null);
    setAdminPasswordForm({ newPassword: '', confirmPassword: '' });
    setAdminPasswordError(null);
    setAdminPasswordSaving(false);
  };

  const openPermissionsModal = async (user: UserRecord) => {
    setPermissionsUser(user);
    setPermissionsModalOpen(true);
    setPermissionsError(null);
    setPermissionsLoading(true);
    try {
      const [permissionsResult, instancesResult, stacksResult] = await Promise.all([
        getUserPermissions(user.id),
        fetchInstances(),
        fetchStacksLocal(),
      ]);
      setPermissionsForm({
        instanceIds: permissionsResult.instanceIds ?? [],
        stackIds: permissionsResult.stackIds ?? [],
      });
      setInstances(instancesResult.map((instance) => ({ id: instance.id, name: instance.name })));
      setStacksLocal(stacksResult);
    } catch (err) {
      void err;
      setPermissionsError('Não foi possível carregar permissões.');
    } finally {
      setPermissionsLoading(false);
    }
  };

  const closePermissionsModal = () => {
    setPermissionsModalOpen(false);
    setPermissionsUser(null);
    setPermissionsForm({ instanceIds: [], stackIds: [] });
    setPermissionsError(null);
  };

  const validatePasswordPolicy = (password: string): string | null => {
    if (password.length < 8) {
      return 'A senha deve ter ao menos 8 caracteres.';
    }
    if (!/[A-Z]/.test(password)) {
      return 'A senha deve conter ao menos 1 letra maiuscula.';
    }
    if (!/[a-z]/.test(password)) {
      return 'A senha deve conter ao menos 1 letra minuscula.';
    }
    if (!/[0-9]/.test(password)) {
      return 'A senha deve conter ao menos 1 numero.';
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'A senha deve conter ao menos 1 caractere especial.';
    }
    return null;
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

  const handleAdminSetPassword = async () => {
    if (!adminPasswordUser) {
      return;
    }
    const policyError = validatePasswordPolicy(adminPasswordForm.newPassword);
    if (policyError) {
      setAdminPasswordError(policyError);
      return;
    }
    if (adminPasswordForm.newPassword !== adminPasswordForm.confirmPassword) {
      setAdminPasswordError('A confirmacao nao confere com a senha.');
      return;
    }
    setAdminPasswordSaving(true);
    setAdminPasswordError(null);
    try {
      await setUserPassword(adminPasswordUser.id, {
        password: adminPasswordForm.newPassword,
        confirmPassword: adminPasswordForm.confirmPassword,
      });
      setToastMessage(`Senha atualizada para ${adminPasswordUser.email}`);
      closeAdminPasswordModal();
    } catch (err) {
      void err;
      setAdminPasswordError('Não foi possível alterar a senha.');
    } finally {
      setAdminPasswordSaving(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!permissionsUser) {
      return;
    }
    setPermissionsSaving(true);
    setPermissionsError(null);
    try {
      await updateUserPermissions(permissionsUser.id, permissionsForm);
      setToastMessage(`Permissoes atualizadas para ${permissionsUser.email}`);
      closePermissionsModal();
    } catch (err) {
      void err;
      setPermissionsError('Não foi possível salvar permissões.');
    } finally {
      setPermissionsSaving(false);
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
                        <button type="button" className="link" onClick={() => openAdminPasswordModal(user)}>
                          Alterar senha
                        </button>
                        <button type="button" className="link" onClick={() => handleToggleActive(user)}>
                          {user.isActive ? 'Desativar' : 'Ativar'}
                        </button>
                        <button type="button" className="link" onClick={() => handleResetPassword(user)}>
                          Resetar senha
                        </button>
                        {user.role === 'operator' ? (
                          <button type="button" className="link" onClick={() => void openPermissionsModal(user)}>
                            Permissoes
                          </button>
                        ) : null}
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

      <Modal
        isOpen={Boolean(adminPasswordUser)}
        title={adminPasswordUser ? `Alterar senha: ${adminPasswordUser.email}` : 'Alterar senha'}
        onClose={closeAdminPasswordModal}
      >
        <div className="form-grid">
          <label>
            Nova senha
            <input
              type="password"
              value={adminPasswordForm.newPassword}
              onChange={(event) =>
                setAdminPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
              }
              placeholder="Nova senha"
            />
          </label>
          <label>
            Confirmar senha
            <input
              type="password"
              value={adminPasswordForm.confirmPassword}
              onChange={(event) =>
                setAdminPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
              }
              placeholder="Confirmar senha"
            />
          </label>
        </div>
        <div className="users-password-policy">
          <strong>Politica de senha:</strong>
          <ul>
            <li>Minimo de 8 caracteres</li>
            <li>Ao menos 1 letra maiuscula</li>
            <li>Ao menos 1 letra minuscula</li>
            <li>Ao menos 1 numero</li>
            <li>Ao menos 1 caractere especial</li>
          </ul>
        </div>
        {adminPasswordError ? <div className="inline-alert">{adminPasswordError}</div> : null}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={closeAdminPasswordModal} disabled={adminPasswordSaving}>
            Cancelar
          </button>
          <button type="button" onClick={handleAdminSetPassword} disabled={adminPasswordSaving}>
            {adminPasswordSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={permissionsModalOpen}
        title={permissionsUser ? `Permissoes: ${permissionsUser.email}` : 'Permissoes'}
        onClose={closePermissionsModal}
      >
        {permissionsLoading ? (
          <p>Carregando permissoes...</p>
        ) : (
          <>
            <div className="users-permissions-grid">
              <div>
                <h4>Instancias permitidas</h4>
                {instances.length === 0 ? (
                  <p>Nenhuma instancia disponivel.</p>
                ) : (
                  <ul className="users-checklist">
                    {instances.map((instance) => (
                      <li key={instance.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={permissionsForm.instanceIds.includes(instance.id)}
                            onChange={(event) => {
                              setPermissionsForm((prev) => {
                                const next = new Set(prev.instanceIds);
                                if (event.target.checked) {
                                  next.add(instance.id);
                                } else {
                                  next.delete(instance.id);
                                }
                                return { ...prev, instanceIds: Array.from(next) };
                              });
                            }}
                          />
                          {instance.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4>Stacks globais permitidas</h4>
                {stacksLocal.length === 0 ? (
                  <p>Nenhuma stack cadastrada.</p>
                ) : (
                  <ul className="users-checklist">
                    {stacksLocal.map((stack) => (
                      <li key={stack.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={permissionsForm.stackIds.includes(stack.id)}
                            onChange={(event) => {
                              setPermissionsForm((prev) => {
                                const next = new Set(prev.stackIds);
                                if (event.target.checked) {
                                  next.add(stack.id);
                                } else {
                                  next.delete(stack.id);
                                }
                                return { ...prev, stackIds: Array.from(next) };
                              });
                            }}
                          />
                          {stack.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {permissionsError ? <div className="inline-alert">{permissionsError}</div> : null}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={closePermissionsModal} disabled={permissionsSaving}>
                Cancelar
              </button>
              <button type="button" onClick={handleSavePermissions} disabled={permissionsSaving}>
                {permissionsSaving ? 'Salvando...' : 'Salvar permissoes'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </AppLayout>
  );
}
