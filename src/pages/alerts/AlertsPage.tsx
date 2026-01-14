import { AppLayout } from '../../components/layout/AppLayout';
import './alerts.css';

type AlertItem = {
  id: number;
  title: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
};

const alertsMock: AlertItem[] = [
  { id: 1, title: 'Update falhou em billing', severity: 'high', timestamp: '2 min atras' },
  { id: 2, title: 'Nova versao disponivel core-api', severity: 'medium', timestamp: '1h atras' },
  { id: 3, title: 'Instancia offline detectada', severity: 'high', timestamp: '3h atras' },
];

export function AlertsPage(): JSX.Element {
  return (
    <AppLayout title="Alertas">
      <div className="alerts-page">
        <section className="alerts-card">
          <h2>Alertas recentes</h2>
          <ul>
            {alertsMock.map((alert) => (
              <li key={alert.id}>
                <span className={`severity ${alert.severity}`}>{alert.severity.toUpperCase()}</span>
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.timestamp}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="alerts-card">
          <h2>Logs e eventos</h2>
          <p>Placeholder para eventos detalhados e logs de atualizacao.</p>
        </section>
      </div>
    </AppLayout>
  );
}
