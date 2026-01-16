import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { Modal } from '../../components/ui/Modal';
import { PageTabs } from '../../components/ui/PageTabs';
import {
  createNotificationRecipient,
  deleteNotificationRecipient,
  fetchNotificationRecipients,
  NotificationRecipient,
  updateNotificationRecipient,
} from '../../services/notificationRules';
import './notifications.css';

type RecipientFormState = {
  name: string;
  channel: 'email' | 'sms';
  address: string;
  active: boolean;
};

const emptyRecipientForm: RecipientFormState = {
  name: '',
  channel: 'email',
  address: '',
  active: true,
};

const tabs = [
  { label: 'Destinatários', path: '/app/notifications/recipients' },
  { label: 'Regras', path: '/app/notifications/rules' },
];

export function NotificationRecipientsPage(): JSX.Element {
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([]);
  const [recipientForm, setRecipientForm] = useState<RecipientFormState>(emptyRecipientForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const recipientsResult = await fetchNotificationRecipients();
      setRecipients(recipientsResult);
    } catch (err) {
      void err;
      setError('Não foi possível carregar destinatários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const recipientCount = useMemo(() => recipients.length, [recipients]);

  const openModal = () => {
    setRecipientForm(emptyRecipientForm);
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setRecipientForm(emptyRecipientForm);
    setError(null);
  };

  const handleCreateRecipient = async () => {
    if (!recipientForm.name.trim() || !recipientForm.address.trim()) {
      setError('Informe nome e endereço.');
      return;
    }
    setError(null);
    await createNotificationRecipient({
      name: recipientForm.name.trim(),
      channel: recipientForm.channel,
      address: recipientForm.address.trim(),
      active: recipientForm.active,
    });
    await loadData();
    closeModal();
  };

  const handleToggleRecipient = async (recipient: NotificationRecipient) => {
    await updateNotificationRecipient(recipient.id, { active: !recipient.active });
    await loadData();
  };

  const handleDeleteRecipient = async (recipient: NotificationRecipient) => {
    await deleteNotificationRecipient(recipient.id);
    await loadData();
  };

  return (
    <AppLayout
      title="Notificações / Destinatários"
      headerAction={
        <button type="button" className="header-button primary" onClick={openModal}>
          Novo
        </button>
      }
    >
      <div className="notifications-page">
        <PageTabs tabs={tabs} />
        {error && <div className="inline-alert">{error}</div>}
        {loading ? (
          <div className="empty-state">Carregando...</div>
        ) : (
          <section className="card">
            <h2>Destinatários ({recipientCount})</h2>
            {recipients.length === 0 ? (
              <div className="empty-state">Nenhum destinatário cadastrado.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Canal</th>
                    <th>Endereco</th>
                    <th>Status</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((recipient) => (
                    <tr key={recipient.id}>
                      <td>{recipient.name}</td>
                      <td>{recipient.channel}</td>
                      <td>{recipient.address}</td>
                      <td>{recipient.active ? 'Ativo' : 'Inativo'}</td>
                      <td>
                        <div className="actions">
                          <button type="button" onClick={() => handleToggleRecipient(recipient)}>
                            {recipient.active ? 'Desativar' : 'Ativar'}
                          </button>
                          <button type="button" className="danger" onClick={() => handleDeleteRecipient(recipient)}>
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>

      <Modal isOpen={isModalOpen} title="Novo destinatário" onClose={closeModal}>
        <div className="form-grid">
          <label>
            Nome
            <input
              value={recipientForm.name}
              onChange={(event) => setRecipientForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="DevOps"
            />
          </label>
          <label>
            Canal
            <select
              value={recipientForm.channel}
              onChange={(event) =>
                setRecipientForm((prev) => ({
                  ...prev,
                  channel: event.target.value as 'email' | 'sms',
                }))
              }
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </label>
          <label>
            Endereco
            <input
              value={recipientForm.address}
              onChange={(event) => setRecipientForm((prev) => ({ ...prev, address: event.target.value }))}
              placeholder="contato@xpory.com"
            />
          </label>
          <label className="inline">
            Ativo
            <input
              type="checkbox"
              checked={recipientForm.active}
              onChange={(event) => setRecipientForm((prev) => ({ ...prev, active: event.target.checked }))}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" onClick={handleCreateRecipient}>
            Salvar
          </button>
          <button type="button" className="secondary" onClick={closeModal}>
            Cancelar
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}
