import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { fetchNotificationLogs, NotificationLog } from '../../services/notifications';
import './alerts.css';

const severityMap: Record<string, 'low' | 'medium' | 'high'> = {
  sent: 'low',
  queued: 'medium',
  failed: 'high',
  skipped: 'medium',
};

export function AlertsPage(): JSX.Element {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchNotificationLogs({
          status: statusFilter || undefined,
          channel: channelFilter || undefined,
        });
        setLogs(data);
      } catch (err) {
        void err;
        setError('Nao foi possivel carregar logs.');
      } finally {
        setLoading(false);
      }
    };

    void loadLogs();
  }, [statusFilter, channelFilter]);

  const recentAlerts = useMemo(() => {
    return logs.slice(0, 5).map((log) => ({
      id: log.id,
      title: `${log.channel.toUpperCase()} ${log.status.toUpperCase()} - ${log.subject ?? 'Notificacao'}`,
      severity: severityMap[log.status] ?? 'low',
      timestamp: new Date(log.createdAt).toLocaleString('pt-BR'),
    }));
  }, [logs]);

  return (
    <AppLayout title="Alertas">
      <div className="alerts-page">
        <section className="alerts-card">
          <h2>Configuracoes de notificacao</h2>
          <div className="filters">
            <label>
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(event) => setEmailEnabled(event.target.checked)}
                data-testid="notifications.email.toggle"
              />
              Email (SES)
            </label>
            <label>
              <input
                type="checkbox"
                checked={smsEnabled}
                onChange={(event) => setSmsEnabled(event.target.checked)}
                data-testid="notifications.sms.toggle"
              />
              SMS (Zenvia)
            </label>
            <button
              type="button"
              className="primary"
              onClick={() => setLastSavedAt(new Date().toLocaleString('pt-BR'))}
              data-testid="notifications.save.button"
            >
              Salvar
            </button>
          </div>
          {lastSavedAt && <p>Ultima gravacao: {lastSavedAt}</p>}
        </section>

        <section className="alerts-card">
          <h2>Alertas recentes</h2>
          {loading && <p>Carregando...</p>}
          {error && <p className="inline-alert">{error}</p>}
          {!loading && recentAlerts.length === 0 ? (
            <p>Nenhum alerta disponivel.</p>
          ) : (
            <ul>
              {recentAlerts.map((alert) => (
                <li key={alert.id}>
                  <span className={`severity ${alert.severity}`}>{alert.severity.toUpperCase()}</span>
                  <div>
                    <strong>{alert.title}</strong>
                    <p>{alert.timestamp}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="alerts-card">
          <h2>Logs e eventos</h2>
          <div className="filters">
            <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
              <option value="">Todos canais</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Todos status</option>
              <option value="sent">Enviado</option>
              <option value="queued">Fila</option>
              <option value="failed">Falha</option>
              <option value="skipped">Ignorado</option>
            </select>
          </div>
          {loading ? (
            <p>Carregando logs...</p>
          ) : logs.length === 0 ? (
            <p>Nenhum log encontrado.</p>
          ) : (
            <ul className="log-list">
              {logs.map((log) => (
                <li key={log.id}>
                  <strong>{log.subject ?? 'Notificacao'}</strong>
                  <span>{log.channel.toUpperCase()}</span>
                  <span className={`severity ${severityMap[log.status] ?? 'low'}`}>
                    {log.status.toUpperCase()}
                  </span>
                  <p>{log.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
