import { useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import './update.css';

type UpdateStatus = 'pending' | 'approved' | 'running' | 'success' | 'failed';

type DiffRow = {
  id: number;
  service: string;
  before: string;
  after: string;
};

const diffMock: DiffRow[] = [
  { id: 1, service: 'core-api', before: '1.4.2', after: '1.5.0' },
  { id: 2, service: 'billing', before: '1.1.0', after: '1.2.0' },
];

export function UpdatePage(): JSX.Element {
  const [status, setStatus] = useState<UpdateStatus>('pending');

  const canApprove = status === 'pending';
  const canExecute = status === 'approved';

  const healthIndicators = useMemo(
    () => [
      { label: 'Pre-update', value: status === 'running' || status === 'success' ? 'OK' : 'Pendente' },
      { label: 'Post-update', value: status === 'success' ? 'OK' : status === 'failed' ? 'Falha' : 'Pendente' },
    ],
    [status]
  );

  return (
    <AppLayout title="Atualizacoes">
      <div className="update-page">
        <section className="update-card">
          <h2>Diff do Compose</h2>
          <table className="diff-table">
            <thead>
              <tr>
                <th>Servico</th>
                <th>Antes</th>
                <th>Depois</th>
              </tr>
            </thead>
            <tbody>
              {diffMock.map((row) => (
                <tr key={row.id}>
                  <td>{row.service}</td>
                  <td className="before">{row.before}</td>
                  <td className="after">{row.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="update-card">
          <h2>Fluxo de aprovacao</h2>
          <div className="actions">
            <button type="button" disabled={!canApprove} onClick={() => setStatus('approved')}>
              Aprovar atualizacao
            </button>
            <button type="button" disabled={!canExecute} onClick={() => setStatus('running')}>
              Executar update
            </button>
            <button type="button" disabled={status !== 'running'} onClick={() => setStatus('success')}>
              Marcar sucesso
            </button>
            <button type="button" disabled={status !== 'running'} onClick={() => setStatus('failed')}>
              Marcar falha
            </button>
          </div>
          <p className="status">Status atual: {status}</p>
        </section>

        <section className="update-card">
          <h2>Indicadores de health</h2>
          <div className="health-grid">
            {healthIndicators.map((indicator) => (
              <div key={indicator.label} className="health-item">
                <span>{indicator.label}</span>
                <strong>{indicator.value}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
