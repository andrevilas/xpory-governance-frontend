import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import {
  createNotificationRecipient,
  createNotificationRule,
  deleteNotificationRecipient,
  deleteNotificationRule,
  fetchNotificationRecipients,
  fetchNotificationRules,
  NotificationRecipient,
  NotificationRule,
  updateNotificationRecipient,
  updateNotificationRule,
} from '../../services/notificationRules';
import './notifications.css';

type RecipientFormState = {
  name: string;
  channel: 'email' | 'sms';
  address: string;
  active: boolean;
};

type RuleFormState = {
  name: string;
  eventType: string;
  severity: string;
  throttleMinutes: string;
  enabled: boolean;
  recipients: string[];
};

const emptyRecipientForm: RecipientFormState = {
  name: '',
  channel: 'email',
  address: '',
  active: true,
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

export function NotificationsPage(): JSX.Element {
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([]);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [recipientForm, setRecipientForm] = useState<RecipientFormState>(emptyRecipientForm);
  const [ruleForm, setRuleForm] = useState<RuleFormState>(emptyRuleForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError('Não foi possível carregar configurações.');
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
    setRecipientForm(emptyRecipientForm);
    await loadData();
  };

  const handleToggleRecipient = async (recipient: NotificationRecipient) => {
    await updateNotificationRecipient(recipient.id, { active: !recipient.active });
    await loadData();
  };

  const handleDeleteRecipient = async (recipient: NotificationRecipient) => {
    await deleteNotificationRecipient(recipient.id);
    await loadData();
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
    setRuleForm(emptyRuleForm);
    await loadData();
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
    <AppLayout title="Notificações">
      <div className="notifications-page">
        {error && <div className="inline-alert">{error}</div>}
        {loading ? (
          <div className="empty-state">Carregando...</div>
        ) : (
          <>
            <section className="card">
              <h2>Destinatarios</h2>
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
                  Adicionar destinatário
                </button>
              </div>

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

            <section className="card">
              <h2>Regras de alerta</h2>
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
                  Criar regra
                </button>
              </div>

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
          </>
        )}
      </div>
    </AppLayout>
  );
}
