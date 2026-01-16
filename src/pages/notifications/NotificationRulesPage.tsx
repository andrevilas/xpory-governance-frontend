import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { Modal } from '../../components/ui/Modal';
import { PageTabs } from '../../components/ui/PageTabs';
import {
  createNotificationRule,
  deleteNotificationRule,
  fetchNotificationRecipients,
  fetchNotificationRules,
  NotificationRecipient,
  NotificationRule,
  updateNotificationRule,
} from '../../services/notificationRules';
import './notifications.css';

type RuleFormState = {
  name: string;
  eventType: string;
  severity: string;
  throttleMinutes: string;
  enabled: boolean;
  recipients: string[];
};

const emptyRuleForm: RuleFormState = {
  name: '',
  eventType: 'registry_drift',
  severity: '',
  throttleMinutes: '30',
  enabled: true,
  recipients: [],
};

const eventOptions = [
  'inventory_completed',
  'inventory_failed',
  'audit_completed',
  'audit_outdated',
  'audit_failed',
  'registry_drift',
  'update_success',
  'update_failed',
  'update_rolled_back',
  'update_dry_run',
];

const severityOptions = ['', 'info', 'warning', 'critical'];

const tabs = [
  { label: 'Destinatários', path: '/app/notifications/recipients' },
  { label: 'Regras', path: '/app/notifications/rules' },
];

export function NotificationRulesPage(): JSX.Element {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([]);
  const [ruleForm, setRuleForm] = useState<RuleFormState>(emptyRuleForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [recipientsResult, rulesResult] = await Promise.all([
        fetchNotificationRecipients(),
        fetchNotificationRules(),
      ]);
      setRecipients(recipientsResult);
      setRules(rulesResult);
    } catch (err) {
      void err;
      setError('Não foi possível carregar regras.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const recipientOptions = useMemo(
    () => recipients.filter((rec) => rec.active),
    [recipients],
  );

  const openModal = () => {
    setRuleForm(emptyRuleForm);
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setRuleForm(emptyRuleForm);
    setError(null);
  };

  const handleCreateRule = async () => {
    if (!ruleForm.name.trim() || !ruleForm.eventType) {
      setError('Informe nome e evento.');
      return;
    }
    if (ruleForm.recipients.length === 0) {
      setError('Selecione ao menos um destinatário.');
      return;
    }
    setError(null);
    await createNotificationRule({
      name: ruleForm.name.trim(),
      eventType: ruleForm.eventType,
      severity: ruleForm.severity || undefined,
      enabled: ruleForm.enabled,
      throttleMinutes: Number(ruleForm.throttleMinutes || 0),
      recipients: ruleForm.recipients,
    });
    await loadData();
    closeModal();
  };

  const handleToggleRule = async (rule: NotificationRule) => {
    await updateNotificationRule(rule.id, { enabled: !rule.enabled });
    await loadData();
  };

  const handleDeleteRule = async (rule: NotificationRule) => {
    await deleteNotificationRule(rule.id);
    await loadData();
  };

  return (
    <AppLayout
      title="Notificações / Regras"
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
            <h2>Regras de alerta</h2>
            {rules.length === 0 ? (
              <div className="empty-state">Nenhuma regra cadastrada.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Regra</th>
                    <th>Evento</th>
                    <th>Severidade</th>
                    <th>Throttle</th>
                    <th>Destinatarios</th>
                    <th>Status</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id}>
                      <td>{rule.name}</td>
                      <td>{rule.eventType}</td>
                      <td>{rule.severity ?? 'qualquer'}</td>
                      <td>{rule.throttleMinutes} min</td>
                      <td>{rule.recipients.length}</td>
                      <td>{rule.enabled ? 'Ativa' : 'Inativa'}</td>
                      <td>
                        <div className="actions">
                          <button type="button" onClick={() => handleToggleRule(rule)}>
                            {rule.enabled ? 'Desativar' : 'Ativar'}
                          </button>
                          <button type="button" className="danger" onClick={() => handleDeleteRule(rule)}>
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

      <Modal isOpen={isModalOpen} title="Nova regra" onClose={closeModal}>
        <div className="form-grid">
          <label>
            Nome
            <input
              value={ruleForm.name}
              onChange={(event) => setRuleForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Drift de digest"
            />
          </label>
          <label>
            Evento
            <select
              value={ruleForm.eventType}
              onChange={(event) => setRuleForm((prev) => ({ ...prev, eventType: event.target.value }))}
            >
              {eventOptions.map((event) => (
                <option key={event} value={event}>
                  {event}
                </option>
              ))}
            </select>
          </label>
          <label>
            Severidade
            <select
              value={ruleForm.severity}
              onChange={(event) => setRuleForm((prev) => ({ ...prev, severity: event.target.value }))}
            >
              {severityOptions.map((severity) => (
                <option key={severity} value={severity}>
                  {severity || 'qualquer'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Throttle (min)
            <input
              value={ruleForm.throttleMinutes}
              onChange={(event) => setRuleForm((prev) => ({ ...prev, throttleMinutes: event.target.value }))}
              placeholder="30"
            />
          </label>
          <label className="inline">
            Ativa
            <input
              type="checkbox"
              checked={ruleForm.enabled}
              onChange={(event) => setRuleForm((prev) => ({ ...prev, enabled: event.target.checked }))}
            />
          </label>
        </div>

        <div className="recipients-select">
          <strong>Destinatarios</strong>
          <div className="recipient-list">
            {recipientOptions.map((recipient) => (
              <label key={recipient.id} className="recipient-row">
                <input
                  type="checkbox"
                  checked={ruleForm.recipients.includes(recipient.id)}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setRuleForm((prev) => ({
                      ...prev,
                      recipients: checked
                        ? [...prev.recipients, recipient.id]
                        : prev.recipients.filter((id) => id !== recipient.id),
                    }));
                  }}
                />
                <span>
                  {recipient.name} ({recipient.channel})
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={handleCreateRule}>
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
